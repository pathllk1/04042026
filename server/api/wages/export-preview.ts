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
    const { wages, month, paymentDetails, filters } = body

    if (!wages || !Array.isArray(wages) || wages.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No wage data provided'
      })
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Wages Preview')

    // Set up the header with company info and month
    const monthYear = new Date(month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    
    // Add title and month
    worksheet.mergeCells('A1:M1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `Wages Preview - ${monthYear}`
    titleCell.font = { size: 16, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    // Add payment details
    worksheet.mergeCells('A2:M2')
    const paymentCell = worksheet.getCell('A2')
    paymentCell.value = `Payment Date: ${paymentDetails.paid_date || 'Not specified'} | Cheque: ${paymentDetails.cheque_no || 'Not specified'} | Bank Account: ${paymentDetails.paid_from_bank_ac || 'Not specified'}`
    paymentCell.font = { size: 12 }
    paymentCell.alignment = { horizontal: 'center' }

    // Add filter info if any filters are applied
    if (filters.project || filters.site || filters.bank) {
      worksheet.mergeCells('A3:M3')
      const filterCell = worksheet.getCell('A3')
      const filterInfo = []
      if (filters.project) filterInfo.push(`Project: ${filters.project}`)
      if (filters.site) filterInfo.push(`Site: ${filters.site}`)
      if (filters.bank) filterInfo.push(`Bank: ${filters.bank}`)
      filterCell.value = `Filters Applied: ${filterInfo.join(' | ')}`
      filterCell.font = { size: 10, italic: true }
      filterCell.alignment = { horizontal: 'center' }
    }

    // Add some spacing
    const headerRow = filters.project || filters.site || filters.bank ? 5 : 4

    // Define headers
    const headers = [
      'Sl. No.',
      'Employee Name',
      'Project',
      'Site',
      'Bank',
      'Account No',
      'IFSC',
      'Per Day Wage',
      'Days',
      'Gross Salary',
      'EPF Deduction',
      'ESIC Deduction',
      'Other Deduction',
      'Advance Recovery',
      'Other Benefit',
      'Net Salary'
    ]

    // Add headers
    const headerRowObj = worksheet.getRow(headerRow)
    headers.forEach((header, index) => {
      const cell = headerRowObj.getCell(index + 1)
      cell.value = header
      cell.font = { bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })

    // Add data rows
    let totalGross = 0
    let totalEpf = 0
    let totalEsic = 0
    let totalOtherDeduction = 0
    let totalAdvanceRecovery = 0
    let totalOtherBenefit = 0
    let totalNet = 0

    wages.forEach((wage, index) => {
      const rowIndex = headerRow + 1 + index
      const row = worksheet.getRow(rowIndex)
      
      const rowData = [
        index + 1,
        wage.employeeName,
        wage.project || '',
        wage.site || '',
        wage.bank,
        wage.accountNo,
        wage.ifsc,
        Number(wage.pDayWage),
        Number(wage.wage_Days),
        Number(wage.gross_salary),
        Number(wage.epf_deduction),
        Number(wage.esic_deduction),
        Number(wage.other_deduction),
        Number(wage.advance_recovery),
        Number(wage.other_benefit),
        Number(wage.net_salary)
      ]

      rowData.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1)
        cell.value = value

        // Format currency columns (exclude Days column at index 8)
        if (colIndex >= 7 && colIndex !== 8) { // From Per Day Wage onwards, but skip Days column
          cell.numFmt = '₹#,##0.00'
        } else if (colIndex === 8) { // Days column - format as plain number
          cell.numFmt = '0'
        }

        // Add borders
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }

        // Align numbers to right
        if (typeof value === 'number') {
          cell.alignment = { horizontal: 'right' }
        }
      })

      // Add to totals
      totalGross += Number(wage.gross_salary)
      totalEpf += Number(wage.epf_deduction)
      totalEsic += Number(wage.esic_deduction)
      totalOtherDeduction += Number(wage.other_deduction)
      totalAdvanceRecovery += Number(wage.advance_recovery)
      totalOtherBenefit += Number(wage.other_benefit)
      totalNet += Number(wage.net_salary)
    })

    // Add totals row
    const totalsRowIndex = headerRow + wages.length + 1
    const totalsRow = worksheet.getRow(totalsRowIndex)
    
    const totalsData = [
      '', // Sl. No.
      'TOTAL', // Employee Name
      '', // Project
      '', // Site
      '', // Bank
      '', // Account No
      '', // IFSC
      '', // Per Day Wage
      '', // Days
      totalGross,
      totalEpf,
      totalEsic,
      totalOtherDeduction,
      totalAdvanceRecovery,
      totalOtherBenefit,
      totalNet
    ]

    totalsData.forEach((value, colIndex) => {
      const cell = totalsRow.getCell(colIndex + 1)
      cell.value = value
      cell.font = { bold: true }
      
      if (colIndex >= 9 && value !== '') { // From Gross Salary onwards
        cell.numFmt = '₹#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
      
      if (colIndex === 1) { // TOTAL text
        cell.alignment = { horizontal: 'center' }
      }
      
      // Add borders
      cell.border = {
        top: { style: 'thick' },
        left: { style: 'thin' },
        bottom: { style: 'thick' },
        right: { style: 'thin' }
      }
      
      // Highlight totals
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F0F0F0' }
      }
    })

    // Auto-fit columns
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10
        if (columnLength > maxLength) {
          maxLength = columnLength
        }
      })
      column.width = Math.min(Math.max(maxLength + 2, 10), 30)
    })

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer()

    // Set response headers
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    setHeader(event, 'Content-Disposition', 'attachment; filename="wages-preview.xlsx"')

    return buffer

  } catch (error) {
    console.error('Error generating Excel file:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to generate Excel file'
    })
  }
})
