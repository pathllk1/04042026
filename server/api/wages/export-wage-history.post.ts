import { defineEventHandler, readBody, createError } from 'h3';
import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {
  try {
    console.log('Wage history export API called');

    // Get user ID and firm ID from context (set by auth middleware)
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;

    console.log('Auth context:', { userId, firmId });

    if (!userId || !firmId) {
      console.log('Authentication failed - missing userId or firmId');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Read the request body
    const body = await readBody(event);
    const { wageHistory, employeeName } = body;

    console.log('Request body received:', {
      employeeName,
      wageHistoryLength: wageHistory?.length
    });

    if (!wageHistory || !Array.isArray(wageHistory)) {
      console.log('Invalid wage history data:', wageHistory);
      throw createError({
        statusCode: 400,
        message: 'Invalid wage history data'
      });
    }

    if (wageHistory.length === 0) {
      console.log('Empty wage history array');
      throw createError({
        statusCode: 400,
        message: 'No wage history data to export'
      });
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Wage History');

    // Add title and employee name
    const titleRow = worksheet.addRow([`Wage History - ${employeeName || 'Employee'}`]);
    const dateRow = worksheet.addRow([`Generated on: ${new Date().toLocaleDateString('en-IN')}`]);
    
    // Add empty row for spacing
    worksheet.addRow([]);

    // Merge cells for title and center align
    worksheet.mergeCells('A1:J1');
    worksheet.mergeCells('A2:J2');
    
    // Style the title rows
    titleRow.font = { bold: true, size: 16 };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    dateRow.font = { bold: true, size: 12 };
    dateRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Define headers
    const headers = [
      'Month',
      'Payment Date',
      'Per Day Wage (₹)',
      'Days Worked',
      'Gross Salary (₹)',
      'EPF Deduction (₹)',
      'ESIC Deduction (₹)',
      'Other Deduction (₹)',
      'Advance Recovery (₹)',
      'Net Salary (₹)'
    ];

    // Add header row
    const headerRow = worksheet.addRow(headers);
    
    // Style header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo color
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Set column widths
    worksheet.columns = [
      { width: 20 }, // Month
      { width: 15 }, // Payment Date
      { width: 18 }, // Per Day Wage
      { width: 15 }, // Days Worked
      { width: 18 }, // Gross Salary
      { width: 18 }, // EPF Deduction
      { width: 18 }, // ESIC Deduction
      { width: 18 }, // Other Deduction
      { width: 18 }, // Advance Recovery
      { width: 18 }  // Net Salary
    ];

    // Helper functions
    const formatMonth = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'Not Paid';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    };

    // Add data rows
    let totalGrossSalary = 0;
    let totalEpfDeduction = 0;
    let totalEsicDeduction = 0;
    let totalOtherDeduction = 0;
    let totalAdvanceRecovery = 0;
    let totalNetSalary = 0;

    wageHistory.forEach((wage, index) => {
      const rowData = [
        formatMonth(wage.salary_month),
        formatDate(wage.paid_date),
        Number(wage.pDayWage) || 0,
        Number(wage.wage_Days) || 0,
        Number(wage.gross_salary) || 0,
        Number(wage.epf_deduction) || 0,
        Number(wage.esic_deduction) || 0,
        Number(wage.other_deduction) || 0,
        Number(wage.advance_recovery) || 0,
        Number(wage.net_salary) || 0
      ];

      const row = worksheet.addRow(rowData);

      // Add to totals
      totalGrossSalary += Number(wage.gross_salary) || 0;
      totalEpfDeduction += Number(wage.epf_deduction) || 0;
      totalEsicDeduction += Number(wage.esic_deduction) || 0;
      totalOtherDeduction += Number(wage.other_deduction) || 0;
      totalAdvanceRecovery += Number(wage.advance_recovery) || 0;
      totalNetSalary += Number(wage.net_salary) || 0;

      // Format numeric columns
      [3, 4, 5, 6, 7, 8, 9, 10].forEach(col => {
        const cell = row.getCell(col);
        if (col === 4) {
          // Days worked - no decimal places
          cell.numFmt = '0';
        } else {
          // Currency format for other numeric columns
          cell.numFmt = '#,##0.00';
        }
        cell.alignment = { horizontal: 'right' };
      });

      // Alternate row colors
      if (index % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F9FAFB' } // Light gray
        };
      }
    });

    // Add totals row
    const totalsRow = worksheet.addRow([
      'TOTAL',
      '',
      '',
      '',
      totalGrossSalary,
      totalEpfDeduction,
      totalEsicDeduction,
      totalOtherDeduction,
      totalAdvanceRecovery,
      totalNetSalary
    ]);

    // Style totals row
    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E5E7EB' } // Gray background
    };

    // Format totals row numeric columns
    [5, 6, 7, 8, 9, 10].forEach(col => {
      const cell = totalsRow.getCell(col);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) { // Skip title rows
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Generate Excel buffer
    console.log('Generating Excel buffer...');
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('Excel buffer generated, size:', buffer.length);

    // Set response headers
    const filename = `Wage_History_${employeeName || 'Employee'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    event.node.res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    event.node.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    event.node.res.setHeader('Content-Length', buffer.length);

    console.log('Response headers set, returning buffer for file:', filename);
    return buffer;

  } catch (error) {
    console.error('Error exporting wage history:', error);
    console.error('Error stack:', error.stack);
    throw createError({
      statusCode: 500,
      message: `Failed to export wage history: ${error.message}`
    });
  }
});
