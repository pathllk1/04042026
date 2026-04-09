import SupabaseConfig from '~~/server/models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { createLaborPaymentDeletionTransactionMongo } from '~~/server/utils/laborLedgerMongo'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting delete-with-mongo payment...')

    const paymentId = getRouterParam(event, 'id')

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

    if (!paymentId || !firmId) {
      console.error('❌ [MONGODB API DEBUG] Missing required fields')
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: paymentId, firmId are required'
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

    // First, get the existing payment to check if it exists and get group details
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
    console.log('🔍 [MONGODB API DEBUG] Fetching labor group data for groupId:', existingPayment.group_id)
    const { data: groupData, error: groupError } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('id', existingPayment.group_id)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .single()

    if (groupError || !groupData) {
      console.error('❌ [MONGODB API DEBUG] Labor group not found:', {
        groupId: existingPayment.group_id,
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

    // Now sync deletion to MongoDB
    console.log('🗄️ [MONGODB API DEBUG] Starting MongoDB deletion sync process...')
    let mongoResult = null
    let syncStatus = 'failed'
    let syncError = null

    try {
      console.log('🗄️ [MONGODB API DEBUG] Calling createLaborPaymentDeletionTransactionMongo with:', {
        paymentId: existingPayment.id,
        groupName: groupData.name,
        amount: existingPayment.amount,
        userId: userId || 'system',
        firmId
      })

      // Delete ledger transaction and expense in MongoDB
      mongoResult = await createLaborPaymentDeletionTransactionMongo(
        existingPayment,
        groupData,
        userId || 'system',
        firmId
      )

      console.log('🗄️ [MONGODB API DEBUG] createLaborPaymentDeletionTransactionMongo result:', mongoResult)

      if (mongoResult.success) {
        syncStatus = 'synced'

        console.log('🗄️ [MONGODB API DEBUG] MongoDB deletion sync successful!')
        console.log('  📊 expenses collection - Document deleted')
        console.log('  📝 ledgerTransactions collection - Document deleted')
        console.log('  💰 ledgers collection - Balance reversed')

        // Now delete from Supabase
        console.log('💾 [MONGODB API DEBUG] Deleting payment record from Supabase...')
        const { error: deleteError } = await supabase
          .from('payment_records')
          .delete()
          .eq('id', paymentId)
          .eq('firm_id', firmId)

        if (deleteError) {
          console.error('❌ [MONGODB API DEBUG] Failed to delete payment from Supabase:', deleteError)
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to delete payment record: ${deleteError.message}`
          })
        }

        console.log('✅ [MONGODB API DEBUG] Payment deleted from Supabase successfully')

        console.log('✅ [MONGODB API DEBUG] Labor payment deleted and synced to MongoDB successfully:', {
          paymentId: existingPayment.id,
          groupName: groupData.name,
          amount: existingPayment.amount,
          reversedAmount: mongoResult.reversedAmount
        })
      } else {
        console.error('❌ [MONGODB API DEBUG] MongoDB deletion sync failed - success flag is false:', mongoResult)
        syncError = 'MongoDB transaction returned success: false'
      }
    } catch (error) {
      console.error('❌ [MONGODB API DEBUG] Error syncing labor payment deletion to MongoDB:', error)
      console.error('❌ [MONGODB API DEBUG] Error stack:', error.stack)
      syncError = error.message
    }

    // Return comprehensive response
    const responseData = {
      success: syncStatus === 'synced',
      data: {
        payment: existingPayment,
        group: groupData,
        mongo: {
          synced: syncStatus === 'synced',
          status: syncStatus,
          result: mongoResult,
          error: syncError
        }
      },
      message: syncStatus === 'synced'
        ? `Payment deleted and synced to MongoDB successfully`
        : `Payment deletion failed: ${syncError}`
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
    console.error('❌ [MONGODB API DEBUG] Critical error in delete-with-mongo payment:', error)
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
      statusMessage: error.message || 'Failed to delete payment with MongoDB integration'
    })
  }
})
