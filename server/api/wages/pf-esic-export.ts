import ExcelJS from 'exceljs'
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
    const body = await readBody(event)
    const { month, employees, summary, filters } = body

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No employee data provided'
      })
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    
    // Add metadata
    workbook.creator = 'Wages Management System'
    workbook.created = new Date()
    workbook.modified = new Date()

    // Create Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary')
    
    // Summary sheet styling
    summarySheet.getColumn('A').width = 25
    summarySheet.getColumn('B').width = 15
    summarySheet.getColumn('C').width = 15
    summarySheet.getColumn('D').width = 15

    // Title
    const titleRow = summarySheet.addRow(['PF & ESIC Summary Report'])
    titleRow.getCell(1).font = { size: 16, bold: true }
    titleRow.getCell(1).alignment = { horizontal: 'center' }
    summarySheet.mergeCells('A1:D1')

    // Month info
    const monthRow = summarySheet.addRow(['Month:', formatMonthYear(month)])
    monthRow.getCell(1).font = { bold: true }
    monthRow.getCell(2).font = { bold: true }

    // Generation date
    const dateRow = summarySheet.addRow(['Generated on:', new Date().toLocaleDateString()])
    dateRow.getCell(1).font = { bold: true }

    summarySheet.addRow([]) // Empty row

    // Employee Summary
    summarySheet.addRow(['Employee Summary'])
    summarySheet.getRow(summarySheet.rowCount).getCell(1).font = { bold: true, size: 14 }
    
    summarySheet.addRow(['Total Employees:', summary.totalEmployees])
    summarySheet.addRow(['Paid Employees:', summary.paidEmployees])
    summarySheet.addRow(['Unpaid Employees:', summary.unpaidEmployees])
    summarySheet.addRow(['Total Gross Salary:', `₹${formatIndianCurrency(summary.totalGrossSalary)}`])

    summarySheet.addRow([]) // Empty row

    // EPF Summary
    summarySheet.addRow(['EPF Summary'])
    summarySheet.getRow(summarySheet.rowCount).getCell(1).font = { bold: true, size: 14 }

    summarySheet.addRow(['Employee EPF (12%):', `₹${formatIndianCurrency(summary.epf.employeeEpf)}`])
    summarySheet.addRow(['Employer EPF (3.67%):', `₹${formatIndianCurrency(summary.epf.employerEpf)}`])
    summarySheet.addRow(['Employer EPS (8.33%):', `₹${formatIndianCurrency(summary.epf.employerEps)}`])
    summarySheet.addRow(['EDLI (0.5%):', `₹${formatIndianCurrency(summary.epf.edli)}`])
    summarySheet.addRow(['Admin Charges (0.65%):', `₹${formatIndianCurrency(summary.epf.adminCharges || 0)}`])
    summarySheet.addRow(['Total Employer EPF Contribution:', `₹${formatIndianCurrency(summary.epf.totalEmployerContribution)}`])
    summarySheet.addRow(['Total EPF Contribution:', `₹${formatIndianCurrency(summary.epf.totalContribution)}`])

    summarySheet.addRow([]) // Empty row

    // ESIC Summary
    summarySheet.addRow(['ESIC Summary'])
    summarySheet.getRow(summarySheet.rowCount).getCell(1).font = { bold: true, size: 14 }
    
    summarySheet.addRow(['Employee ESIC (0.75%):', `₹${formatIndianCurrency(summary.esic.employeeEsic)}`])
    summarySheet.addRow(['Employer ESIC (3.25%):', `₹${formatIndianCurrency(summary.esic.employerEsic)}`])
    summarySheet.addRow(['Total ESIC Contribution:', `₹${formatIndianCurrency(summary.esic.totalContribution)}`])

    // Create Employee Details Sheet
    const detailsSheet = workbook.addWorksheet('Employee Details')
    
    // Set column widths
    detailsSheet.getColumn('A').width = 8  // Sl No
    detailsSheet.getColumn('B').width = 25 // Employee Name
    detailsSheet.getColumn('C').width = 15 // Project
    detailsSheet.getColumn('D').width = 15 // Site
    detailsSheet.getColumn('E').width = 15 // UAN
    detailsSheet.getColumn('F').width = 15 // ESIC No
    detailsSheet.getColumn('G').width = 12 // Wage Days
    detailsSheet.getColumn('H').width = 12 // Per Day Wage
    detailsSheet.getColumn('I').width = 12 // Gross Salary
    detailsSheet.getColumn('J').width = 12 // Employee EPF
    detailsSheet.getColumn('K').width = 12 // Employer EPF
    detailsSheet.getColumn('L').width = 12 // EPS
    detailsSheet.getColumn('M').width = 12 // EDLI
    detailsSheet.getColumn('N').width = 12 // Admin Charges
    detailsSheet.getColumn('O').width = 12 // Employee ESIC
    detailsSheet.getColumn('P').width = 12 // Employer ESIC
    detailsSheet.getColumn('Q').width = 10 // Status

    // Headers
    const headerRow = detailsSheet.addRow([
      'Sl No',
      'Employee Name',
      'Project',
      'Site',
      'UAN',
      'ESIC No',
      'Wage Days',
      'Per Day Wage',
      'Gross Salary',
      'Employee EPF',
      'Employer EPF',
      'EPS',
      'EDLI',
      'Admin Charges',
      'Employee ESIC',
      'Employer ESIC',
      'Status'
    ])

    // Style headers
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })

    // Add employee data
    employees.forEach((employee, index) => {
      const row = detailsSheet.addRow([
        index + 1,
        employee.employeeName,
        employee.project,
        employee.site,
        employee.uan,
        employee.esicNo,
        Number(employee.wageDays || 0),
        Number(employee.pDayWage || 0),
        Number(employee.grossSalary),
        Number(employee.employeeEpf),
        Number(employee.employerEpf),
        Number(employee.employerEps),
        Number(employee.edli),
        Number(employee.adminCharges || 0),
        Number(employee.employeeEsic),
        Number(employee.employerEsic),
        employee.paymentStatus
      ])

      // Format currency columns (starting from Per Day Wage)
      for (let col = 8; col <= 16; col++) {
        row.getCell(col).numFmt = '₹#,##0.00'
      }

      // Add borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })

      // Color code based on payment status
      if (employee.paymentStatus === 'paid') {
        row.getCell(17).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'C6EFCE' }
        }
      } else {
        row.getCell(17).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC7CE' }
        }
      }
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Set response headers
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PF-ESIC-Report-${month}.xlsx"`,
      'Content-Length': buffer.length
    })

    return buffer

  } catch (error) {
    console.error('Error generating PF/ESIC Excel report:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to generate Excel report'
    })
  }
})

// Helper functions
function formatMonthYear(monthString: string): string {
  if (!monthString) return 'Not selected'
  const [year, month] = monthString.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function formatIndianCurrency(amount: string | number): string {
  const num = Number(amount) || 0
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
