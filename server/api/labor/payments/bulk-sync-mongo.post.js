import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'
import { postLaborPaymentsToLedgerMongo } from '../../../utils/laborLedgerMongo'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting bulk-sync-mongo payments...')

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

    console.log('📋 [MONGODB API DEBUG] Request parameters:', {
      limit,
      offset,
      syncStatus,
      firmId,
      userId
    })

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

    // Build query for payments to sync
    let paymentsQuery = supabase
      .from('payment_records')
      .select('*')
      .eq('firm_id', firmId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    // Add sync status filter if specified
    if (syncStatus !== 'all') {
      paymentsQuery = paymentsQuery.eq('mongo_sync_status', syncStatus)
    }

    console.log('🔍 [MONGODB API DEBUG] Fetching payments to sync...')
    const { data: payments, error: paymentsError } = await paymentsQuery

    if (paymentsError) {
      console.error('❌ [MONGODB API DEBUG] Failed to fetch payments:', paymentsError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch payments: ${paymentsError.message}`
      })
    }

    if (!payments || payments.length === 0) {
      console.log('ℹ️ [MONGODB API DEBUG] No payments found to sync')
      return {
        success: true,
        data: {
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0,
          results: []
        },
        message: 'No payments found to sync'
      }
    }

    console.log('✅ [MONGODB API DEBUG] Found payments to sync:', payments.length)

    // Get unique group IDs to fetch group data efficiently
    const groupIds = [...new Set(payments.map(p => p.group_id))]
    console.log('🔍 [MONGODB API DEBUG] Fetching group data for groupIds:', groupIds)

    const { data: groups, error: groupsError } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .in('id', groupIds)

    if (groupsError) {
      console.error('❌ [MONGODB API DEBUG] Failed to fetch groups:', groupsError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch groups: ${groupsError.message}`
      })
    }

    // Create a map for quick group lookup
    const groupMap = new Map(groups.map(g => [g.id, g]))
    console.log('✅ [MONGODB API DEBUG] Group data fetched:', groups.length)

    // Prepare payments with group data for MongoDB sync
    const paymentsWithGroups = payments
      .map(payment => {
        const group = groupMap.get(payment.group_id)
        if (!group) {
          console.warn('⚠️ [MONGODB API DEBUG] Group not found for payment:', {
            paymentId: payment.id,
            groupId: payment.group_id
          })
          return null
        }
        return { payment, group }
      })
      .filter(Boolean)

    console.log('✅ [MONGODB API DEBUG] Prepared payments with groups:', paymentsWithGroups.length)

    // Sync to MongoDB
    console.log('🗄️ [MONGODB API DEBUG] Starting MongoDB bulk sync process...')
    let mongoResult = null
    let syncError = null

    try {
      console.log('🗄️ [MONGODB API DEBUG] Calling postLaborPaymentsToLedgerMongo with:', {
        paymentCount: paymentsWithGroups.length,
        userId: userId || 'system',
        firmId
      })

      // Bulk sync to MongoDB
      mongoResult = await postLaborPaymentsToLedgerMongo(
        paymentsWithGroups,
        firmId,
        userId || 'system'
      )

      console.log('🗄️ [MONGODB API DEBUG] postLaborPaymentsToLedgerMongo result:', mongoResult)

      if (mongoResult.success) {
        console.log('🗄️ [MONGODB API DEBUG] MongoDB bulk sync successful!')
        console.log('  📊 Total processed:', mongoResult.successCount + mongoResult.failureCount)
        console.log('  ✅ Success count:', mongoResult.successCount)
        console.log('  ❌ Failure count:', mongoResult.failureCount)

        // Update sync status for successful payments
        const successfulPayments = mongoResult.results
          .filter(r => r.success)
          .map(r => r.paymentId)

        if (successfulPayments.length > 0) {
          console.log('💾 [MONGODB API DEBUG] Updating sync status for successful payments...')
          const { error: updateError } = await supabase
            .from('payment_records')
            .update({
              mongo_sync_status: 'synced',
              updated_at: new Date().toISOString()
            })
            .eq('firm_id', firmId)
            .in('id', successfulPayments)

          if (updateError) {
            console.error('⚠️ [MONGODB API DEBUG] Failed to update sync status for successful payments:', updateError)
          } else {
            console.log('✅ [MONGODB API DEBUG] Sync status updated for successful payments')
          }
        }

        // Update sync status for failed payments
        const failedPayments = mongoResult.results
          .filter(r => !r.success)
          .map(r => r.paymentId)

        if (failedPayments.length > 0) {
          console.log('💾 [MONGODB API DEBUG] Updating sync status for failed payments...')
          const { error: updateError } = await supabase
            .from('payment_records')
            .update({
              mongo_sync_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('firm_id', firmId)
            .in('id', failedPayments)

          if (updateError) {
            console.error('⚠️ [MONGODB API DEBUG] Failed to update sync status for failed payments:', updateError)
          } else {
            console.log('✅ [MONGODB API DEBUG] Sync status updated for failed payments')
          }
        }

        console.log('✅ [MONGODB API DEBUG] Labor payments bulk synced to MongoDB successfully')
      } else {
        console.error('❌ [MONGODB API DEBUG] MongoDB bulk sync failed - success flag is false:', mongoResult)
        syncError = 'MongoDB bulk sync returned success: false'
      }
    } catch (error) {
      console.error('❌ [MONGODB API DEBUG] Error syncing labor payments to MongoDB:', error)
      console.error('❌ [MONGODB API DEBUG] Error stack:', error.stack)
      syncError = error.message
    }

    // Return comprehensive response
    const responseData = {
      success: mongoResult?.success || false,
      data: {
        totalProcessed: payments.length,
        successCount: mongoResult?.successCount || 0,
        failureCount: mongoResult?.failureCount || payments.length,
        results: mongoResult?.results || [],
        mongo: {
          synced: mongoResult?.success || false,
          result: mongoResult,
          error: syncError
        }
      },
      message: mongoResult?.success
        ? `Bulk sync completed: ${mongoResult.successCount} successful, ${mongoResult.failureCount} failed`
        : `Bulk sync failed: ${syncError}`
    }

    console.log('📤 [MONGODB API DEBUG] Final API response:', {
      success: responseData.success,
      totalProcessed: responseData.data.totalProcessed,
      successCount: responseData.data.successCount,
      failureCount: responseData.data.failureCount,
      mongoSynced: responseData.data.mongo.synced,
      message: responseData.message
    })

    return responseData

  } catch (error) {
    console.error('❌ [MONGODB API DEBUG] Critical error in bulk-sync-mongo payments:', error)
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
      statusMessage: error.message || 'Failed to bulk sync payments with MongoDB'
    })
  }
})
