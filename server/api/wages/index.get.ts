import { Wage } from '../../models/Wage'
import { MasterRoll } from '../../models/MasterRoll'
import { createError } from 'h3'

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
    // Get query parameters
    const query = getQuery(event)
    const month = query.month as string

    let wageQuery: any = { firmId }
    let sDate;
    // If month is provided, filter by salary month
    if (month) {
      const [year, monthNum] = month.split('-')
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
      sDate = startDate;
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0) // Last day of month

      wageQuery.salary_month = {
        $gte: startDate,
        $lte: endDate
      }
    }

    // Fetch only active employees
    const activeEmployees = await MasterRoll.find({
      firmId,
      status: 'active'
    }).lean()

    // Create a set of active employee IDs for quick lookup
    const activeEmployeeIds = new Set(
      activeEmployees.map(emp => emp._id.toString())
    )

    // Fetch wages from database
    const allWages = await Wage.find(wageQuery).sort({ employeeName: 1 }).lean()

    // Filter wages to only include those for active employees
    const activeWages = allWages.filter(wage =>
      wage.masterRollId && activeEmployeeIds.has(wage.masterRollId.toString())
    )

    return {
      success: true,
      wages: activeWages,
      employees: activeEmployees // Include employees in the response for the frontend
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Error fetching wages: ${error.message}`
    })
  }
})