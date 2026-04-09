import { createClient } from '@supabase/supabase-js'
import SupabaseConfig from '../../../models/SupabaseConfig'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
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

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group ID is required'
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

    // Initialize Supabase client
    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    // Check if group exists and belongs to the firm
    const { data: existingGroup } = await supabase
      .from('labor_groups')
      .select('id, name')
      .eq('id', id)
      .eq('firm_id', firmId)
      .single()

    if (!existingGroup) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found'
      })
    }

    // Check if group has any labor profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('labor_profiles')
      .select('id')
      .eq('group_id', id)
      .eq('is_active', true)

    if (profilesError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error checking profiles: ${profilesError.message}`
      })
    }

    if (profiles && profiles.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Cannot delete group "${existingGroup.name}" because it has ${profiles.length} active labor profile(s). Please move or deactivate the profiles first.`
      })
    }

    // Check if group has any attendance records
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('id')
      .in('labor_id', await supabase
        .from('labor_profiles')
        .select('id')
        .eq('group_id', id)
      )
      .limit(1)

    if (attendanceError && attendanceError.code !== 'PGRST116') {
      console.warn('Error checking attendance records:', attendanceError)
    }

    // Soft delete the group (set is_active to false)
    const { data, error } = await supabase
      .from('labor_groups')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('firm_id', firmId)
      .select()
      .single()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }

    return {
      success: true,
      data,
      message: `Group "${existingGroup.name}" has been deactivated successfully`
    }
  } catch (error) {
    console.error('Error deleting group:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to delete group'
    })
  }
})
