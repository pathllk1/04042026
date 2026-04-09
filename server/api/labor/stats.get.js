import SupabaseConfig from '../../models/SupabaseConfig.js'
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

    const { count: totalLabor } = await supabase
      .from('labor_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('is_active', true)

    const { count: totalGroups } = await supabase
      .from('labor_groups')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('is_active', true)

    const today = new Date().toISOString().split('T')[0]
    const { count: todayAttendance } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('firm_id', firmId)
        .eq('attendance_date', today)
        .gt('days_worked', 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const { data: payments } = await supabase
        .from('payment_records')
        .select('amount')
        .eq('firm_id', firmId)
        .gte('payment_date', startOfMonth.toISOString().split('T')[0])

    const totalPayments = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0) || 0

    // Get unique attendance periods count
    const { data: attendancePeriods } = await supabase
      .from('attendance_records')
      .select('period_start, period_end')
      .eq('firm_id', firmId)

    const uniquePeriods = new Set()
    attendancePeriods?.forEach(period => {
      uniquePeriods.add(`${period.period_start}-${period.period_end}`)
    })

    return {
      success: true,
      data: {
        totalLabor: totalLabor || 0,
        totalGroups: totalGroups || 0,
        todayAttendance: todayAttendance || 0,
        totalPayments: totalPayments,
        totalAttendancePeriods: uniquePeriods.size
      }
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch stats'
    })
  }
})