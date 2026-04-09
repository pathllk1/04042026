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

    // Initialize Supabase client
    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    // Get groups
    console.log('Fetching groups for firmId:', firmId)
    const { data: groups, error } = await supabase
      .from('labor_groups')
      .select('*')
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .order('name')

    if (error) {
        console.error('Error fetching groups from Supabase:', error)
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }
    
    console.log('Groups fetched from Supabase:', groups)

    // Get profile counts for each group
    const groupsWithCounts = await Promise.all(
      (groups || []).map(async (group) => {
        const { count } = await supabase
          .from('labor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('is_active', true)

        return {
          ...group,
          profile_count: count || 0
        }
      })
    )
    
    console.log('Groups with counts:', groupsWithCounts)

    return {
      success: true,
      data: groupsWithCounts,
      count: groupsWithCounts.length
    }
  } catch (error) {
    console.error('Error fetching labor groups:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch labor groups'
    })
  }
})