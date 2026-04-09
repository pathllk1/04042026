// server/api/inventory/bills-export.ts
import { defineEventHandler, createError, getQuery } from 'h3';
import ExcelJS from 'exceljs';
import Bills from '../../models/inventory/Bills';

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated and has a firmId
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
    });
  }

  const firmId = user.firmId.toString();

  try {
    // Get query parameters for filtering
    const query = getQuery(event);
    const { filterType, dateFrom, dateTo, searchQuery } = query;

    // Build filter object
    const filter: any = { firm: firmId };

    // Apply bill type filter
    if (filterType) {
      filter.btype = filterType;
    }

    // Apply date range filter
    if (dateFrom || dateTo) {
      filter.bdate = {};
      if (dateFrom) {
        filter.bdate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        // Set time to end of day for the to-date
        const toDate = new Date(dateTo as string);
        toDate.setHours(23, 59, 59, 999);
        filter.bdate.$lte = toDate;
      }
    }

    // Fetch bills data with filters
    let bills = await Bills.find(filter)
      .populate('stockRegIds')
      .sort({ bdate: -1 })
      .lean();

    // Apply search filter if provided (client-side filtering for complex searches)
    if (searchQuery) {
      const query = (searchQuery as string).toLowerCase();
      bills = bills.filter(bill => {
        // Search in bill properties
        return Object.keys(bill).some(key => {
          const value = bill[key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          } else if (typeof value === 'number') {
            return value.toString().includes(query);
          }
          return false;
        }) ||
        // Search in stock items if they exist
        (bill.stockRegIds && bill.stockRegIds.some(item => {
          return Object.keys(item).some(key => {
            const value = item[key];
            if (typeof value === 'string') {
              return value.toLowerCase().includes(query);
            } else if (typeof value === 'number') {
              return value.toString().includes(query);
            }
            return false;
          });
        }));
      });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bills');

    // Define columns with styling
    worksheet.columns = [
      { header: 'Bill No', key: 'bno', width: 10 },
      { header: 'Date', key: 'bdate', width: 12 },
      { header: 'Type', key: 'btype', width: 12 },
      { header: 'Supplier', key: 'supply', width: 20 },
      { header: 'GSTIN', key: 'gstin', width: 15 },
      { header: 'Gross Total (₹)', key: 'gtot', width: 15 },
      { header: 'Net Total (₹)', key: 'ntot', width: 15 }
    ];

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add data rows
    bills.forEach((bill) => {
      worksheet.addRow({
        bno: bill.bno,
        bdate: new Date(bill.bdate).toLocaleDateString(),
        btype: bill.btype,
        supply: bill.supply,
        gstin: bill.gstin,
        gtot: bill.gtot,
        ntot: bill.ntot
      });
    });

    // Format currency columns
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) {
        ['gtot', 'ntot'].forEach((key) => {
          const cell = row.getCell(key);
          cell.numFmt = '"₹"#,##0.00';
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Add total row
    const totalRow = worksheet.addRow({
      bno: 'TOTAL',
      bdate: '',
      btype: '',
      supply: '',
      gstin: '',
      gtot: { formula: `SUM(F2:F${bills.length + 1})` },
      ntot: { formula: `SUM(G2:G${bills.length + 1})` }
    });

    // Style total row
    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    event.node.res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    event.node.res.setHeader('Content-Disposition', `attachment; filename=bills_export_${new Date().toISOString().slice(0, 10)}.xlsx`);

    // Send the buffer as response
    return buffer;
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error generating Excel file: ${error.message}`
    });
  }
});