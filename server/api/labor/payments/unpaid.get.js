import SupabaseConfig from '../../../models/SupabaseConfig.js'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { groupId } = query

    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    const firmId = user.firmId
    const userId = user._id

    if (!firmId || !groupId) {
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

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: profiles } = await supabase.from('labor_profiles').select('id').eq('group_id', groupId)
    const laborIds = profiles.map(p => p.id)

    console.log('Unpaid amounts API - Debug info:', {
      firmId,
      groupId,
      profilesCount: profiles.length,
      laborIds: laborIds.length
    })

    const { data: attendancePeriods } = await supabase
      .from('attendance_records')
      .select('period_start, period_end')
      .in('labor_id', laborIds)
      .gte('period_start', oneYearAgo.toISOString())

    console.log('Found attendance periods:', attendancePeriods.length)

    // Sort periods chronologically (oldest first) for proper FIFO allocation
    const uniquePeriods = [...new Set(attendancePeriods.map(p => `${p.period_start}|${p.period_end}`))].map(p => {
        const [start, end] = p.split('|')
        return { period_start: start, period_end: end, group_id: groupId }
    }).sort((a, b) => new Date(a.period_start) - new Date(b.period_start))

    console.log('Unique periods (sorted chronologically):', uniquePeriods.length)

    const { data: allPayments } = await supabase
        .from('payment_records')
        .select('*')
        .eq('group_id', groupId)

    // Get all final payments made after any period ends, sorted by date
    const finalPayments = allPayments
        .filter(p => p.payment_type === 'Final Payment')
        .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))

    console.log('Final payments found:', finalPayments.length)

    // First, calculate base unpaid amounts for each period (without final payments)
    const periodData = await Promise.all(uniquePeriods.map(async (period) => {
        // Get regular attendance earnings
        const { data: earnings } = await supabase
            .from('attendance_records')
            .select('amount, site_expenses')
            .in('labor_id', laborIds)
            .gte('attendance_date', period.period_start)
            .lte('attendance_date', period.period_end)

        const regularEarnings = earnings.reduce((sum, record) => sum + record.amount + (record.site_expenses || 0), 0)

        // Get group custom expenses for this period
        const groupExpenseProfileName = `GROUP_EXPENSES_${groupId}`
        let customExpensesTotal = 0

        const { data: groupProfile } = await supabase
            .from('labor_profiles')
            .select('id')
            .eq('name', groupExpenseProfileName)
            .eq('firm_id', firmId)
            .single()

        if (groupProfile) {
            const { data: groupExpenseRecords } = await supabase
                .from('attendance_records')
                .select('custom_expenses')
                .eq('labor_id', groupProfile.id)
                .eq('firm_id', firmId)
                .eq('period_start', period.period_start)
                .eq('period_end', period.period_end)
                .single()

            if (groupExpenseRecords && groupExpenseRecords.custom_expenses) {
                customExpensesTotal = groupExpenseRecords.custom_expenses.reduce((sum, expense) => {
                    return sum + (parseFloat(expense.amount) || 0)
                }, 0)
            }
        }

        const totalEarnings = regularEarnings + customExpensesTotal

        // Get regular payments made during this period (excluding final payments)
        const paymentsInPeriod = allPayments.filter(p =>
            p.payment_date >= period.period_start &&
            p.payment_date <= period.period_end &&
            p.payment_type !== 'Final Payment'
        )
        const totalRegularPayments = paymentsInPeriod.reduce((sum, record) => sum + record.amount, 0)

        // Calculate base unpaid amount (before final payment allocation)
        const baseUnpaidAmount = totalEarnings - totalRegularPayments

        return {
            period,
            totalEarnings,
            regularEarnings,
            customExpensesTotal,
            totalRegularPayments,
            baseUnpaidAmount: Math.max(0, baseUnpaidAmount), // Only positive unpaid amounts
            finalPaymentAllocated: 0, // Will be calculated in FIFO allocation
            actualBalance: baseUnpaidAmount // Preserve actual balance (can be negative)
        }
    }))

    // Apply FIFO allocation for final payments
    console.log('Starting FIFO allocation for final payments...')

    // Process each final payment in chronological order
    for (const finalPayment of finalPayments) {
        // Safety check: Validate final payment amount
        if (!finalPayment.amount || finalPayment.amount <= 0) {
            console.log(`Skipping invalid final payment: ${finalPayment.amount}`)
            continue
        }

        let remainingFinalPayment = Number(finalPayment.amount)
        console.log(`Processing final payment: ₹${remainingFinalPayment} dated ${finalPayment.payment_date}`)

        // Apply to periods that ended before this final payment date, in chronological order (FIFO)
        for (const periodItem of periodData) {
            if (remainingFinalPayment <= 0) break

            // Safety check: Validate period dates
            if (!periodItem.period.period_end || !finalPayment.payment_date) {
                console.log(`Skipping period with invalid dates: ${periodItem.period.period_start} to ${periodItem.period.period_end}`)
                continue
            }

            // Only apply to periods that ended before the final payment date
            if (new Date(periodItem.period.period_end) >= new Date(finalPayment.payment_date)) continue

            // Only apply to periods with remaining unpaid amounts
            const remainingUnpaid = periodItem.baseUnpaidAmount - periodItem.finalPaymentAllocated
            if (remainingUnpaid <= 0) continue

            // Calculate allocation amount (minimum of remaining payment and remaining unpaid)
            const allocationAmount = Math.min(remainingFinalPayment, remainingUnpaid)

            // Safety check: Ensure allocation amount is valid
            if (allocationAmount <= 0) continue

            // Apply the allocation
            periodItem.finalPaymentAllocated += allocationAmount
            remainingFinalPayment -= allocationAmount

            console.log(`Allocated ₹${allocationAmount} to period ${periodItem.period.period_start} to ${periodItem.period.period_end}`)
        }

        if (remainingFinalPayment > 0) {
            console.log(`Warning: ₹${remainingFinalPayment} from final payment could not be allocated (no eligible unpaid periods)`)
        }
    }

    // Calculate final results for each period
    const unpaidAmounts = periodData.map(periodItem => {
        const totalFinalPayments = periodItem.finalPaymentAllocated
        const totalPayments = periodItem.totalRegularPayments + totalFinalPayments
        const unpaidAmount = periodItem.totalEarnings - totalPayments

        // Calculate payment status
        let paymentStatus = 'unpaid'
        let displayAmount = Math.max(0, unpaidAmount)

        if (unpaidAmount <= 0) {
            if (unpaidAmount === 0) {
                paymentStatus = 'paid'
                displayAmount = 0
            } else {
                paymentStatus = 'overpaid'
                displayAmount = Math.abs(unpaidAmount)
            }
        }

        return {
            period: periodItem.period,
            totalEarnings: periodItem.totalEarnings,
            regularEarnings: periodItem.regularEarnings,
            customExpensesTotal: periodItem.customExpensesTotal,
            totalPayments: totalPayments,
            unpaidAmount: Math.max(0, unpaidAmount), // Keep for backward compatibility
            paymentStatus,
            displayAmount,
            actualBalance: unpaidAmount, // Preserve actual balance (can be negative)
            // Additional debug info
            finalPaymentAllocated: totalFinalPayments,
            regularPayments: periodItem.totalRegularPayments
        }
    })

    console.log('Returning unpaid amounts:', {
      count: unpaidAmounts.length,
      sample: unpaidAmounts[0] || null
    })

    return {
      success: true,
      data: unpaidAmounts
    }
  } catch (error) {
    console.error('Error fetching unpaid amounts:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch unpaid amounts'
    })
  }
})