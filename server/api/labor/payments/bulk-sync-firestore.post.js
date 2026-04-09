import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransaction } from '../../../utils/ledgerTransactions'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { limit = 50, offset = 0, syncStatus = 'pending' } = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      })
    }

    // Get active Supabase configuration
    const config = await SupabaseConfig.findOne({
      firmId,
      isActive: true
    })

    if (!config) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No active Supabase configuration found'
      })
    }

    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    // Get payments that need syncing
    let query = supabase
      .from('payment_records')
      .select('*')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by sync status if specified
    if (syncStatus && syncStatus !== 'all') {
      query = query.eq('firestore_sync_status', syncStatus)
    }

    const { data: payments, error: paymentsError } = await query

    if (paymentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch payments: ${paymentsError.message}`
      })
    }

    if (!payments || payments.length === 0) {
      return {
        success: true,
        data: {
          processed: 0,
          successful: 0,
          failed: 0,
          results: []
        },
        message: 'No payments found to sync'
      }
    }

    // Get all unique group IDs
    const groupIds = [...new Set(payments.map(p => p.group_id))]
    
    // Fetch all groups in one query
    const { data: groups, error: groupsError } = await supabase
      .from('labor_groups')
      .select('*')
      .in('id', groupIds)
      .eq('firm_id', firmId)

    if (groupsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch groups: ${groupsError.message}`
      })
    }

    // Create a map for quick group lookup
    const groupsMap = new Map()
    groups.forEach(group => {
      groupsMap.set(group.id, group)
    })

    // Process payments
    const results = []
    let successful = 0
    let failed = 0

    for (const payment of payments) {
      const result = {
        paymentId: payment.id,
        groupId: payment.group_id,
        amount: payment.amount,
        success: false,
        error: null,
        firestoreResult: null
      }

      try {
        const groupData = groupsMap.get(payment.group_id)
        
        if (!groupData) {
          result.error = 'Group not found'
          failed++
          results.push(result)
          continue
        }

        if (!groupData.is_active) {
          result.error = 'Group is inactive'
          failed++
          results.push(result)
          continue
        }

        // Sync to Firestore
        const firestoreResult = await createLaborPaymentLedgerTransaction(
          payment,
          groupData,
          userId || payment.user_id || 'system',
          firmId
        )

        if (firestoreResult.success) {
          // Update payment record with sync status
          await supabase
            .from('payment_records')
            .update({
              firestore_sync_status: 'synced',
              firestore_doc_id: firestoreResult.expenseId,
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id)

          result.success = true
          result.firestoreResult = firestoreResult
          successful++
        } else {
          result.error = 'Firestore sync failed'
          failed++
        }

      } catch (error) {
        console.error(`Error syncing payment ${payment.id}:`, error)
        result.error = error.message
        failed++

        // Update payment record with failed status
        try {
          await supabase
            .from('payment_records')
            .update({
              firestore_sync_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id)
        } catch (updateError) {
          console.error('Failed to update payment sync status:', updateError)
        }
      }

      results.push(result)
    }

    console.log(`✅ Bulk sync completed: ${successful} successful, ${failed} failed out of ${payments.length} payments`)

    return {
      success: true,
      data: {
        processed: payments.length,
        successful,
        failed,
        results
      },
      message: `Bulk sync completed: ${successful} successful, ${failed} failed out of ${payments.length} payments`
    }

  } catch (error) {
    console.error('Error in bulk sync payments:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to bulk sync payments to Firestore'
    })
  }
})
