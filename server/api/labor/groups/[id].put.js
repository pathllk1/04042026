import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { name, description, color, phone, address, aadhar, bank_details } = body

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
        statusMessage: 'Group ID is required'
      })
    }

    if (!firm_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      })
    }

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

    const supabase = createClient(
      config.supabaseUrl,
      config.getDecryptedServiceKey()
    )

    const { data: existingGroup } = await supabase
        .from('labor_groups')
        .select('id')
        .eq('id', id)
        .eq('firm_id', firm_id)
        .single()

    if (!existingGroup) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Group not found'
        })
    }

    const updateData = {
        name: name.trim(),
        description: description?.trim() || null,
        color: color,
        phone: phone,
        address: address,
        aadhar: aadhar,
        bank_details: bank_details,
        user_id: user_id,
        updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('labor_groups')
      .update(updateData)
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
      message: 'Group updated successfully'
    }
  } catch (error) {
    console.error('Error updating group:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update group'
    })
  }
})