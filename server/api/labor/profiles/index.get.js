import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { groupId, search } = query

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

    // Initialize Supabase client
    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    // Build query
    let supabaseQuery = supabase
      .from('labor_profiles')
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
      .eq('firm_id', firmId)
      .eq('is_active', true)

    // Apply filters
    if (groupId) {
      supabaseQuery = supabaseQuery.eq('group_id', groupId)
    }
    
    if (search) {
      supabaseQuery = supabaseQuery.ilike('name', `%${search}%`)
    }

    const { data, error } = await supabaseQuery.order('name')

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }

    return {
      success: true,
      data: data || [],
      count: data?.length || 0
    }
  } catch (error) {
    console.error('Error fetching labor profiles:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch labor profiles'
    })
  }
})