// server/api/inventory/export/excel.js
import { defineEventHandler, createError, getQuery, setResponseHeaders } from 'h3';
import Stocks from '../../../models/inventory/Stocks';
import StockReg from '../../../models/inventory/StockReg';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

/**
 * API endpoint for exporting stock items to Excel
 *
 * Handles GET operations to generate Excel reports for stock items
 */
export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Get query parameters
    const query = getQuery(event);
    const searchTerm = query.search ? String(query.search) : '';
    const includeHistory = query.includeHistory === 'true';

    // Build filter
    const filter = {
      firm: user.firmId
    };

    // Add search filter if provided
    if (searchTerm) {
      filter.$or = [
        { item: { $regex: searchTerm, $options: 'i' } },
        { pno: { $regex: searchTerm, $options: 'i' } },
        { batch: { $regex: searchTerm, $options: 'i' } },
        { hsn: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Get all stocks without pagination
    const stocks = await Stocks.find(filter).sort({ item: 1 });

    // Get stock registration data if requested
    let stockRegs = [];
    if (includeHistory && stocks.length > 0) {
      const stockIds = stocks.map(stock => stock._id);
      stockRegs = await StockReg.find({
        stockId: { $in: stockIds },
        firm: user.firmId
      }).sort({ bdate: -1 });

      // Group stock registrations by stockId
      stockRegs = stockRegs.reduce((acc, reg) => {
        const stockId = reg.stockId.toString();
        if (!acc[stockId]) {
          acc[stockId] = [];
        }
        acc[stockId].push(reg);
        return acc;
      }, {});
    }

    // Generate Excel file
    const buffer = await generateStockExcelReport(stocks, stockRegs, includeHistory);

    // Set response headers for file download
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Stock_Items_Report_${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': buffer.length
    });

    // Return the Excel buffer
    return buffer;
  } catch (error) {
    console.error('Error generating stock Excel report:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate stock Excel report'
    });
  }
});

/**
 * Generate an Excel report for stock items
 *
 * @param {Array} stocks - The stock items
 * @param {Object} stockRegs - The stock registration data grouped by stockId
 * @param {Boolean} includeHistory - Whether to include transaction history
 * @returns {Promise<Buffer>} - Excel file as buffer
 */
async function generateStockExcelReport(stocks, stockRegs, includeHistory) {
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Inventory Management';
  workbook.lastModifiedBy = 'Inventory Management';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add main worksheet for stock items
  const worksheet = workbook.addWorksheet('Stock Items', {
    properties: {
      tabColor: { argb: '4F46E5' }, // Indigo color
      defaultRowHeight: 20
    },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7, right: 0.7,
        top: 0.75, bottom: 0.75,
        header: 0.3, footer: 0.3
      }
    }
  });

  // Define columns
  worksheet.columns = [
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Part No', key: 'pno', width: 15 },
    { header: 'Batch', key: 'batch', width: 15 },
    { header: 'OEM', key: 'oem', width: 15 },
    { header: 'HSN', key: 'hsn', width: 15 },
    { header: 'Quantity', key: 'qty', width: 12 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'GST Rate', key: 'grate', width: 12 },
    { header: 'Total Value', key: 'total', width: 15 },
    { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E0E7FF' } // Light indigo background
  };

  // Add stock data
  stocks.forEach(stock => {
    worksheet.addRow({
      item: stock.item,
      pno: stock.pno || '',
      batch: stock.batch || '',
      oem: stock.oem || '',
      hsn: stock.hsn,
      qty: stock.qty,
      uom: stock.uom,
      rate: stock.rate,
      grate: stock.grate / 100, // Convert GST rate to decimal for proper percentage formatting
      total: stock.total,
      updatedAt: stock.updatedAt ? new Date(stock.updatedAt).toLocaleString() : ''
    });
  });

  // Format number columns
  worksheet.getColumn('qty').numFmt = '#,##0.00';
  worksheet.getColumn('rate').numFmt = '₹#,##0.00';
  worksheet.getColumn('grate').numFmt = '0.00%'; // Simplified percentage format
  worksheet.getColumn('total').numFmt = '₹#,##0.00';

  // Add total row
  const totalRow = worksheet.addRow({
    item: 'TOTAL',
    qty: stocks.reduce((sum, stock) => sum + stock.qty, 0),
    total: stocks.reduce((sum, stock) => sum + stock.total, 0)
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F9FF' } // Light blue background
  };

  // Add transaction history worksheet if requested
  if (includeHistory && Object.keys(stockRegs).length > 0) {
    const historyWorksheet = workbook.addWorksheet('Transaction History', {
      properties: {
        tabColor: { argb: '10B981' }, // Green color
        defaultRowHeight: 20
      },
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });

    // Define columns for history worksheet
    historyWorksheet.columns = [
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Bill No', key: 'bno', width: 15 },
      { header: 'Date', key: 'bdate', width: 15 },
      { header: 'Party', key: 'supply', width: 25 },
      { header: 'HSN', key: 'hsn', width: 15 },
      { header: 'Quantity', key: 'qty', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Rate', key: 'rate', width: 12 },
      { header: 'GST Rate', key: 'grate', width: 12 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Project', key: 'project', width: 20 }
    ];

    // Style the header row
    historyWorksheet.getRow(1).font = { bold: true, size: 12 };
    historyWorksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'DCFCE7' } // Light green background
    };

    // Add transaction history data
    let rowCount = 0;
    stocks.forEach(stock => {
      const stockId = stock._id.toString();
      const history = stockRegs[stockId] || [];

      if (history.length > 0) {
        history.forEach(transaction => {
          rowCount++;
          const row = historyWorksheet.addRow({
            item: stock.item,
            type: transaction.type,
            bno: transaction.bno,
            bdate: transaction.bdate ? new Date(transaction.bdate).toLocaleDateString() : '',
            supply: transaction.supply,
            hsn: transaction.hsn,
            qty: transaction.qty,
            uom: transaction.uom,
            rate: transaction.rate,
            grate: transaction.grate ? transaction.grate / 100 : 0, // Convert GST rate to decimal for proper percentage formatting
            total: transaction.total,
            project: transaction.project || ''
          });

          // Color rows based on transaction type
          if (transaction.type === 'PURCHASE') {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F0FDF4' } // Very light green
            };
          } else if (transaction.type === 'SALE') {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FEF2F2' } // Very light red
            };
          }
        });
      }
    });

    // Format number columns
    historyWorksheet.getColumn('qty').numFmt = '#,##0.00';
    historyWorksheet.getColumn('rate').numFmt = '₹#,##0.00';
    historyWorksheet.getColumn('grate').numFmt = '0.00%'; // Format GST rate as percentage
    historyWorksheet.getColumn('total').numFmt = '₹#,##0.00';
  }

  // Generate buffer
  return await workbook.xlsx.writeBuffer();
}
