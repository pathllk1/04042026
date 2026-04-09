import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { groupId, paymentDate, amount, project, paymentMethod, paymentType } = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!groupId || !paymentDate || !amount || !firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      })
    }

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

    const paymentData = {
      group_id: groupId,
      payment_date: paymentDate,
      amount,
      project,
      payment_method: paymentMethod === 'cash' ? 'cash' : 'bank',
      payment_type: paymentType,
      bank_details: paymentMethod === 'cash' ? {} : { bankId: paymentMethod },
      firm_id: firmId,
    }

    const { data, error } = await supabase
      .from('payment_records')
      .insert([paymentData])
      .select()
      .single()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message}`
      })
    }

    // Here you would add the logic to sync with Firestore
    // For now, we'll just return success

    return {
      success: true,
      data,
      message: 'Payment saved successfully'
    }
  } catch (error) {
    console.error('Error saving payment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to save payment'
    })
  }
})