/**
 * API endpoint for exporting stock market data
 *
 * Supports exporting investments, mutual funds, and portfolio data
 * in various formats (CSV, Excel, PDF)
 */
import { defineEventHandler, getQuery, readBody, createError } from 'h3';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Folio } from '../../../models/Folio';
import { MutualFund } from '../../../models/MutualFund';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const userId = event.context.userId;
    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get query parameters
    const query = getQuery(event);
    const dataType = query.type || 'investments'; // investments, mutualFunds, portfolio
    const format = query.format || 'excel'; // excel, csv, pdf

    // Fetch data based on type
    let data = [];
    let title = '';

    if (dataType === 'investments') {
      // Fetch investments data from MongoDB
      const investments = await Folio.find({ user: userId }).lean();

      if (!investments || investments.length === 0) {
        data = [];
      } else {
        data = investments.map(investment => {
          return {
            ...investment,
            id: investment._id.toString(),
            purchaseDate: investment.pdate ? investment.pdate.toISOString().split('T')[0] : '',
            // Map Folio fields to expected export fields
            symbol: investment.symbol,
            companyName: investment.symbol, // Using symbol as company name if not available
            purchasePrice: investment.price,
            quantity: investment.qnty,
            currentPrice: investment.cprice,
            currentValue: investment.cval,
            profitLoss: investment.pl,
            profitLossPercentage: investment.pl && investment.namt ? (investment.pl / investment.namt) * 100 : 0
          };
        });
      }

      title = 'Investment Data';
    }
    else if (dataType === 'mutualFunds') {
      // Fetch mutual funds data from MongoDB
      const mutualFunds = await MutualFund.find({ user: userId }).lean();

      if (!mutualFunds || mutualFunds.length === 0) {
        data = [];
      } else {
        data = mutualFunds.map(fund => {
          return {
            ...fund,
            id: fund._id.toString(),
            purchaseDate: fund.purchaseDate ? fund.purchaseDate.toISOString().split('T')[0] : ''
          };
        });
      }

      title = 'Mutual Fund Data';
    }
    else if (dataType === 'portfolio') {
      // Fetch both investments and mutual funds for portfolio from MongoDB
      const [investments, mutualFunds] = await Promise.all([
        Folio.find({ user: userId }).lean(),
        MutualFund.find({ user: userId }).lean()
      ]);

      const processedInvestments = investments.map(investment => {
        return {
          ...investment,
          id: investment._id.toString(),
          type: 'equity',
          purchaseDate: investment.pdate ? investment.pdate.toISOString().split('T')[0] : '',
          companyName: investment.symbol, // Using symbol as company name
          investmentAmount: investment.namt,
          currentValue: investment.cval,
          profitLoss: investment.pl,
          profitLossPercentage: investment.pl && investment.namt ? (investment.pl / investment.namt) * 100 : 0
        };
      });

      const processedMutualFunds = mutualFunds.map(fund => {
        return {
          ...fund,
          id: fund._id.toString(),
          type: 'mutualFund',
          purchaseDate: fund.purchaseDate ? fund.purchaseDate.toISOString().split('T')[0] : '',
          companyName: fund.schemeName, // Using scheme name as company name
          symbol: fund.schemeCode
        };
      });

      data = [...processedInvestments, ...processedMutualFunds];
      title = 'Portfolio Data';
    }
    else {
      throw createError({
        statusCode: 400,
        message: 'Invalid data type'
      });
    }

    // Generate export based on format
    if (format === 'excel') {
      return await generateExcelExport(data, title, dataType, event);
    }
    else if (format === 'csv') {
      return await generateCsvExport(data, title, dataType, event);
    }
    else if (format === 'pdf') {
      return await generatePdfExport(data, title, dataType, event);
    }
    else {
      throw createError({
        statusCode: 400,
        message: 'Invalid export format'
      });
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to export data'
    });
  }
});

/**
 * Generate Excel export
 */
