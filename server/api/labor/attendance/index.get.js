import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

// Helper function to calculate disabled dates for each labor
const calculateDisabledDates = (existingPeriods, currentFromDate, currentToDate) => {
  console.log('🔍 HELPER: Starting calculateDisabledDates')
  console.log('🔍 HELPER: Input existingPeriods:', existingPeriods)
  console.log('🔍 HELPER: Current period:', currentFromDate, 'to', currentToDate)

  const disabledDatesByLabor = {}

  // Create date range for current period
  const currentDates = []
  let currentDate = new Date(currentFromDate)
  const endDate = new Date(currentToDate)

  while (currentDate <= endDate) {
    currentDates.push(currentDate.toISOString().split('T')[0])
    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log('🔍 HELPER: Current date range:', currentDates)

  // Exclude the current period from disabled-date calculation so it remains editable
  const filteredPeriods = (existingPeriods || []).filter(period => {
    const isCurrentPeriod = period.period_start === currentFromDate && period.period_end === currentToDate
    return !isCurrentPeriod
  })
  console.log('🔍 HELPER: Filtered periods (excluding current):', filteredPeriods)

  // Group existing periods by labor_id
  const periodsByLabor = {}
  filteredPeriods.forEach(period => {
    console.log('🔍 HELPER: Processing period:', period)
    if (!periodsByLabor[period.labor_id]) {
      periodsByLabor[period.labor_id] = []
    }
    // Only add unique periods (same start/end dates)
    const existingPeriod = periodsByLabor[period.labor_id].find(p =>
      p.start === period.period_start && p.end === period.period_end
    )
    if (!existingPeriod) {
      periodsByLabor[period.labor_id].push({
        start: period.period_start,
        end: period.period_end,
        attendanceDate: period.attendance_date
      })
      console.log('🔍 HELPER: Added period for labor', period.labor_id, ':', period.period_start, 'to', period.period_end)
    } else {
      console.log('🔍 HELPER: Skipped duplicate period for labor', period.labor_id)
    }
  })

  console.log('🔍 HELPER: Grouped periods by labor:', periodsByLabor)

  // For each labor, check which dates in current range overlap with existing periods
  Object.keys(periodsByLabor).forEach(laborId => {
    console.log('🔍 HELPER: Processing labor ID:', laborId)
    const disabledDates = []
    const laborPeriods = periodsByLabor[laborId]
    console.log('🔍 HELPER: Labor periods for', laborId, ':', laborPeriods)

    currentDates.forEach(date => {
      // Check if this date falls within any existing period for this labor
      const isDisabled = laborPeriods.some(period => {
        const dateInRange = date >= period.start && date <= period.end
        console.log(`🔍 HELPER: Date ${date} in period ${period.start} to ${period.end}? ${dateInRange}`)
        return dateInRange
      })

      console.log(`🔍 HELPER: Date ${date} disabled for labor ${laborId}? ${isDisabled}`)

      if (isDisabled) {
        disabledDates.push(date)
      }
    })

    console.log('🔍 HELPER: Final disabled dates for labor', laborId, ':', disabledDates)
    disabledDatesByLabor[laborId] = disabledDates
  })

  console.log('🔍 HELPER: Final result:', disabledDatesByLabor)
  return disabledDatesByLabor
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { fromDate, toDate, groupId } = query
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!firmId || !fromDate || !toDate) {
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

    let profilesQuery = supabase
      .from('labor_profiles')
      .select('id, name, daily_rate, group_id')
      .eq('firm_id', firmId)
      .eq('is_active', true)

    if (groupId) {
      profilesQuery = profilesQuery.eq('group_id', groupId)
    }

    const { data: profiles, error: profilesError } = await profilesQuery

    if (profilesError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${profilesError.message}`
      })
    }

    const laborIds = profiles.map(p => p.id)

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('labor_id, attendance_date, days_worked')
      .in('labor_id', laborIds)
      .gte('attendance_date', fromDate)
      .lte('attendance_date', toDate)

    if (attendanceError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${attendanceError.message}`
      })
    }

    // Get existing attendance periods to check for overlaps
    console.log('🔍 BACKEND: Querying existing periods for labor IDs:', laborIds)
    console.log('🔍 BACKEND: Current period being viewed:', fromDate, 'to', toDate)

    const { data: existingPeriods, error: periodsError } = await supabase
      .from('attendance_records')
      .select('labor_id, period_start, period_end, attendance_date')
      .in('labor_id', laborIds)

    console.log('🔍 BACKEND: Raw existing periods from DB:', existingPeriods)

    if (periodsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${periodsError.message}`
      })
    }

    // Calculate disabled dates for each labor
    console.log('🔍 BACKEND: Calculating disabled dates...')
    const disabledDatesByLabor = calculateDisabledDates(existingPeriods, fromDate, toDate)
    console.log('🔍 BACKEND: Calculated disabled dates by labor:', disabledDatesByLabor)

    const attendanceData = profiles.map(profile => {
      const profileAttendance = {}
      const profileRecords = attendance.filter(a => a.labor_id === profile.id)
      console.log('🔍 BACKEND: Profile records for', profile.name, ':', profileRecords)

      profileRecords.forEach(a => {
        profileAttendance[a.attendance_date] = a.days_worked
      })

      const disabledDates = disabledDatesByLabor[profile.id] || []
      console.log('🔍 BACKEND: Profile', profile.name, 'disabled dates:', disabledDates)

      return {
        profile,
        attendance: profileAttendance,
        disabledDates
      }
    })

    console.log('🔍 BACKEND: Final attendance data being sent to frontend:', JSON.stringify(attendanceData, null, 2))

    // Fetch group custom expenses if groupId is provided
    let groupCustomExpenses = null
    if (groupId) {
      console.log('🔍 BACKEND: Fetching group custom expenses for group:', groupId)

      // Find the virtual labor profile for group expenses
      const groupExpenseProfileName = `GROUP_EXPENSES_${groupId}`
      const { data: groupProfile } = await supabase
        .from('labor_profiles')
        .select('id')
        .eq('name', groupExpenseProfileName)
        .eq('firm_id', firmId)
        .single()

      if (groupProfile) {
        console.log('🔍 BACKEND: Found group expense profile:', groupProfile.id)

        const { data: groupExpenseRecords, error: groupExpenseError } = await supabase
          .from('attendance_records')
          .select('custom_expenses, period_start, period_end')
          .eq('labor_id', groupProfile.id)
          .eq('firm_id', firmId)
          .eq('period_start', fromDate)
          .eq('period_end', toDate)
          .single()

        if (groupExpenseError && groupExpenseError.code !== 'PGRST116') {
          console.error('🔍 BACKEND: Error fetching group custom expenses:', groupExpenseError)
        } else if (groupExpenseRecords) {
          groupCustomExpenses = {
            hasCustomExpenses: true,
            customExpenses: groupExpenseRecords.custom_expenses || []
          }
          console.log('🔍 BACKEND: Found group custom expenses:', groupCustomExpenses)
        } else {
          groupCustomExpenses = {
            hasCustomExpenses: false,
            customExpenses: []
          }
          console.log('🔍 BACKEND: No group custom expenses found')
        }
      } else {
        console.log('🔍 BACKEND: No group expense profile found')
        groupCustomExpenses = {
          hasCustomExpenses: false,
          customExpenses: []
        }
      }
    }

    return {
      success: true,
      data: attendanceData,
      groupCustomExpenses
    }
  } catch (error) {
    console.error('Error fetching attendance:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch attendance'
    })
  }
})