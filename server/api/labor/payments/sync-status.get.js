import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
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

    // Get sync status counts
    const { data: statusCounts, error: statusError } = await supabase
      .from('payment_records')
      .select('firestore_sync_status')
      .eq('firm_id', firmId)

    if (statusError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch sync status: ${statusError.message}`
      })
    }

    // Count by status
    const counts = {
      total: statusCounts.length,
      pending: 0,
      synced: 0,
      failed: 0
    }

    statusCounts.forEach(record => {
      const status = record.firestore_sync_status || 'pending'
      if (counts.hasOwnProperty(status)) {
        counts[status]++
      }
    })

    // Get recent failed payments for debugging
    const { data: recentFailed, error: failedError } = await supabase
      .from('payment_records')
      .select(`
        id,
        amount,
        payment_date,
        payment_type,
        firestore_sync_status,
        updated_at,
        labor_groups!inner(name)
      `)
      .eq('firm_id', firmId)
      .eq('firestore_sync_status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (failedError) {
      console.error('Error fetching recent failed payments:', failedError)
    }

    // Get recent successful syncs
    const { data: recentSynced, error: syncedError } = await supabase
      .from('payment_records')
      .select(`
        id,
        amount,
        payment_date,
        payment_type,
        firestore_sync_status,
        firestore_doc_id,
        updated_at,
        labor_groups!inner(name)
      `)
      .eq('firm_id', firmId)
      .eq('firestore_sync_status', 'synced')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (syncedError) {
      console.error('Error fetching recent synced payments:', syncedError)
    }

    return {
      success: true,
      data: {
        summary: counts,
        recentFailed: recentFailed || [],
        recentSynced: recentSynced || []
      },
      message: 'Sync status retrieved successfully'
    }

  } catch (error) {
    console.error('Error getting sync status:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to get sync status'
    })
  }
})
