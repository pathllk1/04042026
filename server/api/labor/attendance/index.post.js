import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    console.log('Received request to save attendance')
    const body = await readBody(event)
    const { attendanceData, fromDate, toDate, groupCustomExpenses } = body

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    console.log('Request body:', body)

    if (!attendanceData || !firmId || !fromDate || !toDate) {
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

    // Get all labor IDs from the attendance data
    const laborIds = [...new Set(attendanceData.map(row => row.profile.id))]

    // Check for existing periods that might overlap
    const { data: existingPeriods, error: periodsError } = await supabase
      .from('attendance_records')
      .select('labor_id, period_start, period_end, attendance_date')
      .in('labor_id', laborIds)
      .not('period_start', 'eq', fromDate)
      .not('period_end', 'eq', toDate)

    if (periodsError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${periodsError.message}`
      })
    }

    // Validate no overlapping dates
    const conflicts = []
    for (const row of attendanceData) {
      for (const date in row.attendance) {
        // Check if this date falls within any existing period for this labor
        const hasConflict = existingPeriods.some(period =>
          period.labor_id === row.profile.id &&
          date >= period.period_start &&
          date <= period.period_end
        )

        if (hasConflict) {
          conflicts.push({
            laborId: row.profile.id,
            laborName: row.profile.name,
            date: date
          })
        }
      }
    }

    if (conflicts.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `Attendance conflicts detected: ${conflicts.map(c => `${c.laborName} on ${c.date}`).join(', ')} already recorded in other periods`
      })
    }

    const recordsToUpsert = []
    for (const row of attendanceData) {
        for (const date in row.attendance) {
            recordsToUpsert.push({
                labor_id: row.profile.id,
                attendance_date: date,
                days_worked: row.attendance[date],
                daily_rate: row.profile.daily_rate,
                period_start: fromDate,
                period_end: toDate,
                firm_id: firmId,
            })
        }
    }

    if (recordsToUpsert.length > 0) {
        console.log('Upserting records:', recordsToUpsert)
        const { error } = await supabase
            .from('attendance_records')
            .upsert(recordsToUpsert, { onConflict: 'labor_id, attendance_date' })

        if (error) {
            console.error('Supabase error:', error)
            throw createError({
                statusCode: 500,
                statusMessage: `Database error: ${error.message}`
            })
        }
        console.log('Upsert successful')
    }

    // Persist any updated daily rates to labor_profiles (create and edit flows)
    try {
      const rateUpdatesMap = new Map()
      for (const row of attendanceData) {
        const laborId = row?.profile?.id
        const newRate = Number(row?.profile?.daily_rate)
        if (!laborId || !Number.isFinite(newRate) || newRate < 0) continue
        // If multiple rows for same labor (shouldn't happen), last one wins
        rateUpdatesMap.set(laborId, newRate)
      }

      const rateUpdates = Array.from(rateUpdatesMap.entries()).map(([id, daily_rate]) => ({
        id,
        daily_rate,
        updated_at: new Date().toISOString()
      }))

      if (rateUpdates.length > 0) {
        console.log('Upserting labor profile rate updates:', rateUpdates)
        const { error: rateError } = await supabase
          .from('labor_profiles')
          .upsert(rateUpdates, { onConflict: 'id' })

        if (rateError) {
          console.error('Supabase error updating labor rates:', rateError)
          // Do not fail the entire request; attendance already saved. Surface as 207-like warning in logs.
        }
      }
    } catch (rateUpdateErr) {
      console.error('Unexpected error while updating labor rates:', rateUpdateErr)
      // Non-fatal
    }

    // Handle group custom expenses if provided
    if (groupCustomExpenses && groupCustomExpenses.groupId) {
      console.log('Processing group custom expenses:', groupCustomExpenses)

      // Get or create virtual labor profile for group expenses
      const groupExpenseProfileName = `GROUP_EXPENSES_${groupCustomExpenses.groupId}`
      let groupLaborId = null

      // Check if virtual profile already exists
      const { data: existingProfile } = await supabase
        .from('labor_profiles')
        .select('id')
        .eq('name', groupExpenseProfileName)
        .eq('firm_id', firmId)
        .single()

      if (existingProfile) {
        groupLaborId = existingProfile.id
        console.log('Found existing group expense profile:', groupLaborId)
      } else {
        // Create virtual labor profile for group expenses
        console.log('Creating virtual group expense profile')
        const { data: newProfile, error: profileError } = await supabase
          .from('labor_profiles')
          .insert([{
            name: groupExpenseProfileName,
            daily_rate: 0,
            group_id: groupCustomExpenses.groupId,
            firm_id: firmId,
            is_active: false, // Mark as inactive so it doesn't appear in regular lists
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select('id')
          .single()

        if (profileError) {
          console.error('Error creating group expense profile:', profileError)
          throw createError({
            statusCode: 500,
            statusMessage: `Database error creating group expense profile: ${profileError.message}`
          })
        }

        groupLaborId = newProfile.id
        console.log('Created group expense profile:', groupLaborId)
      }

      if (groupCustomExpenses.hasCustomExpenses && groupCustomExpenses.customExpenses.length > 0) {
        // Save group custom expenses
        const groupExpenseRecord = {
          labor_id: groupLaborId,
          attendance_date: fromDate,
          days_worked: 0,
          daily_rate: 0,
          period_start: fromDate,
          period_end: toDate,
          custom_expenses: groupCustomExpenses.customExpenses,
          firm_id: firmId,
        }

        console.log('Upserting group custom expenses record:', groupExpenseRecord)
        const { error: groupError } = await supabase
          .from('attendance_records')
          .upsert([groupExpenseRecord], { onConflict: 'labor_id, attendance_date' })

        if (groupError) {
          console.error('Supabase error saving group custom expenses:', groupError)
          throw createError({
            statusCode: 500,
            statusMessage: `Database error saving group custom expenses: ${groupError.message}`
          })
        }
        console.log('Group custom expenses saved successfully')
      } else {
        // Delete existing group custom expenses if hasCustomExpenses is false
        console.log('Deleting existing group custom expenses for:', groupLaborId)
        const { error: deleteError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('labor_id', groupLaborId)
          .eq('firm_id', firmId)
          .eq('period_start', fromDate)
          .eq('period_end', toDate)

        if (deleteError) {
          console.error('Error deleting group custom expenses:', deleteError)
          // Don't throw error for delete failures, just log
        }
      }
    }

    return {
      success: true,
      message: 'Attendance and group custom expenses saved successfully'
    }
  } catch (error) {
    console.error('Error saving attendance:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to save attendance'
    })
  }
})