import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentDeletionTransaction } from '~~/server/utils/ledgerTransactions'

export default defineEventHandler(async (event) => {
  try {
    const paymentId = getRouterParam(event, 'id')
    const query = getQuery(event)
    
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

    // Get payment details before deletion
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
      .single()

    if (groupError || !groupData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor group not found'
      })
    }

    // First, clean up Firestore entries if the payment was synced
    let firestoreResult = null
    let firestoreError = null

    if (paymentData.firestore_sync_status === 'synced') {
      try {
        firestoreResult = await createLaborPaymentDeletionTransaction(
          paymentData,
          groupData,
          userId || paymentData.user_id || 'system',
          firmId
        )

        console.log('✅ Firestore cleanup completed for payment:', {
          paymentId: paymentId,
          groupName: groupData.name,
          amount: paymentData.amount,
          result: firestoreResult
        })
      } catch (error) {
        console.error('❌ Error cleaning up Firestore for payment:', error)
        firestoreError = error.message
        
        // Don't fail the deletion if Firestore cleanup fails
        // Log the error and continue with Supabase deletion
      }
    }

    // Delete payment from Supabase
    const { error: deleteError } = await supabase
      .from('payment_records')
      .delete()
      .eq('id', paymentId)
      .eq('firm_id', firmId)

    if (deleteError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to delete payment: ${deleteError.message}`
      })
    }

    return {
      success: true,
      data: {
        deletedPayment: paymentData,
        group: groupData,
        firestore: {
          cleaned: firestoreResult?.success || false,
          result: firestoreResult,
          error: firestoreError
        }
      },
      message: firestoreError 
        ? `Payment deleted but Firestore cleanup failed: ${firestoreError}`
        : 'Payment deleted successfully with Firestore cleanup'
    }

  } catch (error) {
    console.error('Error in delete-with-firestore payment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to delete payment with Firestore cleanup'
    })
  }
})
