import { defineEventHandler, readBody, createError, setHeaders } from 'h3';
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

    const body = await readBody(event);
    const { headers, data } = body;

    if (!headers || !data || !Array.isArray(headers) || !Array.isArray(data)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid data format. Headers and data arrays are required.'
      });
    }

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mutual Fund Data');

    // Add headers
    const headerRow = worksheet.addRow(headers);

    // Style the header row
    headerRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      
      // Set font style
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
      
      // Set background color based on field type
      let bgColor = 'FF4472C4'; // Default blue
      
      if (header && typeof header === 'string') {
        const headerLower = header.toLowerCase();
        
        // Mandatory fields - Red background
        if (headerLower.includes('scheme name') || 
            headerLower.includes('scheme code') ||
            headerLower.includes('fund house') ||
            headerLower.includes('category') ||
            headerLower.includes('purchase nav') ||
            headerLower.includes('units') ||
            headerLower.includes('investment amount') ||
            headerLower.includes('purchase date') ||
            headerLower.includes('folio number') ||
            headerLower.includes('user') ||
            headerLower.includes('broker')) {
          bgColor = 'FFDC3545'; // Red
        }
        // Optional fields - Orange background
        else if (headerLower.includes('current nav') ||
                 headerLower.includes('current value') ||
                 headerLower.includes('profit') ||
                 headerLower.includes('sip') ||
                 headerLower.includes('expense') ||
                 headerLower.includes('dividend') ||
                 headerLower.includes('previous day nav') ||
                 headerLower.includes('day p')) {
          bgColor = 'FFFD7E14'; // Orange
        }
        // Financial calculation fields - Green background
        else if (headerLower.includes('current value') ||
                 headerLower.includes('profit/loss') ||
                 headerLower.includes('profit') && headerLower.includes('loss')) {
          bgColor = 'FF28A745'; // Green
        }
      }
      
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      
      // Add border
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    data.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(row);
      
      // Style data cells
      dataRow.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        
        // Add border
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Format specific data types
        if (header && typeof header === 'string') {
          const headerLower = header.toLowerCase();
          const cellValue = cell.value;
          
          // Format currency fields
          if ((headerLower.includes('nav') || 
               headerLower.includes('amount') || 
               headerLower.includes('value') ||
               headerLower.includes('profit') ||
               headerLower.includes('expense')) && 
              cellValue && !isNaN(parseFloat(cellValue))) {
            cell.numFmt = '#,##0.00';
          }
          
          // Format percentage fields
          if (headerLower.includes('%') && cellValue && !isNaN(parseFloat(cellValue))) {
            cell.numFmt = '0.00%';
            // Convert to decimal if it's already a percentage
            if (parseFloat(cellValue) > 1) {
              cell.value = parseFloat(cellValue) / 100;
            }
          }
          
          // Format date fields
          if (headerLower.includes('date') && cellValue) {
            try {
              const date = new Date(cellValue);
              if (!isNaN(date.getTime())) {
                cell.value = date;
                cell.numFmt = 'dd/mm/yyyy';
              }
            } catch (e) {
              // Keep original value if date parsing fails
            }
          }
        }
      });
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, index) => {
      const header = headers[index];
      if (header) {
        let maxLength = header.toString().length;
        
        // Check data lengths
        data.forEach(row => {
          const cellValue = row[index];
          if (cellValue) {
            const cellLength = cellValue.toString().length;
            if (cellLength > maxLength) {
              maxLength = cellLength;
            }
          }
        });
        
        // Set column width with reasonable limits
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });

    // Add summary information
    const summaryStartRow = data.length + 3;
    worksheet.getCell(`A${summaryStartRow}`).value = 'Export Summary:';
    worksheet.getCell(`A${summaryStartRow}`).font = { bold: true };
    worksheet.getCell(`A${summaryStartRow + 1}`).value = `Total Records: ${data.length}`;
    worksheet.getCell(`A${summaryStartRow + 2}`).value = `Export Date: ${new Date().toLocaleString()}`;
    worksheet.getCell(`A${summaryStartRow + 3}`).value = `Exported by: ${userId}`;

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    setHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="MutualFund_Export.xlsx"'
    });

    return buffer;
  } catch (error) {
    console.error('Error exporting mutual fund data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export data'
    });
  }
});
