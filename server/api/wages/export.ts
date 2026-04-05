import ExcelJS from 'exceljs'
import { defineEventHandler, readBody, createError } from 'h3'
import { getWages } from '../../utils/wages'
import Firm from '../../models/Firm'
import { MasterRoll } from '../../models/MasterRoll'

export default defineEventHandler(async (event) => {
  try {
    const firmId = event.context.user.firmId
    // Get user with firm details
    const user = await Firm.findById(firmId)
    if (!user) {
      throw createError({
        statusCode: 400,
        message: 'User firm not found'
      })
    }

    const body = await readBody(event)
    const { month } = body

    // Get wages for the selected month
    const wages = await getWages(month)

    // Fetch all master roll entries to get the category information
    const masterRollEntries = await MasterRoll.find({ firmId }).lean()

    // Parse the month to get previous month for ex-employee search
    const [year, monthNum] = month.split('-')
    const selectedMonth = new Date(parseInt(year), parseInt(monthNum) - 1, 1)

    // Calculate previous month (accounting for year change)
    const prevMonth = new Date(selectedMonth)
    prevMonth.setMonth(prevMonth.getMonth() - 1)

    // Create start and end date for previous month
    // This correctly calculates the first day of the previous month
    const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1)

    // This correctly calculates the last day of the previous month (works for all months including January with 31 days)
    // Setting day 0 of the next month gives the last day of the current month
    const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0)

    // Find employees who left or were terminated in the previous month
    const exEmployees = await MasterRoll.find({
      firmId,
      status: { $in: ['left', 'terminated'] },
      dateOfExit: {
        $gte: prevMonthStart,
        $lte: prevMonthEnd
      }
    }).lean()

    // Flag to determine if we need to add the Date of Exit column
    const includeExitDateColumn = exEmployees.length > 0

    // Create a map of masterRollId to category for quick lookup
    const masterRollCategoryMap = new Map()
    masterRollEntries.forEach(entry => {
      masterRollCategoryMap.set(entry._id.toString(), entry.category || 'UNSKILLED')
    })

    const filteredWages = wages.map(wage => ({
      employeeName: wage.employeeName,
      project: wage.project,
      category: wage.masterRollId ? (masterRollCategoryMap.get(wage.masterRollId.toString()) || 'UNSKILLED') : 'UNSKILLED',
      wage_Days: wage.wage_Days,
      pDayWage: wage.pDayWage,
      gross_salary: wage.gross_salary,
      epf_deduction: wage.epf_deduction,
      esic_deduction: wage.esic_deduction,
      net_salary: wage.net_salary,
      isExEmployee: false,
      dateOfExit: null // Add dateOfExit field to prevent TypeScript errors
    }))

    // Create record entries for ex-employees with zero values
    const exEmployeeEntries = exEmployees.map(emp => ({
      employeeName: emp.employeeName,
      project: emp.project || 'N/A',
      category: emp.category || 'UNSKILLED',
      wage_Days: 0,
      pDayWage: emp.pDayWage || 0,
      gross_salary: 0,
      epf_deduction: 0,
      esic_deduction: 0,
      net_salary: 0,
      isExEmployee: true,
      dateOfExit: emp.dateOfExit
    }))

    // Combine regular wages with ex-employees
    const allWages = [...filteredWages, ...exEmployeeEntries]

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Salary Statement');

    // Add firm name at the top
    const firmRow = worksheet.addRow([`Firm: ${user.name}`])
    const monthRow = worksheet.addRow([`SALARY FOR THE MONTH OF ${month}`])

    // Merge cells for first two rows and center
    worksheet.mergeCells('A1:K1') // Merge first row across all columns
    worksheet.mergeCells('A2:K2') // Merge second row across all columns

    // Style the merged rows
    firmRow.font = { bold: true, size: 14 }
    firmRow.alignment = { horizontal: 'center', vertical: 'middle' }

    monthRow.font = { bold: true, size: 12 }
    monthRow.alignment = { horizontal: 'center', vertical: 'middle' }

    // Set column headers with conditional Date of Exit column
    const headerValues = [
      'SL NO', 'NAME', 'PROJECT', 'CATEGORY', 'WAGE DAY',
      'WAGES', 'Gross Salary', 'EPS SALARY', 'EPF DEDUCTION', 'ESIC DEDUCTION', 'NET PAYABLE'
    ]

    if (includeExitDateColumn) {
      headerValues.push('DATE OF EXIT')
    }

    worksheet.getRow(3).values = headerValues

    // Define columns with conditional Date of Exit column
    const columns: Partial<ExcelJS.Column>[] = [
      { key: 'slNo', width: 8, style: { alignment: { horizontal: 'center' } as any }, numFmt: '0' },
      { key: 'name', width: 30 },
      { key: 'project', width: 20 },
      { key: 'skillType', width: 20 },
      { key: 'wageDays', width: 12 },
      { key: 'wages', width: 12 },
      { key: 'grossSalary', width: 15 },
      { key: 'epsSalary', width: 15 },
      { key: 'epfDeduction', width: 15 },
      { key: 'esicDeduction', width: 15 },
      { key: 'netPayable', width: 15 }
    ]

    if (includeExitDateColumn) {
      columns.push({ key: 'dateOfExit', width: 15 })
    }

    worksheet.columns = columns

    // Style the header row
    const headerRow = worksheet.getRow(3)
    headerRow.font = { bold: true }
    headerRow.alignment = { horizontal: 'center' }

    // Calculate totals
    const totals = {
      wages: 0,
      grossSalary: 0,
      epsSalary: 0,
      epfDeduction: 0,
      esicDeduction: 0,
      netPayable: 0
    }

    allWages.forEach((wage, index) => {
      const epsSalary = Math.min(wage.gross_salary, 15000)

      // Only add to totals if not an ex-employee
      if (!wage.isExEmployee) {
        totals.wages += wage.pDayWage
        totals.grossSalary += wage.gross_salary
        totals.epsSalary += epsSalary
        totals.epfDeduction += wage.epf_deduction
        totals.esicDeduction += wage.esic_deduction
        totals.netPayable += wage.net_salary
      }

      const rowData: any = {
        slNo: index + 1,
        name: wage.employeeName,
        project: wage.project,
        skillType: wage.category || 'UNSKILLED',
        wageDays: wage.wage_Days,
        wages: wage.pDayWage,
        grossSalary: wage.gross_salary,
        epsSalary: epsSalary,
        epfDeduction: wage.epf_deduction,
        esicDeduction: wage.esic_deduction,
        netPayable: wage.net_salary
      }

      // Add date of exit if relevant
      if (includeExitDateColumn) {
        rowData.dateOfExit = wage.isExEmployee && wage.dateOfExit ?
          new Date(wage.dateOfExit).toLocaleDateString() : ''
      }

      const row = worksheet.addRow(rowData)

      // Initialize row first for proper styling
      const currentRow = worksheet.getRow(row.number);

      // Apply red formatting for ex-employees
      if (wage.isExEmployee) {
        currentRow.eachCell(cell => {
          cell.font = {
            color: { argb: 'FF0000' }, // Red text
            bold: true
          };
        });
      }

      // Format SL NO column
      currentRow.getCell(1).alignment = { horizontal: 'center' };
      currentRow.getCell(1).numFmt = '0';

      // Format numeric columns
      [6, 7, 8, 9, 10, 11].forEach(col => {
        if (col <= currentRow.cellCount) {
          currentRow.getCell(col).numFmt = '#,##0.00';
          currentRow.getCell(col).alignment = { horizontal: 'right' };
        }
      })
    })

    // Add totals row
    const totalsRowData: any = {
      slNo: '',
      name: 'TOTAL',
      project: '',
      skillType: '',
      wageDays: '',
      wages: totals.wages,
      grossSalary: totals.grossSalary,
      epsSalary: totals.epsSalary,
      epfDeduction: totals.epfDeduction,
      esicDeduction: totals.esicDeduction,
      netPayable: totals.netPayable
    }

    if (includeExitDateColumn) {
      totalsRowData.dateOfExit = ''
    }

    const totalsRow = worksheet.addRow(totalsRowData)

    // Style totals row
    totalsRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
    })

    // Add a blank row for spacing
    worksheet.addRow([])

    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }

    // Apply header background color to all columns
    for (let i = 1; i <= headerRow.cellCount; i++) {
      headerRow.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      };
    }

    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
        if (typeof cell.value === 'number' && Number(cell.col) !== 1) {
          cell.alignment = { horizontal: 'right' }
          // Apply currency format to all numeric columns except SL NO (col 1) and WAGE DAY (col 5)
          if (Number(cell.col) !== 5) {
            cell.numFmt = '#,##0.00'
          } else {
            cell.numFmt = '0' // Plain number format for WAGE DAY column
          }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    event.node.res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    event.node.res.setHeader('Content-Disposition', `attachment; filename=wages-report-${month}.xlsx`)

    return buffer
  } catch (error) {
    console.error('Error generating Excel file:', error)
    throw createError({
      statusCode: 500,
      message: 'Error generating Excel file'
    })
  }
})