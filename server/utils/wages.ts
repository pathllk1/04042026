import { Wage } from '../models/Wage'

// Get wages for a specific month
export async function getWages(month: string) {
  try {
    const [year, monthNum] = month.split('-')
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0) // Last day of month

    const wages = await Wage.find({
      salary_month: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .lean()

    return wages.map((wage:any) => ({
      ...wage,
      employeeName: wage.employeeName || 'Unknown',
      project: wage.project || 'Unknown',
      skilled: wage.skilled || false,
      wage_Days: wage.wage_Days || 0,
      pDayWage: wage.pDayWage || 0,
      gross_salary: wage.gross_salary || 0,
      epf_deduction: wage.epf_deduction || 0,
      esic_deduction: wage.esic_deduction || 0,
      net_salary: wage.net_salary || 0
    }))
  } catch (error) {
    console.error('Error fetching wages:', error)
    throw error
  }
}