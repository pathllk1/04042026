import { getFirestore } from 'firebase-admin/firestore';
import ExcelJS from 'exceljs';

/**
 * API endpoint for exporting subs reports to Excel
 *
 * Handles GET operations to generate Excel reports for subs
 */
export default defineEventHandler(async (event) => {
  // Ensure user is authenticated
  const userId = event.context.userId;
  const firmId = event.context.user?.firmId;

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    });
  }

  // Get query parameters
  const query = getQuery(event);
  const subId = query.subId;
  const subName = query.subName;


  if (!subId && !subName) {
    throw createError({
      statusCode: 400,
      message: 'Either subId or subName parameter is required'
    });
  }


  try {
    // Get subs data from Firestore
    const db = getFirestore();
    const firmIdStr = firmId.toString();


    // Fetch transactions from the subs collection
    const subsCollection = db.collection('subs');
    let subsQuery = subsCollection
      .where('firmId', '==', firmIdStr);

    if (subName) {
      subsQuery = subsQuery.where('subName', '==', subName);
    } else if (subId) {
      subsQuery = subsQuery.where('subId', '==', subId);
    }

    // Execute the query
    const snapshot = await subsQuery.get();

    if (snapshot.empty) {
      throw createError({
        statusCode: 404,
        message: 'No sub transactions found with the given name'
      });
    }

    // Process the transactions
    const transactions = [];
    let actualSubName = subName;

    snapshot.forEach(doc => {
      const data = doc.data();

      // Keep track of the actual subName from the data
      if (!actualSubName && data.subName) {
        actualSubName = data.subName;
      }

      transactions.push({
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null
      });
    });


    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Create a subsModel object from the transactions
    const subsModel = {
      name: actualSubName,
      transactions: transactions,
      balance: 0 // We'll calculate this from the transactions
    };

    // Calculate the balance
    let balance = 0;
    for (const tx of transactions) {
      if (tx.category === 'PAYMENT') {
        balance -= Math.abs(tx.amount);
      } else if (tx.category === 'RECEIPT') {
        balance += Math.abs(tx.amount);
      }
    }
    subsModel.balance = balance;

    // Generate the Excel report
    const buffer = await generateSubsExcelReport(subsModel);

    // Set response headers for file download
    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Subs_Expense_Report_${subsModel.name}_${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': buffer.length
    });

    // Return the Excel buffer
    return buffer;
  } catch (error) {
    console.error('Error generating Subs Excel report:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate Subs Excel report'
    });
  }
});

/**
 * Generate an Excel report for a specific sub
 *
 * @param {Object} subsModel - The subs model with transactions
 * @returns {Promise<Buffer>} - Excel file as buffer
 */
