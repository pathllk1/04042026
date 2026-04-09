import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransaction } from '~~/server/utils/ledgerTransactions'

export default defineEventHandler(async (event) => {
  try {
    const paymentId = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { 
      groupId, 
      paymentDate, 
      amount, 
      project, 
      paymentMethod, 
      paymentType
    } = body

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

    // Validate amount if provided
    if (amount !== undefined && Number(amount) <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Amount must be greater than 0'
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

    // Get existing payment
    const { data: existingPayment, error: existingError } = await supabase
      .from('payment_records')
      .select('*')
      .eq('id', paymentId)
      .eq('firm_id', firmId)
      .single()

    if (existingError || !existingPayment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Payment not found'
      })
    }

    // Prepare update data (only include fields that are provided)
    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (groupId !== undefined) updateData.group_id = groupId
    if (paymentDate !== undefined) updateData.payment_date = paymentDate
    if (amount !== undefined) updateData.amount = Number(amount)
    if (project !== undefined) updateData.project = project
    if (paymentMethod !== undefined) {
      updateData.payment_method = paymentMethod === 'cash' ? 'cash' : 'bank'
      updateData.bank_details = paymentMethod === 'cash' ? {} : { bankId: paymentMethod }
    }
    if (paymentType !== undefined) updateData.payment_type = paymentType
    if (userId !== undefined) updateData.user_id = userId

    // Update payment in Supabase
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payment_records')
      .update(updateData)
      .eq('id', paymentId)
      .eq('firm_id', firmId)
      .select()
      .single()

    if (updateError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update payment: ${updateError.message}`
      })
    }

    // Get group details (use updated group_id if changed, otherwise existing)
    const targetGroupId = groupId || existingPayment.group_id
    const { data: groupData, error: groupError } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('id', targetGroupId)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .single()

    if (groupError || !groupData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor group not found or inactive'
      })
    }

    // Update Firestore if payment was previously synced or if explicitly requested
    let firestoreResult = null
    let syncStatus = updatedPayment.firestore_sync_status
    let syncError = null

    if (existingPayment.firestore_sync_status === 'synced' || body.syncToFirestore) {
      try {
        // Update ledger transaction and expense in Firestore
        firestoreResult = await createLaborPaymentLedgerTransaction(
          updatedPayment,
          groupData,
          userId || updatedPayment.user_id || 'system',
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

          console.log('✅ Labor payment updated and synced to Firestore:', {
            paymentId: paymentId,
            groupName: groupData.name,
            amount: updatedPayment.amount,
            ledgerId: firestoreResult.ledgerId,
            expenseId: firestoreResult.expenseId,
            isUpdate: firestoreResult.isUpdate
          })
        }
      } catch (error) {
        console.error('❌ Error syncing updated payment to Firestore:', error)
        syncError = error.message
        syncStatus = 'failed'
        
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
    }

    return {
      success: true,
      data: {
        payment: {
          ...updatedPayment,
          firestore_sync_status: syncStatus
        },
        group: groupData,
        firestore: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: firestoreResult,
          error: syncError
        }
      },
      message: syncError 
        ? `Payment updated but Firestore sync failed: ${syncError}`
        : 'Payment updated successfully'
    }

  } catch (error) {
    console.error('Error in update-with-firestore payment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update payment with Firestore integration'
    })
  }
})
