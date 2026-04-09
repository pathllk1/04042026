import { createClient } from '@supabase/supabase-js'
import SupabaseConfig from '../../../models/SupabaseConfig'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const {  groupId, laborId, startDate, endDate, limit = 50, offset = 0 } = query
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
        statusMessage: 'Missing required field: firmId'
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

    // Build the query for attendance history
    let attendanceQuery = supabase
      .from('attendance_records')
      .select(`
        labor_id,
        attendance_date,
        days_worked,
        daily_rate,
        amount,
        period_start,
        period_end,
        custom_expenses,
        notes,
        created_at,
        labor_profiles!inner(
          id,
          name,
          daily_rate,
          group_id,
          labor_groups(
            id,
            name,
            color
          )
        )
      `)
      .eq('firm_id', firmId)
      .order('period_start', { ascending: false })
      .order('attendance_date', { ascending: false })

    // Apply filters
    if (groupId) {
      attendanceQuery = attendanceQuery.eq('labor_profiles.group_id', groupId)
    }

    if (laborId) {
      attendanceQuery = attendanceQuery.eq('labor_id', laborId)
    }

    if (startDate) {
      attendanceQuery = attendanceQuery.gte('attendance_date', startDate)
    }

    if (endDate) {
      attendanceQuery = attendanceQuery.lte('attendance_date', endDate)
    }

    // Apply pagination
    attendanceQuery = attendanceQuery.range(offset, offset + limit - 1)

    const { data: attendanceRecords, error: attendanceError } = await attendanceQuery

    if (attendanceError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${attendanceError.message}`
      })
    }

    // Get unique periods for summary
    const periodsQuery = supabase
      .from('attendance_records')
      .select('period_start, period_end')
      .eq('firm_id', firmId)
      .order('period_start', { ascending: false })

    const { data: periods, error: periodsError } = await periodsQuery

    if (periodsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${periodsError.message}`
      })
    }

    // Get unique periods
    const uniquePeriods = []
    const seenPeriods = new Set()

    periods?.forEach(period => {
      const periodKey = `${period.period_start}-${period.period_end}`
      if (!seenPeriods.has(periodKey)) {
        seenPeriods.add(periodKey)
        uniquePeriods.push({
          period_start: period.period_start,
          period_end: period.period_end
        })
      }
    })

    // Group attendance records by period
    const periodGroups = {}
    attendanceRecords?.forEach(record => {
      const periodKey = `${record.period_start}-${record.period_end}`
      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = {
          period_start: record.period_start,
          period_end: record.period_end,
          records: [],
          totalDays: 0,
          totalAmount: 0,
          laborCount: new Set(),
          groups: new Map() // Track groups in this period
        }
      }

      periodGroups[periodKey].records.push(record)
      periodGroups[periodKey].totalDays += record.days_worked || 0

      // Calculate amount including custom expenses for GROUP_EXPENSES records
      let recordAmount = record.amount || 0
      if (record.labor_profiles.name && record.labor_profiles.name.startsWith('GROUP_EXPENSES_')) {
        if (record.custom_expenses && Array.isArray(record.custom_expenses)) {
          recordAmount = record.custom_expenses.reduce((total, expense) => {
            return total + (parseFloat(expense.amount) || 0)
          }, 0)
        } else {
          recordAmount = 0
        }
      }

      periodGroups[periodKey].totalAmount += recordAmount
      periodGroups[periodKey].laborCount.add(record.labor_id)

      // Track group information
      const groupId = record.labor_profiles?.group_id
      const groupName = record.labor_profiles?.labor_groups?.name || 'Unassigned'
      const groupColor = record.labor_profiles?.labor_groups?.color || '#64748b'

      if (groupId && !periodGroups[periodKey].groups.has(groupId)) {
        periodGroups[periodKey].groups.set(groupId, {
          id: groupId,
          name: groupName,
          color: groupColor
        })
      }
    })

    // Convert labor count sets to numbers and groups map to array
    Object.values(periodGroups).forEach(group => {
      group.laborCount = group.laborCount.size
      group.groups = Array.from(group.groups.values())
    })

    return {
      success: true,
      data: {
        records: attendanceRecords || [],
        periodGroups: Object.values(periodGroups),
        uniquePeriods: uniquePeriods.slice(0, 20), // Limit to recent 20 periods
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: attendanceRecords?.length === parseInt(limit)
        }
      }
    }
  } catch (error) {
    console.error('Error fetching attendance history:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal server error'
    })
  }
})
