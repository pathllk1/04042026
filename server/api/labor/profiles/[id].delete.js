import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

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
        statusMessage: 'Profile ID is required'
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

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('labor_profiles')
      .select('id, name')
      .eq('id', id)
      .eq('firm_id', firmId)
      .eq('is_active', true)
      .single()

    if (!existingProfile) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor profile not found'
      })
    }

    // Check if profile has attendance records
    const { data: attendanceRecords } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('labor_id', id)
      .limit(1)

    if (attendanceRecords && attendanceRecords.length > 0) {
      // Soft delete if there are attendance records
      const { data, error } = await supabase
        .from('labor_profiles')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
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
        message: 'Labor profile deactivated successfully (has attendance records)'
      }
    } else {
      // Hard delete if no attendance records
      const { error } = await supabase
        .from('labor_profiles')
        .delete()
        .eq('id', id)

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Database error: ${error.message}`
        })
      }

      return {
        success: true,
        data: { id },
        message: 'Labor profile deleted successfully'
      }
    }
  } catch (error) {
    console.error('Error deleting labor profile:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to delete labor profile'
    })
  }
})