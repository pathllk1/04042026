import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransactionMongo } from '~~/server/utils/laborLedgerMongo'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting update-with-mongo payment...')

    const paymentId = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { groupId, paymentDate, amount, project, paymentMethod, paymentType } = body

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
      groupId,
      paymentDate,
      amount,
      project,
      paymentMethod,
      paymentType,
      firmId,
      userId
    })

    if (!paymentId || !groupId || !paymentDate || !amount || !firmId) {
      console.error('❌ [MONGODB API DEBUG] Missing required fields')
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: paymentId, groupId, paymentDate, amount, firmId are required'
      })
    }

    // Validate amount is positive
    if (Number(amount) <= 0) {
      console.error('❌ [MONGODB API DEBUG] Invalid amount:', amount)
      throw createError({
        statusCode: 400,
        statusMessage: 'Amount must be greater than 0'
      })
    }

    console.log('✅ [MONGODB API DEBUG] Input validation passed')

    // Get active Supabase configuration
    console.log('🔍 [MONGODB API DEBUG] Looking for Supabase config for firmId:', firmId)
    const config = await SupabaseConfig.findOne({
      firmId,
      isActive: true
    })

    if (!config) {
      console.error('❌ [MONGODB API DEBUG] No active Supabase configuration found for firmId:', firmId)
      throw createError({
        statusCode: 404,
        statusMessage: 'No active Supabase configuration found'
      })
    }

    console.log('✅ [MONGODB API DEBUG] Supabase config found')

    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    // First, get the existing payment to check if it exists
    console.log('🔍 [MONGODB API DEBUG] Fetching existing payment data for paymentId:', paymentId)
    const { data: existingPayment, error: fetchError } = await supabase
      .from('payment_records')
      .select('*')
      .eq('id', paymentId)
      .eq('firm_id', firmId)
      .single()

    if (fetchError || !existingPayment) {
      console.error('❌ [MONGODB API DEBUG] Payment not found:', {
        paymentId,
        firmId,
        error: fetchError?.message
      })
      throw createError({
        statusCode: 404,
        statusMessage: 'Payment not found'
      })
    }

    console.log('✅ [MONGODB API DEBUG] Existing payment found:', {
      id: existingPayment.id,
      amount: existingPayment.amount,
      groupId: existingPayment.group_id
    })

    // Get labor group details
    console.log('🔍 [MONGODB API DEBUG] Fetching labor group data for groupId:', groupId)
    const { data: groupData, error: groupError } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('id', groupId)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .single()

    if (groupError || !groupData) {
      console.error('❌ [MONGODB API DEBUG] Labor group not found:', {
        groupId,
        firmId,
        error: groupError?.message
      })
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor group not found or inactive'
      })
    }

    console.log('✅ [MONGODB API DEBUG] Labor group found:', {
      id: groupData.id,
      name: groupData.name,
      isActive: groupData.is_active
    })

    // Prepare updated payment data
    const updatedPaymentData = {
      group_id: groupId,
      payment_date: paymentDate,
      amount: Number(amount),
      project: project || null,
      payment_method: paymentMethod === 'cash' ? 'cash' : 'bank',
      payment_type: paymentType || 'Payment',
      bank_details: paymentMethod === 'cash' ? {} : { bankId: paymentMethod },
      mongo_sync_status: 'pending', // Will be updated after MongoDB sync
      updated_at: new Date().toISOString()
    }

    console.log('💾 [MONGODB API DEBUG] Prepared updated payment data for Supabase:', updatedPaymentData)

    // Update payment record in Supabase
    console.log('💾 [MONGODB API DEBUG] Updating payment record in Supabase...')
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payment_records')
      .update(updatedPaymentData)
      .eq('id', paymentId)
      .eq('firm_id', firmId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ [MONGODB API DEBUG] Failed to update payment in Supabase:', updateError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update payment record: ${updateError.message}`
      })
    }

    console.log('✅ [MONGODB API DEBUG] Payment updated in Supabase successfully:', {
      id: updatedPayment.id,
      amount: updatedPayment.amount,
      groupId: updatedPayment.group_id,
      syncStatus: updatedPayment.mongo_sync_status
    })

    // Now sync to MongoDB
    console.log('🗄️ [MONGODB API DEBUG] Starting MongoDB sync process...')
    let mongoResult = null
    let syncStatus = 'failed'
    let syncError = null

    try {
      console.log('🗄️ [MONGODB API DEBUG] Calling createLaborPaymentLedgerTransactionMongo with:', {
        paymentId: updatedPayment.id,
        groupName: groupData.name,
        amount: updatedPayment.amount,
        userId: userId || 'system',
        firmId
      })

      // Update ledger transaction and expense in MongoDB
      mongoResult = await createLaborPaymentLedgerTransactionMongo(
        updatedPayment,
        groupData,
        userId || 'system',
        firmId
      )

      console.log('🗄️ [MONGODB API DEBUG] createLaborPaymentLedgerTransactionMongo result:', mongoResult)

      if (mongoResult.success) {
        syncStatus = 'synced'

        console.log('🗄️ [MONGODB API DEBUG] MongoDB sync successful! Collections updated:')
        console.log('  📊 expenses collection - Document ID:', mongoResult.expenseId)
        console.log('  💰 ledgers collection - Document ID:', mongoResult.ledgerId)
        console.log('  📝 ledgerTransactions collection - Document ID:', mongoResult.transactionId)
        console.log('  🔄 Is update operation:', mongoResult.isUpdate)

        // Update payment record with MongoDB sync details
        console.log('💾 [MONGODB API DEBUG] Updating Supabase payment record with sync status...')
        const syncUpdateResult = await supabase
          .from('payment_records')
          .update({
            mongo_sync_status: 'synced',
            mongo_doc_id: mongoResult.expenseId,
            updated_at: new Date().toISOString()
          })
          .eq('id', updatedPayment.id)

        if (syncUpdateResult.error) {
          console.error('⚠️ [MONGODB API DEBUG] Failed to update payment sync status in Supabase:', syncUpdateResult.error)
        } else {
          console.log('✅ [MONGODB API DEBUG] Payment sync status updated in Supabase')
        }

        console.log('✅ [MONGODB API DEBUG] Labor payment synced to MongoDB successfully:', {
          paymentId: updatedPayment.id,
          groupName: groupData.name,
          amount: amount,
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
          .eq('id', updatedPayment.id)
        console.log('✅ [MONGODB API DEBUG] Payment record updated with failed status')
      } catch (updateError) {
        console.error('❌ [MONGODB API DEBUG] Failed to update payment sync status:', updateError)
      }
    }

    // Return comprehensive response
    const responseData = {
      success: true,
      data: {
        payment: updatedPayment,
        group: groupData,
        mongo: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: mongoResult,
          error: syncError
        }
      },
      message: syncStatus === 'synced'
        ? `Payment updated and synced to MongoDB successfully`
        : `Payment updated but MongoDB sync failed: ${syncError}`
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
    console.error('❌ [MONGODB API DEBUG] Critical error in update-with-mongo payment:', error)
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
      statusMessage: error.message || 'Failed to update payment with MongoDB integration'
    })
  }
})
