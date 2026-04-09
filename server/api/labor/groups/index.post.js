import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { name, description, color, phone, address, aadhar, bank_details} = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firm_id= user.firmId
    const user_id = user._id

    // Validate required fields
    if (!name || !firm_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name and firm ID are required'
      })
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Color must be a valid hex color code (e.g., #3B82F6)'
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
    const { data: existingGroup } = await supabase
      .from('labor_groups')
      .select('id')
      .eq('name', name.trim())
      .eq('firm_id', firm_id)
      .eq('is_active', true)
      .single()

    if (existingGroup) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A labor group with this name already exists'
      })
    }

    // Create the group
    const groupData = {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || '#3B82F6',
      phone: phone,
      address: address,
      aadhar: aadhar,
      bank_details: bank_details,
      firm_id,
      user_id: user_id || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('labor_groups')
      .insert([groupData])
      .select()
      .single()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }

    // Add profile count
    const groupWithCount = {
      ...data,
      profile_count: 0
    }

    return {
      success: true,
      data: groupWithCount,
      message: 'Labor group created successfully'
    }
  } catch (error) {
    console.error('Error creating labor group:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create labor group'
    })
  }
})