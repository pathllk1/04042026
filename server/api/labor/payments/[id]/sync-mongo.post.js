import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransactionMongo } from '~~/server/utils/laborLedgerMongo'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting sync-mongo payment...')

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

    console.log('📋 [MONGODB API DEBUG] Request parameters:', {
      paymentId,
      firmId,
      userId
    })

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

    console.log('✅ [MONGODB API DEBUG] Payment and group data retrieved:', {
      paymentId: paymentData.id,
      groupName: groupData.name,
      amount: paymentData.amount,
      currentSyncStatus: paymentData.mongo_sync_status
    })

    // Sync to MongoDB
    console.log('🗄️ [MONGODB API DEBUG] Starting MongoDB sync process...')
    let mongoResult = null
    let syncStatus = 'failed'
    let syncError = null

    try {
      console.log('🗄️ [MONGODB API DEBUG] Calling createLaborPaymentLedgerTransactionMongo with:', {
        paymentId: paymentData.id,
        groupName: groupData.name,
        amount: paymentData.amount,
        userId: userId || 'system',
        firmId
      })

      // Create/update ledger transaction and expense in MongoDB
      mongoResult = await createLaborPaymentLedgerTransactionMongo(
        paymentData,
        groupData,
        userId || 'system',
        firmId
      )

      console.log('🗄️ [MONGODB API DEBUG] createLaborPaymentLedgerTransactionMongo result:', mongoResult)

      if (mongoResult.success) {
        syncStatus = 'synced'

        console.log('🗄️ [MONGODB API DEBUG] MongoDB sync successful! Collections created/updated:')
        console.log('  📊 expenses collection - Document ID:', mongoResult.expenseId)
        console.log('  💰 ledgers collection - Document ID:', mongoResult.ledgerId)
        console.log('  📝 ledgerTransactions collection - Document ID:', mongoResult.transactionId)
        console.log('  🔄 Is update operation:', mongoResult.isUpdate)

        // Update payment record with MongoDB sync details
        console.log('💾 [MONGODB API DEBUG] Updating Supabase payment record with sync status...')
        const updateResult = await supabase
          .from('payment_records')
          .update({
            mongo_sync_status: 'synced',
            mongo_doc_id: mongoResult.expenseId,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentData.id)

        if (updateResult.error) {
          console.error('⚠️ [MONGODB API DEBUG] Failed to update payment sync status in Supabase:', updateResult.error)
        } else {
          console.log('✅ [MONGODB API DEBUG] Payment sync status updated in Supabase')
        }

        console.log('✅ [MONGODB API DEBUG] Labor payment synced to MongoDB successfully:', {
          paymentId: paymentData.id,
          groupName: groupData.name,
          amount: paymentData.amount,
          ledgerId: mongoResult.ledgerId,
          expenseId: mongoResult.expenseId,
          transactionId: mongoResult.transactionId
        })
      } else {
        console.error('❌ [MONGODB API DEBUG] MongoDB sync failed - success flag is false:', mongoResult)
        syncError = 'MongoDB transaction returned success: false'
      }
    } catch (error) {
      console.error('❌ [MONGODB API DEBUG] Error syncing labor payment to MongoDB:', error)
      console.error('❌ [MONGODB API DEBUG] Error stack:', error.stack)
      syncError = error.message

      // Update payment record with failed sync status
      console.log('💾 [MONGODB API DEBUG] Updating payment record with failed sync status...')
      try {
        await supabase
          .from('payment_records')
          .update({
            mongo_sync_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentData.id)
        console.log('✅ [MONGODB API DEBUG] Payment record updated with failed status')
      } catch (updateError) {
        console.error('❌ [MONGODB API DEBUG] Failed to update payment sync status:', updateError)
      }
    }

    // Return comprehensive response
    const responseData = {
      success: true,
      data: {
        payment: paymentData,
        group: groupData,
        mongo: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: mongoResult,
          error: syncError
        }
      },
      message: syncStatus === 'synced'
        ? `Payment synced to MongoDB successfully`
        : `Payment sync failed: ${syncError}`
    }

    console.log('📤 [MONGODB API DEBUG] Final API response:', {
      success: responseData.success,
      paymentId: responseData.data.payment.id,
      mongoSynced: responseData.data.mongo.synced,
      mongoStatus: responseData.data.mongo.status,
      mongoError: responseData.data.mongo.error,
      message: responseData.message
    })

    return responseData

  } catch (error) {
    console.error('❌ [MONGODB API DEBUG] Critical error in sync-mongo payment:', error)
    console.error('❌ [MONGODB API DEBUG] Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    })

    if (error.statusCode) {
      console.error('❌ [MONGODB API DEBUG] Throwing existing error with statusCode:', error.statusCode)
      throw error
    }

    console.error('❌ [MONGODB API DEBUG] Throwing generic 500 error')
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to sync payment with MongoDB'
    })
  }
})
