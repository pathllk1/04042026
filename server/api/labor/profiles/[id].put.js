import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { name, daily_rate, group_id } = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firm_id = user.firmId
    const user_id = user._id

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Profile ID is required'
      })
    }

    if (!firm_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      })
    }

    // Validate daily rate if provided
    if (daily_rate !== undefined && (isNaN(daily_rate) || parseFloat(daily_rate) <= 0)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Daily rate must be a positive number'
      })
    }


    // Get active Supabase configuration
    const config = await SupabaseConfig.findOne({
      firmId: firm_id,
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
      .select('*')
      .eq('id', id)
      .eq('firm_id', firm_id)
      .eq('is_active', true)
      .single()

    if (!existingProfile) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Labor profile not found'
      })
    }

    // Check for name uniqueness if name is being changed
    if (name && name.trim() !== existingProfile.name) {
      const { data: duplicateProfile } = await supabase
        .from('labor_profiles')
        .select('id')
        .eq('name', name.trim())
        .eq('firm_id', firm_id)
        .eq('is_active', true)
        .neq('id', id)
        .single()

      if (duplicateProfile) {
        throw createError({
          statusCode: 409,
          statusMessage: 'A labor profile with this name already exists'
        })
      }
    }

    // Validate group exists if group_id is provided
    if (group_id) {
      const { data: group } = await supabase
        .from('labor_groups')
        .select('id')
        .eq('id', group_id)
        .eq('firm_id', firm_id)
        .eq('is_active', true)
        .single()

      if (!group) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid group ID'
        })
      }
    }

    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name.trim()
    if (daily_rate !== undefined) updateData.daily_rate = parseFloat(daily_rate)
    if (group_id !== undefined) updateData.group_id = group_id
    if (user_id !== undefined) updateData.user_id = user_id

    // Update the profile
    const { data, error } = await supabase
      .from('labor_profiles')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        labor_groups (
          id,
          name,
          color
        )
      `)
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
      message: 'Labor profile updated successfully'
    }
  } catch (error) {
    console.error('Error updating labor profile:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update labor profile'
    })
  }
})