async function generateExcelExport(data, title, dataType, event) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);

  // Define columns based on data type
  if (dataType === 'investments') {
    worksheet.columns = [
      { header: 'Symbol', key: 'symbol', width: 15 },
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 15 },
      { header: 'Current Price', key: 'currentPrice', width: 15 },
      { header: 'Current Value', key: 'currentValue', width: 15 },
      { header: 'Profit/Loss', key: 'profitLoss', width: 15 },
      { header: 'P/L %', key: 'profitLossPercentage', width: 15 }
    ];
  }
  else if (dataType === 'mutualFunds') {
    worksheet.columns = [
      { header: 'Scheme Name', key: 'schemeName', width: 40 },
      { header: 'Scheme Code', key: 'schemeCode', width: 15 },
      { header: 'Fund House', key: 'fundHouse', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Purchase NAV', key: 'purchaseNAV', width: 15 },
      { header: 'Units', key: 'units', width: 15 },
      { header: 'Investment Amount', key: 'investmentAmount', width: 15 },
      { header: 'Current NAV', key: 'currentNAV', width: 15 },
      { header: 'Current Value', key: 'currentValue', width: 15 },
      { header: 'Profit/Loss', key: 'profitLoss', width: 15 },
      { header: 'P/L %', key: 'profitLossPercentage', width: 15 },
      { header: 'SIP', key: 'sipFlag', width: 10 }
    ];
  }
  else if (dataType === 'portfolio') {
    worksheet.columns = [
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Name', key: 'companyName', width: 30 },
      { header: 'Symbol/Scheme', key: 'symbol', width: 20 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Investment Amount', key: 'investmentAmount', width: 15 },
      { header: 'Current Value', key: 'currentValue', width: 15 },
      { header: 'Profit/Loss', key: 'profitLoss', width: 15 },
      { header: 'P/L %', key: 'profitLossPercentage', width: 15 }
    ];
  }

  // Add rows
  worksheet.addRows(data);

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Set response headers
  setResponseHeaders(event, `${title.replace(/\s+/g, '_')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  return buffer;
}

/**
 * Generate CSV export
 */
async function generateCsvExport(data, title, dataType, event) {
  // Define fields based on data type
  let fields = [];

  if (dataType === 'investments') {
    fields = ['symbol', 'companyName', 'purchaseDate', 'purchasePrice', 'quantity', 'currentPrice', 'currentValue', 'profitLoss', 'profitLossPercentage'];
  }
  else if (dataType === 'mutualFunds') {
    fields = ['schemeName', 'schemeCode', 'fundHouse', 'category', 'purchaseDate', 'purchaseNAV', 'units', 'investmentAmount', 'currentNAV', 'currentValue', 'profitLoss', 'profitLossPercentage', 'sipFlag'];
  }
  else if (dataType === 'portfolio') {
    fields = ['type', 'companyName', 'symbol', 'purchaseDate', 'investmentAmount', 'currentValue', 'profitLoss', 'profitLossPercentage'];
  }

  // Generate CSV using custom function
  const csv = convertToCSV(data, fields);

  // Set response headers
  setResponseHeaders(event, `${title.replace(/\s+/g, '_')}.csv`, 'text/csv');

  return csv;
}

/**
 * Convert JSON data to CSV string
 * @param {Array} data - Array of objects to convert
 * @param {Array} fields - Array of field names to include
 * @returns {string} CSV formatted string
 */
function convertToCSV(data, fields) {
  if (!data || !data.length) {
    return '';
  }

  // Create header row
  const header = fields.join(',');

  // Create data rows
  const rows = data.map(item => {
    return fields.map(field => {
      const value = item[field];

      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      }

      // Convert to string and escape special characters
      const stringValue = String(value);

      // If the value contains commas, quotes, or newlines, wrap it in quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        // Double up any quotes to escape them
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',');
  }).join('\n');

  // Combine header and rows
  return `${header}\n${rows}`;
}

/**
 * Generate PDF export using PDFKit
 */
async function generatePdfExport(data, title, dataType, event) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      // Create buffer to collect PDF data
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text(title, 50, 50);

      // Add date
      const date = new Date().toLocaleDateString();
      doc.fontSize(12).font('Helvetica').fillColor('gray').text(`Generated on: ${date}`, 50, 80);

      // Reset color for content
      doc.fillColor('black');

      // Add data as table
      let yPosition = 120;
      const rowHeight = 20;
      const colWidths = [100, 150, 100, 100];

      // Add header row
      let xPosition = 50;
      let headers = [];

      if (dataType === 'investments') {
        headers = ['Symbol', 'Company', 'Purchase Price', 'Current Value'];
      }
      else if (dataType === 'mutualFunds') {
        headers = ['Scheme Name', 'Fund House', 'Investment', 'Current Value'];
      }
      else if (dataType === 'portfolio') {
        headers = ['Type', 'Name', 'Investment', 'Current Value'];
      }

      // Draw header row
      headers.forEach((header, index) => {
        doc.fontSize(12).font('Helvetica-Bold').text(header, xPosition, yPosition, {
          width: colWidths[index],
          align: 'left'
        });
        xPosition += colWidths[index];
      });

      yPosition += rowHeight;

      // Add data rows (limited to fit on page)
      const maxRows = Math.min(data.length, 20); // Limit to 20 rows for simplicity

      for (let i = 0; i < maxRows; i++) {
        const item = data[i];
        xPosition = 50;

        if (dataType === 'investments') {
          doc.fontSize(10).font('Helvetica').text(item.symbol || '', xPosition, yPosition, {
            width: colWidths[0],
            align: 'left'
          });
          xPosition += colWidths[0];

          doc.text(item.companyName || '', xPosition, yPosition, {
            width: colWidths[1],
            align: 'left'
          });
          xPosition += colWidths[1];

          doc.text(item.purchasePrice?.toString() || '', xPosition, yPosition, {
            width: colWidths[2],
            align: 'left'
          });
          xPosition += colWidths[2];

          doc.text(item.currentValue?.toString() || '', xPosition, yPosition, {
            width: colWidths[3],
            align: 'left'
          });
        }
        else if (dataType === 'mutualFunds') {
          doc.fontSize(10).font('Helvetica').text(item.schemeName?.substring(0, 20) || '', xPosition, yPosition, {
            width: colWidths[0],
            align: 'left'
          });
          xPosition += colWidths[0];

          doc.text(item.fundHouse?.substring(0, 15) || '', xPosition, yPosition, {
            width: colWidths[1],
            align: 'left'
          });
          xPosition += colWidths[1];

          doc.text(item.investmentAmount?.toString() || '', xPosition, yPosition, {
            width: colWidths[2],
            align: 'left'
          });
          xPosition += colWidths[2];

          doc.text(item.currentValue?.toString() || '', xPosition, yPosition, {
            width: colWidths[3],
            align: 'left'
          });
        }
        else if (dataType === 'portfolio') {
          doc.fontSize(10).font('Helvetica').text(item.type || '', xPosition, yPosition, {
            width: colWidths[0],
            align: 'left'
          });
          xPosition += colWidths[0];

          const name = item.type === 'equity' ? (item.companyName || item.symbol) : (item.schemeName || '');
          doc.text(name.substring(0, 20) || '', xPosition, yPosition, {
            width: colWidths[1],
            align: 'left'
          });
          xPosition += colWidths[1];

          doc.text(item.investmentAmount?.toString() || '', xPosition, yPosition, {
            width: colWidths[2],
            align: 'left'
          });
          xPosition += colWidths[2];

          doc.text(item.currentValue?.toString() || '', xPosition, yPosition, {
            width: colWidths[3],
            align: 'left'
          });
        }

        yPosition += rowHeight;

        // Add a new page if needed
        if (yPosition > 750 && i < maxRows - 1) {
          doc.addPage();
          yPosition = 50;
        }
      }

      // Add note if data was truncated
      if (data.length > maxRows) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('red')
           .text(`Note: Only showing ${maxRows} of ${data.length} items. Export to Excel or CSV for complete data.`, 50, yPosition + 30);
      }

      // Set response headers
      setResponseHeaders(event, `${title.replace(/\s+/g, '_')}.pdf`, 'application/pdf');

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Set response headers for file download
 */
function setResponseHeaders(event, filename, contentType) {
  if (event && event.node && event.node.res) {
    event.node.res.setHeader('Content-Type', contentType);
    event.node.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  } else {
    console.error('Error: event or event.node.res is undefined');
    throw new Error('Cannot set response headers: event is not properly defined');
  }
}