async function generateSubsExcelReport(subsModel) {
  // Process the subs data for reporting
  const reportData = generateSubsReportData(subsModel);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expense Tracker';
  workbook.lastModifiedBy = 'Expense Tracker';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add a worksheet
  const worksheet = workbook.addWorksheet('Subs Report', {
    properties: {
      tabColor: { argb: '6366F1' }, // Indigo color
      defaultRowHeight: 20
    },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
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

  // Add report title
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Subs Expense Report - ${reportData.subName.toUpperCase()}`;
  titleCell.font = {
    name: 'Arial',
    size: 18,
    bold: true,
    color: { argb: '4F46E5' } // Indigo
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Add summary section
  const summaryStartRow = 3;

  worksheet.mergeCells(`A${summaryStartRow}:H${summaryStartRow}`);
  const summaryTitleCell = worksheet.getCell(`A${summaryStartRow}`);
  summaryTitleCell.value = 'Summary';
  summaryTitleCell.font = {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: '000000' }
  };
  summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(summaryStartRow).height = 24;

  // Add summary data
  const summaryRow = summaryStartRow + 1;
  worksheet.mergeCells(`A${summaryRow}:B${summaryRow}`);
  worksheet.mergeCells(`C${summaryRow}:D${summaryRow}`);
  worksheet.mergeCells(`E${summaryRow}:F${summaryRow}`);

  // Total Payments
  const paymentsCell = worksheet.getCell(`A${summaryRow}`);
  paymentsCell.value = 'Total Payments:';
  paymentsCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: 'DC2626' } // Red
  };
  paymentsCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const paymentsValueCell = worksheet.getCell(`B${summaryRow}`);
  paymentsValueCell.value = reportData.totalPayments;
  paymentsValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: 'DC2626' } // Red
  };
  paymentsValueCell.numFmt = '₹#,##0.00';
  paymentsValueCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Total Receipts
  const receiptsCell = worksheet.getCell(`C${summaryRow}`);
  receiptsCell.value = 'Total Receipts:';
  receiptsCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: '10B981' } // Green
  };
  receiptsCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const receiptsValueCell = worksheet.getCell(`D${summaryRow}`);
  receiptsValueCell.value = reportData.totalReceipts;
  receiptsValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: '10B981' } // Green
  };
  receiptsValueCell.numFmt = '₹#,##0.00';
  receiptsValueCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Net Amount
  const netCell = worksheet.getCell(`E${summaryRow}`);
  netCell.value = 'Net Amount:';
  netCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: reportData.netAmount >= 0 ? '10B981' : 'DC2626' } // Green or Red
  };
  netCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const netValueCell = worksheet.getCell(`F${summaryRow}`);
  netValueCell.value = reportData.netAmount;
  netValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: reportData.netAmount >= 0 ? '10B981' : 'DC2626' } // Green or Red
  };
  netValueCell.numFmt = '₹#,##0.00';
  netValueCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Style the summary row
  worksheet.getRow(summaryRow).height = 24;
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
    const cell = worksheet.getCell(`${col}${summaryRow}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F3F4F6' } // Light gray
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    };
  });

  // Add current balance row
  const balanceRow = summaryRow + 1;
  worksheet.mergeCells(`A${balanceRow}:B${balanceRow}`);
  worksheet.mergeCells(`C${balanceRow}:F${balanceRow}`);

  const balanceCell = worksheet.getCell(`A${balanceRow}`);
  balanceCell.value = 'Current Balance:';
  balanceCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: reportData.balance >= 0 ? '10B981' : 'DC2626' } // Green or Red
  };
  balanceCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const balanceValueCell = worksheet.getCell(`C${balanceRow}`);
  balanceValueCell.value = reportData.balance;
  balanceValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: reportData.balance >= 0 ? '10B981' : 'DC2626' } // Green or Red
  };
  balanceValueCell.numFmt = '₹#,##0.00';
  balanceValueCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Style the balance row
  worksheet.getRow(balanceRow).height = 24;
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
    const cell = worksheet.getCell(`${col}${balanceRow}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F3F4F6' } // Light gray
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } }
    };
  });

  // Add transaction details section
  const transactionStartRow = balanceRow + 2;

  // Create a table for Transaction Details
  worksheet.mergeCells(`A${transactionStartRow}:H${transactionStartRow}`);
  const transactionTitleCell = worksheet.getCell(`A${transactionStartRow}`);
  transactionTitleCell.value = 'Transaction Details';
  transactionTitleCell.font = {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: '000000' }
  };
  transactionTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(transactionStartRow).height = 24;

  // Add transaction table headers
  const transactionHeaderRow = transactionStartRow + 1;
  const transactionHeaders = ['Date', 'Paid To/From', 'Category', 'Project', 'Payment Mode', 'Description', 'Amount'];

  // Add headers to worksheet
  transactionHeaders.forEach((header, index) => {
    const cell = worksheet.getCell(transactionHeaderRow, index + 1);
    cell.value = header;
    cell.font = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: 'FFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: '4338CA' } },
      left: { style: 'thin', color: { argb: '4338CA' } },
      bottom: { style: 'thin', color: { argb: '4338CA' } },
      right: { style: 'thin', color: { argb: '4338CA' } }
    };
  });
  worksheet.getRow(transactionHeaderRow).height = 24;

  // Add transaction data
  let transactionRow = transactionHeaderRow + 1;

  if (reportData.transactions && reportData.transactions.length > 0) {
    reportData.transactions.forEach((transaction, index) => {
      // Format the data
      const rowData = [
        formatDateForDisplay(transaction.date),
        transaction.paidTo || '',
        transaction.category || 'PAYMENT',
        transaction.project || '-',
        transaction.paymentMode?.type || 'cash',
        transaction.description || '',
        transaction.amount || 0
      ];

      // Add row data to worksheet
      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(transactionRow, colIndex + 1);
        cell.value = value;

        // Format numbers and special fields
        if (typeof value === 'number' && colIndex === 6) { // Amount column
          cell.numFmt = '₹#,##0.00';
          cell.font = {
            name: 'Arial',
            size: 11,
            color: { argb: value >= 0 ? '10B981' : 'DC2626' } // Green or Red
          };
        } else if (colIndex === 2 && value === 'RECEIPT') { // Category column with RECEIPT
          cell.font = {
            name: 'Arial',
            size: 11,
            bold: true,
            color: { argb: '10B981' } // Green for receipts
          };
        } else if (colIndex === 5 && value.toString().toLowerCase().includes('cash receipt')) { // Description with cash receipt
          cell.font = {
            name: 'Arial',
            size: 11,
            bold: true,
            color: { argb: '10B981' } // Green for cash receipts
          };
        } else {
          cell.font = {
            name: 'Arial',
            size: 11,
            color: { argb: '000000' }
          };
        }

        cell.alignment = {
          horizontal: typeof value === 'number' ? 'right' : 'left',
          vertical: 'middle'
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });

      // Alternate row colors
      if (index % 2 === 1) {
        for (let i = 1; i <= transactionHeaders.length; i++) {
          const cell = worksheet.getCell(transactionRow, i);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F9FAFB' } // Very light gray
          };
        }
      }

      transactionRow++;
    });
  } else {
    // No transactions message
    worksheet.mergeCells(`A${transactionRow}:G${transactionRow}`);
    const noDataCell = worksheet.getCell(`A${transactionRow}`);
    noDataCell.value = 'No transactions available for this sub';
    noDataCell.font = {
      name: 'Arial',
      size: 12,
      italic: true,
      color: { argb: '6B7280' } // Gray
    };
    noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(transactionRow).height = 24;
    transactionRow++;
  }

  // Auto-size columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, cell => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(maxLength + 2, 30);
  });

  // Add footer
  const footerRow = transactionRow + 1;
  worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);
  footerCell.value = `Report generated on ${new Date().toLocaleString()}`;
  footerCell.font = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: { argb: '6B7280' } // Gray
  };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Process subs data for reporting
 *
 * @param {Object} subsModel - The subs model with transactions
 * @returns {Object} Report data object
 */
function generateSubsReportData(subsModel) {
  // Extract transactions from the subs model
  const transactions = subsModel.transactions || [];

  // Normalize transactions for display
  const normalizedTransactions = transactions.map(transaction => {
    // Create a copy of the transaction to avoid modifying the original
    const normalizedTransaction = { ...transaction };

    // For PAYMENT: ensure amount is negative
    // For RECEIPT: ensure amount is positive
    if (normalizedTransaction.category === 'PAYMENT') {
      normalizedTransaction.amount = -Math.abs(normalizedTransaction.amount);
    } else if (normalizedTransaction.category === 'RECEIPT') {
      normalizedTransaction.amount = Math.abs(normalizedTransaction.amount);
    }

    return normalizedTransaction;
  });

  // Calculate summary data
  const totalPayments = transactions
    .filter(tx => tx.category === 'PAYMENT')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalReceipts = transactions
    .filter(tx => tx.category === 'RECEIPT')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const netAmount = totalReceipts - totalPayments;

  return {
    subName: subsModel.name,
    balance: subsModel.balance || 0,
    totalPayments,
    totalReceipts,
    netAmount,
    transactions: normalizedTransactions
  };
}

/**
 * Format a date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

/**
 * Format a date for display in a more readable format
 */
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
