import { createError } from 'h3'
import { Wage } from '../../models/Wage'
import EmployeeAdvance from '../../models/EmployeeAdvance'
import AdvanceRecovery from '../../models/AdvanceRecovery'
import { MasterRoll } from '../../models/MasterRoll'

export default defineEventHandler(async (event) => {
  // Get user ID from context (set by auth middleware)
  const userId = event.context.userId
  const firmId = event.context.user.firmId

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    // Get current month range
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startDate = new Date(`${currentMonth}-01T00:00:00.000Z`)
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`
    const endDate = new Date(`${nextMonth}-01T00:00:00.000Z`)
    endDate.setMilliseconds(endDate.getMilliseconds() - 1)

    // Get employee stats
    const totalEmployees = await MasterRoll.countDocuments({ firmId })
    const activeEmployees = await MasterRoll.countDocuments({ firmId, status: 'active' })

    // Get monthly wages
    const monthlyWages = await Wage.aggregate([
      {
        $match: {
          firmId,
          salary_month: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$net_salary' }
        }
      }
    ])

    // Get advances stats
    const advancesStats = await EmployeeAdvance.aggregate([
      {
        $match: {
          firmId,
          status: { $ne: 'fully_recovered' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$remainingBalance' },
          count: { $sum: 1 }
        }
      }
    ])

    // Get recovered advances for current month (for historical reference)
    const currentMonthRecoveries = await AdvanceRecovery.aggregate([
      {
        $match: {
          firmId,
          recoveryDate: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$recoveryAmount' }
        }
      }
    ])

    // Calculate total recovered amount across all advances
    // This is the difference between original amount and remaining balance
    const totalRecoveredAdvances = await EmployeeAdvance.aggregate([
      {
        $match: {
          firmId
        }
      },
      {
        $group: {
          _id: null,
          totalOriginal: { $sum: '$amount' },
          totalRemaining: { $sum: '$remainingBalance' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRecovered: { $subtract: ['$totalOriginal', '$totalRemaining'] }
        }
      }
    ])

    // Get wages data for chart (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const wagesData = await Wage.aggregate([
      {
        $match: {
          firmId,
          salary_month: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$salary_month' },
            month: { $month: '$salary_month' }
          },
          total: { $sum: '$net_salary' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ])

    // Get advances distribution data with both remaining and recovered amounts
    const advancesData = await EmployeeAdvance.aggregate([
      {
        $match: {
          firmId
        }
      },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          remainingBalance: { $sum: '$remainingBalance' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          remainingBalance: 1,
          recoveredAmount: { $subtract: ['$totalAmount', '$remainingBalance'] },
          count: 1
        }
      }
    ])

    // Get recent activity (wages, advances, recoveries)
    const recentWages = await Wage.find({ firmId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()

    const recentAdvances = await EmployeeAdvance.find({ firmId })
      .sort({ date: -1 })
      .limit(5)
      .lean()

    const recentRecoveries = await AdvanceRecovery.find({ firmId })
      .sort({ recoveryDate: -1 })
      .limit(5)
      .lean()

    // Format recent activity
    const recentActivity = [
      ...recentWages.map(wage => ({
        type: 'wage',
        date: wage.updatedAt || wage.createdAt,
        description: `Wage processed for ${wage.employeeName} - ₹${wage.net_salary.toLocaleString()}`
      })),
      ...recentAdvances.map(advance => ({
        type: 'advance',
        date: advance.date,
        description: `Advance of ₹${advance.amount.toLocaleString()} given to ${advance.employeeName}`
      })),
      ...recentRecoveries.map(recovery => ({
        type: 'recovery',
        date: recovery.recoveryDate,
        description: `₹${recovery.recoveryAmount.toLocaleString()} recovered from ${recovery.employeeName}`
      }))
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)

    // Format chart data
    console.log('Wages data from DB:', wagesData)

    const formattedWagesData = wagesData.map(item => {
      // Create a date object for the month-year combination
      const date = new Date(item._id.year, item._id.month - 1, 1);

      // Store the full date for sorting and the formatted month-year for display
      return {
        fullDate: date,
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        total: item.total
      };
    });

    // Sort by actual date (chronologically) if we have multiple months
    if (formattedWagesData.length > 1) {
      formattedWagesData.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
    }

    // For debugging
    console.log('Formatted wages data:', formattedWagesData)

    // If we have no wages data but there are wages in the current month,
    // add a placeholder data point to ensure the chart displays
    if (formattedWagesData.length === 0 && monthlyWages.length > 0 && monthlyWages[0].total > 0) {
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' })
      formattedWagesData.push({
        month: currentMonth,
        total: monthlyWages[0].total
      })
      console.log('Added placeholder wages data:', formattedWagesData)
    }

    // Ensure we have data for all possible advance statuses
    const allStatuses = ['pending', 'approved', 'paid', 'partially_recovered', 'fully_recovered']

    // Create maps for both remaining and recovered amounts
    const remainingBalanceMap = new Map()
    const recoveredAmountMap = new Map()
    const countMap = new Map()

    // Initialize with zeros
    allStatuses.forEach(status => {
      remainingBalanceMap.set(status, 0)
      recoveredAmountMap.set(status, 0)
      countMap.set(status, 0)
    })

    // Update with actual monetary values
    advancesData.forEach(item => {
      if (item._id) {
        remainingBalanceMap.set(item._id, item.remainingBalance)
        recoveredAmountMap.set(item._id, item.recoveredAmount)
        countMap.set(item._id, item.count)
      }
    })

    // For debugging
    console.log('Advances data from DB:', advancesData)
    console.log('Remaining balance map:', Object.fromEntries(remainingBalanceMap))
    console.log('Recovered amount map:', Object.fromEntries(recoveredAmountMap))
    console.log('Count map:', Object.fromEntries(countMap))

    // Get statuses with non-zero total amounts (remaining + recovered)
    const nonZeroStatuses = Array.from(remainingBalanceMap.keys()).filter(key =>
      remainingBalanceMap.get(key) > 0 || recoveredAmountMap.get(key) > 0
    )

    // If there are no non-zero statuses but we have advances, include at least one status
    // This ensures we always have some data to display if there are advances
    const labelsToUse = nonZeroStatuses.length > 0 ? nonZeroStatuses :
                        (advancesStats.length > 0 && advancesStats[0].count > 0) ? ['pending'] : []

    // Convert to the format expected by the chart - use recovered amounts for the chart
    // This shows how much has been recovered for each status
    const formattedAdvancesData = {
      labels: labelsToUse,
      data: labelsToUse.map(key => recoveredAmountMap.get(key)),
      remainingData: labelsToUse.map(key => remainingBalanceMap.get(key))
    }

    // For debugging
    console.log('Formatted advances data:', formattedAdvancesData)

    // Remove fullDate property from wagesData before sending to client
    const clientWagesData = formattedWagesData.map(({ fullDate, ...rest }) => rest);

    // Calculate the total recovered amount
    const totalRecovered = totalRecoveredAdvances.length > 0 ? totalRecoveredAdvances[0].totalRecovered : 0;

    // Log detailed information for debugging
    console.log('Dashboard stats calculation:');
    console.log('- Outstanding advances:', advancesStats.length > 0 ? advancesStats[0].total : 0);
    console.log('- Advance count:', advancesStats.length > 0 ? advancesStats[0].count : 0);
    console.log('- Total recovered advances (all time):', totalRecovered);
    console.log('- Current month recoveries:', currentMonthRecoveries.length > 0 ? currentMonthRecoveries[0].total : 0);

    // Get individual advances for debugging
    const activeAdvances = await EmployeeAdvance.find({
      firmId,
      status: { $ne: 'fully_recovered' }
    }).select('employeeName amount remainingBalance status');

    console.log('Active advances:');
    activeAdvances.forEach(adv => {
      const recovered = adv.amount - adv.remainingBalance;
      console.log(`- ${adv.employeeName}: Amount=${adv.amount}, Remaining=${adv.remainingBalance}, Recovered=${recovered}, Status=${adv.status}`);
    });

    return {
      success: true,
      stats: {
        totalEmployees,
        activeEmployees,
        monthlyWages: monthlyWages.length > 0 ? monthlyWages[0].total : 0,
        outstandingAdvances: advancesStats.length > 0 ? advancesStats[0].total : 0,
        advanceCount: advancesStats.length > 0 ? advancesStats[0].count : 0,
        recoveredAdvances: totalRecovered // Use the total recovered amount from all advances
      },
      wagesData: clientWagesData,
      advancesData: formattedAdvancesData,
      recentActivity
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch dashboard data'
    })
  }
})
