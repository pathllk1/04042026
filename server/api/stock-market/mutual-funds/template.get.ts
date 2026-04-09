import { defineEventHandler, createError, setHeaders } from 'h3';
import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const userId = event.context.userId;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mutual Fund Template');

    // Define all fields from MutualFund model with their requirements
    const fields = [
      // Mandatory fields (red headers)
      { name: 'schemeName', displayName: 'Scheme Name', required: true },
      { name: 'schemeCode', displayName: 'Scheme Code', required: true },
      { name: 'fundHouse', displayName: 'Fund House', required: true },
      { name: 'category', displayName: 'Category', required: true },
      { name: 'purchaseNAV', displayName: 'Purchase NAV', required: true },
      { name: 'units', displayName: 'Units', required: true },
      { name: 'investmentAmount', displayName: 'Investment Amount', required: true },
      { name: 'purchaseDate', displayName: 'Purchase Date (YYYY-MM-DD)', required: true },
      { name: 'folioNumber', displayName: 'Folio Number', required: true },
      { name: 'user', displayName: 'User', required: true },
      { name: 'broker', displayName: 'Broker', required: true },

      // Optional fields (orange headers)
      { name: 'currentNAV', displayName: 'Current NAV', required: false },
      { name: 'currentValue', displayName: 'Current Value', required: false },
      { name: 'profitLoss', displayName: 'Profit/Loss', required: false },
      { name: 'profitLossPercentage', displayName: 'Profit/Loss %', required: false },
      { name: 'xirr', displayName: 'XIRR %', required: false },
      { name: 'sipFlag', displayName: 'SIP Flag (true/false)', required: false },
      { name: 'sipAmount', displayName: 'SIP Amount', required: false },
      { name: 'sipFrequency', displayName: 'SIP Frequency', required: false },
      { name: 'sipDay', displayName: 'SIP Day', required: false },
      { name: 'lastNAVUpdate', displayName: 'Last NAV Update (YYYY-MM-DD)', required: false },
      { name: 'expense', displayName: 'Expense', required: false },
      { name: 'dividendOption', displayName: 'Dividend Option', required: false },
      { name: 'prevDayNAV', displayName: 'Previous Day NAV', required: false },
      { name: 'dayPL', displayName: 'Day P/L', required: false },
      { name: 'dayPLPercentage', displayName: 'Day P/L %', required: false }
    ];

    // Add header row
    const headerRow = worksheet.addRow(fields.map(field => field.displayName));

    // Style the header row with color coding
    headerRow.eachCell((cell, colNumber) => {
      const field = fields[colNumber - 1];

      // Set font style
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text

      // Set background color based on field requirement
      if (field.required) {
        // Red background for mandatory fields
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDC3545' } // Red
        };
      } else {
        // Orange background for optional fields
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFD7E14' } // Orange
        };
      }

      // Add border
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, index) => {
      const field = fields[index];
      if (field) {
        column.width = Math.max(field.displayName.length + 2, 15);
      }
    });

    // Add a few sample rows with placeholder data to show format
    const sampleRows = [
      ['Sample Scheme Name', 'SAMPLE001', 'Sample Fund House', 'Equity', 100.50, 10, 1005, '2024-01-01', 'FOLIO001', 'user@example.com', 'Sample Broker', '', '', '', '', 'false', '', '', '', '', 0, 'Growth', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ];

    sampleRows.forEach(row => {
      const dataRow = worksheet.addRow(row);
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    setHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="MutualFund_Import_Template.xlsx"'
    });

    return buffer;
  } catch (error) {
    console.error('Error generating mutual fund template:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate template'
    });
  }
});
