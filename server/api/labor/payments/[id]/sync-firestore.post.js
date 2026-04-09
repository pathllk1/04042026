import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransaction } from '~~/server/utils/ledgerTransactions'

export default defineEventHandler(async (event) => {
  try {
    const paymentId = getRouterParam(event, 'id')
    const body = await readBody(event)

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id


    if (!paymentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Payment ID is required'
      })
    }

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

    // Get payment details
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_records')
      .select('*')
      .eq('id', paymentId)
      .eq('firm_id', firmId)
      .single()

    if (paymentError || !paymentData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Payment not found'
      })
    }

    // Get group details
    const { data: groupData, error: groupError } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('id', paymentData.group_id)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .single()

    if (groupError || !groupData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor group not found or inactive'
      })
    }

    // Sync to Firestore
    let firestoreResult = null
    let syncStatus = 'failed'
    let syncError = null

    try {
      // Create/update ledger transaction and expense in Firestore
      firestoreResult = await createLaborPaymentLedgerTransaction(
        paymentData,
        groupData,
        userId || paymentData.user_id || 'system',
        firmId
      )

      if (firestoreResult.success) {
        syncStatus = 'synced'

        // Update payment record with Firestore sync details
        await supabase
          .from('payment_records')
          .update({
            firestore_sync_status: 'synced',
            firestore_doc_id: firestoreResult.expenseId,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId)

        console.log('✅ Labor payment synced to Firestore successfully:', {
          paymentId: paymentId,
          groupName: groupData.name,
          amount: paymentData.amount,
          ledgerId: firestoreResult.ledgerId,
          expenseId: firestoreResult.expenseId,
          isUpdate: firestoreResult.isUpdate
        })
      }
    } catch (error) {
      console.error('❌ Error syncing labor payment to Firestore:', error)
      syncError = error.message

      // Update payment record with failed sync status
      try {
        await supabase
          .from('payment_records')
          .update({
            firestore_sync_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId)
      } catch (updateError) {
        console.error('Failed to update payment sync status:', updateError)
      }
    }

    // Return response
    return {
      success: syncStatus === 'synced',
      data: {
        payment: paymentData,
        group: groupData,
        firestore: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: firestoreResult,
          error: syncError
        }
      },
      message: syncStatus === 'synced'
        ? `Payment synced to Firestore successfully`
        : `Firestore sync failed: ${syncError}`
    }

  } catch (error) {
    console.error('Error in sync-firestore payment:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to sync payment to Firestore'
    })
  }
})
