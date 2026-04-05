import ExcelJS from 'exceljs';

/**
 * Generate an Excel report from expense data
 *
 * @param {Object} reportData - The report data object
 * @returns {Promise<Buffer>} - Excel file as buffer
 */
export async function generateExcelReport(reportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expense Tracker';
  workbook.lastModifiedBy = 'Expense Tracker';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add a worksheet
  const worksheet = workbook.addWorksheet('Report', {
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
  const reportTitle = getReportTitle(reportData);
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = reportTitle;
  titleCell.font = {
    name: 'Arial',
    size: 16,
    bold: true,
    color: { argb: '4F46E5' } // Indigo
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Optional sub name below title
  let nextRowIdx = 2;
  if (reportData.subName) {
    worksheet.mergeCells(`A${nextRowIdx}:G${nextRowIdx}`);
    const subCell = worksheet.getCell(`A${nextRowIdx}`);
    subCell.value = `Sub: ${reportData.subName}`;
    subCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: '111827' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(nextRowIdx).height = 22;
    nextRowIdx++;
  }

  // Add report period if available
  if (reportData.timePeriod) {
    worksheet.mergeCells(`A${nextRowIdx}:G${nextRowIdx}`);
    const periodCell = worksheet.getCell(`A${nextRowIdx}`);
    periodCell.value = formatTimePeriod(reportData.timePeriod, reportData.reportType);
    periodCell.font = {
      name: 'Arial',
      size: 12,
      italic: true,
      color: { argb: '6B7280' } // Gray
    };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(nextRowIdx).height = 24;
    nextRowIdx++;
  }

  // Add summary section
  const summaryStartRow = nextRowIdx + 1;

  worksheet.mergeCells(`A${summaryStartRow}:G${summaryStartRow}`);
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

  // Total Payments (Expenses)
  const expensesCell = worksheet.getCell(`A${summaryRow}`);
  expensesCell.value = 'Total Payments:';
  expensesCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: 'DC2626' } // Red
  };
  expensesCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const expensesValueCell = worksheet.getCell(`B${summaryRow}`);
  expensesValueCell.value = reportData.summary.totalExpenses;
  expensesValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: 'DC2626' } // Red
  };
  expensesValueCell.numFmt = '₹#,##0.00';
  expensesValueCell.alignment = { horizontal: 'left', vertical: 'middle' };

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
  receiptsValueCell.value = reportData.summary.totalReceipts;
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
    color: { argb: reportData.summary.netAmount >= 0 ? '10B981' : 'DC2626' } // Green or Red
  };
  netCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const netValueCell = worksheet.getCell(`F${summaryRow}`);
  netValueCell.value = reportData.summary.netAmount;
  netValueCell.font = {
    name: 'Arial',
    size: 12,
    bold: true,
    color: { argb: reportData.summary.netAmount >= 0 ? '10B981' : 'DC2626' } // Green or Red
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

  // Add data section
  const dataStartRow = summaryRow + 2;

  worksheet.mergeCells(`A${dataStartRow}:G${dataStartRow}`);
  const dataTitleCell = worksheet.getCell(`A${dataStartRow}`);
  dataTitleCell.value = 'Detailed Data';
  dataTitleCell.font = {
    name: 'Arial',
    size: 14,
    bold: true,
    color: { argb: '000000' }
  };
  dataTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(dataStartRow).height = 24;

  // Add table headers based on report type
  const headerRow = dataStartRow + 1;
  let headers = [];

  switch (reportData.reportType) {
    case 'daily':
    case 'date-range':
      headers = ['Date', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'weekly':
      headers = ['Week', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'monthly':
      headers = ['Month', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'yearly':
      headers = ['Year', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'financial-year':
      headers = ['Financial Year', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'paidTo':
      headers = ['Paid To/From', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'category':
      headers = ['Category', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'project':
      headers = ['Project', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    case 'subs':
      headers = ['Sub', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
      break;
    default:
      headers = ['Date', 'Paid To/From', 'Category', 'Description', 'Amount', 'Running Balance'];
  }

  // Add headers to worksheet
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
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
  worksheet.getRow(headerRow).height = 24;

  // Add data rows
  let dataRow = headerRow + 1;

  if (reportData.data && reportData.data.length > 0) {
    reportData.data.forEach((item, index) => {
      const rowData = [];

      switch (reportData.reportType) {
        case 'daily':
        case 'date-range':
          rowData.push(
            formatDate(item.date),
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'weekly':
          rowData.push(
            item.week || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'monthly':
          rowData.push(
            formatMonth(item.month) || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'yearly':
          rowData.push(
            item.year || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'financial-year':
          rowData.push(
            `FY ${item.financialYear}` || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'paidTo':
          rowData.push(
            item.paidTo || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'category':
          rowData.push(
            item.category || 'Uncategorized',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'project':
          rowData.push(
            item.project || 'No Project',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        case 'subs':
          rowData.push(
            item.paidTo || '',
            item.count || 0,
            item.totalExpenses || 0,
            item.totalReceipts || 0,
            item.netAmount || 0
          );
          break;
        default:
          if (item.date) {
            rowData.push(
              formatDate(item.date),
              item.paidTo || '',
              item.category || 'PAYMENT',
              item.description || '',
              item.amount || 0,
              item.runningBalance || 0
            );
          }
      }

      // Add row data to worksheet
      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(dataRow, colIndex + 1);
        cell.value = value;

        // Format numbers
        if (typeof value === 'number') {
          if (colIndex >= 4 || (['daily','date-range','weekly','monthly','yearly','financial-year','paidTo','category','project','subs'].includes(reportData.reportType) && (colIndex === 2 || colIndex === 3 || colIndex === 4))) {
            cell.numFmt = '₹#,##0.00';
          }
        }

        // Style cells
        cell.font = {
          name: 'Arial',
          size: 11,
          color: { argb: '000000' }
        };

        // Color for amount columns
        const isGrouped = ['daily','date-range','weekly','monthly','yearly','financial-year','paidTo','category','project','subs'].includes(reportData.reportType);
        if (isGrouped) {
          if (colIndex === 2) {
            cell.font.color = { argb: 'DC2626' };
          } else if (colIndex === 3) {
            cell.font.color = { argb: '10B981' };
          } else if (colIndex === 4) {
            cell.font.color = { argb: value >= 0 ? '10B981' : 'DC2626' };
          }
        } else {
          const amountIndex = headers.length - 2; // Amount
          const runningIndex = headers.length - 1; // Running Balance
          if (colIndex === amountIndex || colIndex === runningIndex) {
            cell.font.color = { argb: value >= 0 ? '10B981' : 'DC2626' };
          }
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
        for (let i = 1; i <= headers.length; i++) {
          const cell = worksheet.getCell(dataRow, i);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F9FAFB' } // Very light gray
          };
        }
      }

      dataRow++;
    });
  } else {
    // No data message
    worksheet.mergeCells(`A${dataRow}:E${dataRow}`);
    const noDataCell = worksheet.getCell(`A${dataRow}`);
    noDataCell.value = 'No data available for this report';
    noDataCell.font = {
      name: 'Arial',
      size: 12,
      italic: true,
      color: { argb: '6B7280' } // Gray
    };
    noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(dataRow).height = 24;
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

  // Add transaction details section if available
  if (reportData.transactions && reportData.transactions.length > 0) {
    const transactionStartRow = dataRow + 2;

    // Create a table for Transaction Details
    worksheet.mergeCells(`A${transactionStartRow}:G${transactionStartRow}`);
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
    const transactionHeaders = ['Date', 'Paid To/From', 'Category', 'Payment Mode', 'Description', 'Amount'];

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
    reportData.transactions.forEach((transaction, index) => {
      // Format the data
      const rowData = [
        formatDate(transaction.date),
        transaction.paidTo || '',
        transaction.category || 'PAYMENT',
        transaction.paymentMode?.type || 'cash',
        transaction.description || '',
        transaction.amount || 0
      ];

      // Add row data to worksheet
      rowData.forEach((value, colIndex) => {
        const cell = worksheet.getCell(transactionRow, colIndex + 1);
        cell.value = value;

        // Format numbers
        if (typeof value === 'number' && colIndex === 5) { // Amount column
          cell.numFmt = '₹#,##0.00';
          cell.font = {
            name: 'Arial',
            size: 11,
            color: { argb: value >= 0 ? '10B981' : 'DC2626' } // Green or Red
          };
        } else {
          cell.font = {
            name: 'Arial',
            size: 11,
            color: { argb: '000000' }
          };
        }

        // Style cells
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

    dataRow = transactionRow;
  }

  // Add footer
  const footerRow = dataRow + 2;
  worksheet.mergeCells(`A${footerRow}:G${footerRow}`);
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
 * Format a date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

/**
 * Format a month string (YYYY-MM) for display
 */
function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Get a formatted report title
 */
function getReportTitle(reportData) {
  if (!reportData) return 'Expense Report';

  const type = reportData.reportType;
  const capitalized = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
  return `${capitalized} Expense Report`;
}

/**
 * Format time period for display
 */
function formatTimePeriod(timePeriod, reportType) {
  if (!timePeriod) return '';

  switch (reportType) {
    case 'weekly': {
      const [start, end] = timePeriod.split('|');
      return `Week of ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
    }

    case 'monthly': {
      const [year, month] = timePeriod.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    case 'yearly': {
      return `Year ${timePeriod}`;
    }

    case 'financial-year': {
      const [startYear, endYear] = timePeriod.split('-');
      return `Financial Year ${startYear}-${endYear}`;
    }

    default:
      return timePeriod;
  }
}
