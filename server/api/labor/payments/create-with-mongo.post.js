import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentLedgerTransactionMongo } from '../../../utils/laborLedgerMongo'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting create-with-mongo payment...')

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const body = await readBody(event)
    const { groupId, paymentDate, amount, project, paymentMethod, paymentType } = body
    const firmId = user.firmId
    const userId = user._id
    console.log('📋 [MONGODB API DEBUG] Request body received:', {
      groupId,
      paymentDate,
      amount,
      project,
      paymentMethod,
      paymentType,
      firmId,
      userId
    })

    if (!groupId || !paymentDate || !amount || !firmId) {
      console.error('❌ [MONGODB API DEBUG] Missing required fields')
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: groupId, paymentDate, amount, firmId are required'
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

    console.log('✅ [MONGODB API DEBUG] Supabase config found:', {
      configName: config.configName,
      supabaseUrl: config.supabaseUrl,
      isActive: config.isActive
    })

    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    console.log('🔍 [MONGODB API DEBUG] Fetching labor group data for groupId:', groupId)

    // First, verify the group exists and get its details
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

    // Prepare payment data
    const paymentData = {
      group_id: groupId,
      payment_date: paymentDate,
      amount: Number(amount),
      project: project || null,
      payment_method: paymentMethod === 'cash' ? 'cash' : 'bank',
      payment_type: paymentType || 'Payment',
      bank_details: paymentMethod === 'cash' ? {} : { bankId: paymentMethod },
      firm_id: firmId,
      user_id: userId || null,
      mongo_sync_status: 'pending', // Will be updated after MongoDB sync
      mongo_doc_id: null
    }

    console.log('💾 [MONGODB API DEBUG] Prepared payment data for Supabase:', paymentData)

    // Create payment record in Supabase
    console.log('💾 [MONGODB API DEBUG] Creating payment record in Supabase...')
    const { data: createdPayment, error: paymentError } = await supabase
      .from('payment_records')
      .insert([paymentData])
      .select()
      .single()

    if (paymentError) {
      console.error('❌ [MONGODB API DEBUG] Failed to create payment in Supabase:', paymentError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create payment record: ${paymentError.message}`
      })
    }

    console.log('✅ [MONGODB API DEBUG] Payment created in Supabase successfully:', {
      id: createdPayment.id,
      amount: createdPayment.amount,
      groupId: createdPayment.group_id,
      syncStatus: createdPayment.mongo_sync_status
    })

    // Now sync to MongoDB
    console.log('🗄️ [MONGODB API DEBUG] Starting MongoDB sync process...')
    let mongoResult = null
    let syncStatus = 'failed'
    let syncError = null

    try {
      console.log('🗄️ [MONGODB API DEBUG] Calling createLaborPaymentLedgerTransactionMongo with:', {
        paymentId: createdPayment.id,
        groupName: groupData.name,
        amount: createdPayment.amount,
        userId: userId || 'system',
        firmId
      })

      // Create ledger transaction and expense in MongoDB
      mongoResult = await createLaborPaymentLedgerTransactionMongo(
        createdPayment,
        groupData,
        userId || 'system',
        firmId
      )

      console.log('🗄️ [MONGODB API DEBUG] createLaborPaymentLedgerTransactionMongo result:', mongoResult)

      if (mongoResult.success) {
        syncStatus = 'synced'

        console.log('🗄️ [MONGODB API DEBUG] MongoDB sync successful! Collections created:')
        console.log('  📊 expenses collection - Document ID:', mongoResult.expenseId)
        console.log('  💰 ledgers collection - Document ID:', mongoResult.ledgerId)
        console.log('  📝 ledgerTransactions collection - Document ID:', mongoResult.transactionId)
        console.log('  🆕 New ledger created:', !mongoResult.isUpdate)
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
          .eq('id', createdPayment.id)

        if (updateResult.error) {
          console.error('⚠️ [MONGODB API DEBUG] Failed to update payment sync status in Supabase:', updateResult.error)
        } else {
          console.log('✅ [MONGODB API DEBUG] Payment sync status updated in Supabase')
        }

        console.log('✅ [MONGODB API DEBUG] Labor payment synced to MongoDB successfully:', {
          paymentId: createdPayment.id,
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
          .eq('id', createdPayment.id)
        console.log('✅ [MONGODB API DEBUG] Payment record updated with failed status')
      } catch (updateError) {
        console.error('❌ [MONGODB API DEBUG] Failed to update payment sync status:', updateError)
      }
    }

    // Return comprehensive response
    const responseData = {
      success: true,
      data: {
        payment: createdPayment,
        group: groupData,
        mongo: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: mongoResult,
          error: syncError
        }
      },
      message: syncStatus === 'synced'
        ? `Payment created and synced to MongoDB successfully`
        : `Payment created but MongoDB sync failed: ${syncError}`
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
    console.error('❌ [MONGODB API DEBUG] Critical error in create-with-mongo payment:', error)
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
      statusMessage: error.message || 'Failed to create payment with MongoDB integration'
    })
  }
})
