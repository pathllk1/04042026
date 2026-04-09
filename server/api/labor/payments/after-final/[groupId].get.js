import SupabaseConfig from '../../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const groupId = getRouterParam(event, 'groupId')
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

    if (!groupId || !firmId) {
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

    // First, find the most recent Final Payment for this group
    const { data: lastFinalPayment, error: finalPaymentError } = await supabase
      .from('payment_records')
      .select('*')
      .eq('group_id', groupId)
      .eq('payment_type', 'Final Payment')
      .order('created_at', { ascending: false })
      .limit(1)

    if (finalPaymentError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${finalPaymentError.message}`
      })
    }

    let paymentsQuery = supabase
      .from('payment_records')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    // If there's a final payment, only get payments created after it
    if (lastFinalPayment && lastFinalPayment.length > 0) {
      const lastFinalPaymentDate = lastFinalPayment[0].created_at
      paymentsQuery = paymentsQuery.gt('created_at', lastFinalPaymentDate)
    }

    const { data: paymentsAfterFinal, error: paymentsError } = await paymentsQuery

    if (paymentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${paymentsError.message}`
      })
    }

    return {
      success: true,
      data: {
        lastFinalPayment: lastFinalPayment && lastFinalPayment.length > 0 ? lastFinalPayment[0] : null,
        paymentsAfterFinal: paymentsAfterFinal || []
      }
    }
  } catch (error) {
    console.error('Error fetching payments after final payment:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch payments after final payment'
    })
  }
})
