import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { name, daily_rate, group_id} = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firm_id = user.firmId
    const user_id = user._id

    // Validate required fields
    if (!name || !daily_rate || !firm_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name, daily rate, and firm ID are required'
      })
    }

    // Validate daily rate
    if (isNaN(daily_rate) || parseFloat(daily_rate) <= 0) {
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

    // Check for name uniqueness
    const { data: existingProfile } = await supabase
      .from('labor_profiles')
      .select('id')
      .eq('name', name.trim())
      .eq('firm_id', firm_id)
      .eq('is_active', true)
      .single()

    if (existingProfile) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A labor profile with this name already exists'
      })
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

    // Create the profile
    const profileData = {
      name: name.trim(),
      daily_rate: parseFloat(daily_rate),
      group_id: group_id || null,
      firm_id,
      user_id: user_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('labor_profiles')
      .insert([profileData])
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
      message: 'Labor profile created successfully'
    }
  } catch (error) {
    console.error('Error creating labor profile:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create labor profile'
    })
  }
})