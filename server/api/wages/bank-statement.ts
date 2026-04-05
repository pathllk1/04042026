import ExcelJS from 'exceljs'
import { defineEventHandler, readBody, createError } from 'h3'
import { Wage } from '../../models/Wage'

export default defineEventHandler(async (event) => {
  try {
    // Get user ID and firm ID from context (set by auth middleware)
    const userId = event.context.userId
    const firmId = event.context.user.firmId
    
    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }

    // Get request body
    const { month, chequeNo } = await readBody(event)
    
    if (!month || !chequeNo) {
      throw createError({
        statusCode: 400,
        message: 'Month and cheque number are required'
      })
    }

    // Parse month to create date range
    const [year, monthNum] = month.split('-')
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0) // Last day of month
    
    // Query wages for the specified month and cheque number
    const wages = await Wage.find({ 
      firmId,
      salary_month: {
        $gte: startDate,
        $lte: endDate
      },
      cheque_no: chequeNo
    }).sort({ employeeName: 1 }).lean()
    
    if (wages.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'No wages found for the specified month and cheque number'
      })
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Wages System'
    workbook.lastModifiedBy = 'Wages System'
    workbook.created = new Date()
    workbook.modified = new Date()

    const worksheet = workbook.addWorksheet('Bank Statement', {
      pageSetup: {
        paperSize: 9, // A4 paper size
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    })

    // Helper function to format date in DD-MM-YYYY format
    const formatDateToDDMMYYYY = (date: Date): string => {
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    }

    // Get the payment date from the first wage record
    const paymentDate = wages[0]?.paid_date ? formatDateToDDMMYYYY(new Date(wages[0].paid_date)) : ''
    const bankAccount = wages[0]?.paid_from_bank_ac || ''

    // Add header information in rows 1 and 2
    worksheet.getCell('A1').value = 'CHEQUE NUMBER'
    worksheet.getCell('A2').value = 'CHEQUE DATE'
    worksheet.getCell('B1').value = chequeNo
    worksheet.getCell('B2').value = paymentDate

    // Define columns without headers first
    worksheet.columns = [
      { key: 'paysys', width: 20 },
      { key: 'debitAccount', width: 20 },
      { key: 'amount', width: 15, style: { numFmt: '#,##0.00' } }, // Indian number format without rupee symbol
      { key: 'beneficiaryAccount', width: 25, style: { numFmt: '@' } }, // @ format forces text
      { key: 'accountType', width: 25 },
      { key: 'beneficiaryName', width: 30 },
      { key: 'address1', width: 25 },
      { key: 'address2', width: 25 },
      { key: 'ifsc', width: 15 },
      { key: 'info', width: 25 }
    ]
    
    // Add an empty row to push headers to row 3
    worksheet.addRow({})
    
    // Set headers in row 3
    const headerRow = worksheet.getRow(3)
    headerRow.values = [
      'PAYSYS ID(RTGS/NEFT)',
      'DEBIT ACCOUNT',
      'TRAN AMOUNT',
      'BENEFICIARY ACCOUNT',
      'BENEFICIARY ACCOUNT TYPE',
      'BENEFICIARY NAME',
      'BENEFICIARY ADD1',
      'BENEFICIARY ADD2',
      'BENEFICIARY IFSC',
      'SENDER TO RECEIVER INFO'
    ]
    
    // Style the header row
    headerRow.font = { bold: true }

    // Add data rows (starting from row 4)
    let totalNetSalary = 0
    wages.forEach((wage) => {
      worksheet.addRow({
        paysys: 'NEFT',
        debitAccount: bankAccount,
        amount: wage.net_salary,
        beneficiaryAccount: String(wage.accountNo), // Explicitly convert to string
        accountType: '10',
        beneficiaryName: wage.employeeName,
        address1: wage.bank,
        address2: wage.branch || wage.bank,
        ifsc: wage.ifsc,
        info: chequeNo
      })
      totalNetSalary += wage.net_salary
    })

    // Add total row
    const totalRow = worksheet.addRow({
      paysys: '',
      debitAccount: '',
      amount: totalNetSalary,
      beneficiaryAccount: '',
      accountType: '',
      beneficiaryName: '',
      address1: '',
      address2: '',
      ifsc: '',
      info: ''
    })
    totalRow.font = { bold: true }

    // Ensure total amount cell uses Indian number format without rupee symbol
    const totalAmountCell = totalRow.getCell(3) // Amount is in column 3
    totalAmountCell.numFmt = '#,##0.00'

    // Add borders to all cells
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }

    // Apply borders to all cells with data and ensure beneficiary account column is formatted as text
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = borderStyle

        // Force beneficiary account column (column 4) to be text format
        if (cell.col === 4 && row.number > 3) { // Skip header rows
          cell.numFmt = '@' // @ format forces text
        }
      })
    })

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer()
    
    // Set response headers
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    setHeader(event, 'Content-Disposition', `attachment; filename=bank-statement-${chequeNo}-${month}.xlsx`)
    
    return buffer
  } catch (error) {
    console.error('Error generating bank statement:', error)
    throw createError({
      statusCode: 500,
      message: `Error generating bank statement: ${error.message}`
    })
  }
})