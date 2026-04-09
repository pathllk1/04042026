import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    console.log('🚀 [MONGODB API DEBUG] Starting sync-status-mongo...')

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const query = getQuery(event)

    console.log('📋 [MONGODB API DEBUG] Request parameters:', {
      firmId,
      query
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

    // Get sync status summary
    console.log('🔍 [MONGODB API DEBUG] Fetching sync status summary...')
    
    // First, check if mongo_sync_status field exists by trying a simple query
    console.log('🔍 [MONGODB API DEBUG] Checking if mongo_sync_status field exists...')
    const { data: testData, error: testError } = await supabase
      .from('payment_records')
      .select('id, mongo_sync_status')
      .eq('firm_id', firmId)
      .limit(1)

    // If mongo_sync_status field doesn't exist, use firestore_sync_status as fallback
    let syncStatusField = 'mongo_sync_status'
    if (testError && testError.message.includes('column')) {
      syncStatusField = 'firestore_sync_status'
      console.log('⚠️ [MONGODB API DEBUG] mongo_sync_status field not found, falling back to firestore_sync_status')
      
      // Test if firestore_sync_status also exists
      const { data: testFirestoreData, error: testFirestoreError } = await supabase
        .from('payment_records')
        .select('id, firestore_sync_status')
        .eq('firm_id', firmId)
        .limit(1)
      
      if (testFirestoreError && testFirestoreError.message.includes('column')) {
        console.log('⚠️ [MONGODB API DEBUG] Neither mongo_sync_status nor firestore_sync_status fields exist, using default values')
        // Return default response if no sync status fields exist
        return {
          success: true,
          data: {
            summary: {
              total: 0,
              pending: 0,
              synced: 0,
              failed: 0,
              syncPercentage: 0
            },
            recentActivities: [],
            failedPayments: [],
            lastUpdated: new Date().toISOString()
          },
          message: 'No sync status fields found in database. Please ensure payment records have sync status fields.'
        }
      }
    }
    console.log('🔍 [MONGODB API DEBUG] Using sync status field:', syncStatusField)
    
    // Count payments by sync status using correct Supabase syntax
    const { count: pendingCount, error: pendingError } = await supabase
      .from('payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq(syncStatusField, 'pending')

    const { count: syncedCount, error: syncedError } = await supabase
      .from('payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq(syncStatusField, 'synced')

    const { count: failedCount, error: failedError } = await supabase
      .from('payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq(syncStatusField, 'failed')

    const { count: totalCount, error: totalError } = await supabase
      .from('payment_records')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)

    if (pendingError || syncedError || failedError || totalError) {
      console.error('❌ [MONGODB API DEBUG] Failed to fetch sync status counts:', {
        pendingError: pendingError?.message,
        syncedError: syncedError?.message,
        failedError: failedError?.message,
        totalError: totalError?.message
      })
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch sync status counts'
      })
    }

    // Get recent sync activities (last 10 payments with sync status)
    console.log('🔍 [MONGODB API DEBUG] Fetching recent sync activities...')
    
    // Build select fields dynamically based on what exists
    let selectFields = `
      id,
      amount,
      payment_date,
      ${syncStatusField},
      updated_at,
      labor_groups!inner(name)
    `
    
    // Only include doc_id fields if they exist (we'll test this)
    try {
      const { data: testDocId, error: testDocIdError } = await supabase
        .from('payment_records')
        .select('mongo_doc_id, firestore_doc_id')
        .eq('firm_id', firmId)
        .limit(1)
      
      if (!testDocIdError) {
        selectFields = `
          id,
          amount,
          payment_date,
          ${syncStatusField},
          mongo_doc_id,
          firestore_doc_id,
          updated_at,
          labor_groups!inner(name)
        `
        console.log('✅ [MONGODB API DEBUG] Doc ID fields exist, including them in query')
      } else {
        console.log('⚠️ [MONGODB API DEBUG] Doc ID fields do not exist, excluding them from query')
      }
    } catch (error) {
      console.log('⚠️ [MONGODB API DEBUG] Could not test doc ID fields, excluding them from query')
    }
    
    const { data: recentPayments, error: recentError } = await supabase
      .from('payment_records')
      .select(selectFields)
      .eq('firm_id', firmId)
      .not(syncStatusField, 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (recentError) {
      console.error('❌ [MONGODB API DEBUG] Failed to fetch recent payments:', recentError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch recent sync activities'
      })
    }

    // Get failed payments for retry
    console.log('🔍 [MONGODB API DEBUG] Fetching failed payments for retry...')
    const { data: failedPayments, error: failedPaymentsError } = await supabase
      .from('payment_records')
      .select(`
        id,
        amount,
        payment_date,
        ${syncStatusField},
        updated_at,
        labor_groups!inner(name)
      `)
      .eq('firm_id', firmId)
      .eq(syncStatusField, 'failed')
      .order('updated_at', { ascending: false })
      .limit(5)

    if (failedPaymentsError) {
      console.error('❌ [MONGODB API DEBUG] Failed to fetch failed payments:', failedPaymentsError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch failed payments'
      })
    }

    // Calculate sync percentage
    const total = totalCount || 0
    const synced = syncedCount || 0
    const syncPercentage = total > 0 ? Math.round((synced / total) * 100) : 0

    // Prepare response data
    const responseData = {
      success: true,
      data: {
        summary: {
          total: total,
          pending: pendingCount || 0,
          synced: synced,
          failed: failedCount || 0,
          syncPercentage: syncPercentage
        },
        recentActivities: recentPayments?.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          paymentDate: payment.payment_date,
          groupName: payment.labor_groups?.name,
          syncStatus: payment[syncStatusField],
          mongoDocId: payment.mongo_doc_id || null,
          firestoreDocId: payment.firestore_doc_id || null,
          updatedAt: payment.updated_at
        })) || [],
        failedPayments: failedPayments?.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          paymentDate: payment.payment_date,
          groupName: payment.labor_groups?.name,
          updatedAt: payment.updated_at
        })) || [],
        lastUpdated: new Date().toISOString()
      },
      message: `Sync status retrieved successfully. ${syncPercentage}% of payments synced to MongoDB.`
    }

    console.log('✅ [MONGODB API DEBUG] Sync status summary:', {
      total: responseData.data.summary.total,
      pending: responseData.data.summary.pending,
      synced: responseData.data.summary.synced,
      failed: responseData.data.summary.failed,
      syncPercentage: responseData.data.summary.syncPercentage,
      recentActivitiesCount: responseData.data.recentActivities.length,
      failedPaymentsCount: responseData.data.failedPayments.length
    })

    return responseData

  } catch (error) {
    console.error('❌ [MONGODB API DEBUG] Critical error in sync-status-mongo:', error)
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
      statusMessage: error.message || 'Failed to get sync status'
    })
  }
})
