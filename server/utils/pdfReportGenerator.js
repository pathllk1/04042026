import PDFDocument from 'pdfkit';

/**
 * Generate a PDF report from expense data
 *
 * @param {Object} reportData - The report data object
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
export async function generatePDFReport(reportData) {
  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        info: {
          Title: `${getReportTitle(reportData)}`,
          Author: 'Expense Tracker',
          Subject: 'Expense Report',
          Keywords: 'expenses, finance, report',
          Creator: 'Expense Tracker',
          Producer: 'PDFKit'
        }
      });

      // Collect the PDF data chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add company logo or header image if available
      // doc.image('path/to/logo.png', 50, 45, { width: 50 });

      // Add report title
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor('#4F46E5') // Indigo
         .text(getReportTitle(reportData), { align: 'center' });

      // Add report period if available
      if (reportData.timePeriod) {
        doc.moveDown(0.5)
           .font('Helvetica-Oblique')
           .fontSize(12)
           .fillColor('#6B7280') // Gray
           .text(formatTimePeriod(reportData.timePeriod, reportData.reportType), { align: 'center' });
      }

      // Add a horizontal line
      doc.moveDown(1)
         .strokeColor('#E5E7EB')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke();

      // Add summary section
      doc.moveDown(1)
         .font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('Summary', { continued: false });

      // Create a summary table
      doc.moveDown(0.5);
      const summaryTableTop = doc.y;
      const summaryTableWidth = doc.page.width - 100;

      // Draw summary table background
      doc.rect(50, summaryTableTop, summaryTableWidth, 40)
         .fillAndStroke('#F3F4F6', '#D1D5DB');

      // Add summary data
      const colWidth = summaryTableWidth / 3;

      // Total Payments (Expenses)
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text('Total Payments:', 60, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text(formatCurrency(reportData.summary.totalExpenses), 60 + colWidth - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Total Receipts
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text('Total Receipts:', 60 + colWidth, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text(formatCurrency(reportData.summary.totalReceipts), 60 + colWidth * 2 - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Net Amount
      const netColor = reportData.summary.netAmount >= 0 ? '#10B981' : '#DC2626'; // Green or Red

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text('Net Amount:', 60 + colWidth * 2, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text(formatCurrency(reportData.summary.netAmount), 60 + colWidth * 3 - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Add data section
      doc.moveDown(2)
         .font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('Detailed Data', { continued: false });

      doc.moveDown(0.5);

      // Determine table headers based on report type
      let headers = [];
      let columnWidths = [];

      switch (reportData.reportType) {
        case 'daily':
        case 'date-range':
          headers = ['Date', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2]; // Proportions
          break;
        case 'weekly':
          headers = ['Week', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'monthly':
          headers = ['Month', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'yearly':
          headers = ['Year', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'financial-year':
          headers = ['Financial Year', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'paidTo':
          headers = ['Paid To/From', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'category':
          headers = ['Category', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'project':
          headers = ['Project', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        case 'subs':
          headers = ['Sub', 'Transactions', 'Payments', 'Receipts', 'Net Amount'];
          columnWidths = [0.25, 0.15, 0.2, 0.2, 0.2];
          break;
        default:
          headers = ['Date', 'Paid To/From', 'Category', 'Amount'];
          columnWidths = [0.2, 0.3, 0.25, 0.25];
      }

      // Calculate actual column widths
      const tableWidth = doc.page.width - 100;
      const actualColumnWidths = columnWidths.map(width => tableWidth * width);

      // Draw table header
      const tableTop = doc.y;
      let currentTop = tableTop;

      // Header background
      doc.rect(50, currentTop, tableWidth, 30)
         .fillAndStroke('#4F46E5', '#4338CA'); // Indigo

      // Header text
      let currentLeft = 50;
      headers.forEach((header, index) => {
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#FFFFFF') // White
           .text(
             header,
             currentLeft + 5,
             currentTop + 10,
             { width: actualColumnWidths[index] - 10, align: 'center' }
           );
        currentLeft += actualColumnWidths[index];
      });

      currentTop += 30;

      // Draw table rows
      if (reportData.data && reportData.data.length > 0) {
        reportData.data.forEach((item, rowIndex) => {
          // Check if we need a new page
          if (currentTop > doc.page.height - 100) {
            doc.addPage();
            currentTop = 50;

            // Add page header
            doc.font('Helvetica')
               .fontSize(10)
               .fillColor('#6B7280') // Gray
               .text(`${getReportTitle(reportData)} - Page ${doc.bufferedPageRange().count}`, { align: 'center' });

            // Add table header on new page
            currentTop = doc.y + 20;

            // Header background
            doc.rect(50, currentTop, tableWidth, 30)
               .fillAndStroke('#4F46E5', '#4338CA'); // Indigo

            // Header text
            let headerLeft = 50;
            headers.forEach((header, index) => {
              doc.font('Helvetica-Bold')
                 .fontSize(10)
                 .fillColor('#FFFFFF') // White
                 .text(
                   header,
                   headerLeft + 5,
                   currentTop + 10,
                   { width: actualColumnWidths[index] - 10, align: 'center' }
                 );
              headerLeft += actualColumnWidths[index];
            });

            currentTop += 30;
          }

          // Row background (alternate colors)
          const rowColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
          doc.rect(50, currentTop, tableWidth, 25)
             .fillAndStroke(rowColor, '#E5E7EB');

          // Row data
          let rowData = [];

          switch (reportData.reportType) {
            case 'daily':
            case 'date-range':
              rowData = [
                formatDate(item.date),
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'weekly':
              rowData = [
                item.week || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'monthly':
              rowData = [
                formatMonth(item.month) || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'yearly':
              rowData = [
                item.year || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'financial-year':
              rowData = [
                `FY ${item.financialYear}` || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'paidTo':
              rowData = [
                item.paidTo || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'category':
              rowData = [
                item.category || 'Uncategorized',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'project':
              rowData = [
                item.project || 'No Project',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            case 'subs':
              rowData = [
                item.paidTo || '',
                item.count || 0,
                formatCurrency(item.totalExpenses || 0),
                formatCurrency(item.totalReceipts || 0),
                formatCurrency(item.netAmount || 0)
              ];
              break;
            default:
              if (item.date) {
                rowData = [
                  formatDate(item.date),
                  item.paidTo || '',
                  item.category || 'PAYMENT',
                  formatCurrency(item.amount || 0)
                ];
              }
          }

          // Add row data
          let cellLeft = 50;
          rowData.forEach((value, index) => {
            // Determine text color for amount columns
            let textColor = '#000000';

            if (index === 2) { // Expenses
              textColor = '#DC2626'; // Red
            } else if (index === 3) { // Receipts
              textColor = '#10B981'; // Green
            } else if (index === 4) { // Net Amount
              const numValue = typeof value === 'string' ?
                parseFloat(value.replace(/[^0-9.-]+/g, '')) :
                value;
              textColor = numValue >= 0 ? '#10B981' : '#DC2626'; // Green or Red
            }

            // Determine alignment (check for Rs. instead of ₹ for PDF compatibility)
            const isNumber = typeof value === 'number' ||
                            (typeof value === 'string' && (value.startsWith('₹') || value.startsWith('Rs.')));
            const align = isNumber && index > 0 ? 'right' : 'left';

            doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(9)
               .fillColor(textColor)
               .text(
                 value.toString(),
                 cellLeft + 5,
                 currentTop + 8,
                 {
                   width: actualColumnWidths[index] - 10,
                   align: align,
                   lineBreak: false,
                   ellipsis: true
                 }
               );

            cellLeft += actualColumnWidths[index];
          });

          currentTop += 25;
        });
      } else {
        // No data message
        doc.font('Helvetica-Oblique')
           .fontSize(12)
           .fillColor('#6B7280') // Gray
           .text('No data available for this report', 50, currentTop + 20, { align: 'center' });

        currentTop += 40;
      }

      // Add transaction details section
      if (reportData.transactions && reportData.transactions.length > 0) {
        // Add a page break if we're close to the bottom
        if (currentTop > doc.page.height - 200) {
          doc.addPage();
          currentTop = 50;

          // Add page header
          doc.font('Helvetica')
             .fontSize(10)
             .fillColor('#6B7280') // Gray
             .text(`${getReportTitle(reportData)} - Page ${doc.bufferedPageRange().count}`, { align: 'center' });

          currentTop = doc.y + 20;
        }

        // Add transaction details title
        doc.moveDown(1.5)
           .font('Helvetica-Bold')
           .fontSize(14)
           .fillColor('#000000')
           .text('Transaction Details', { continued: false });

        doc.moveDown(0.5);
        currentTop = doc.y;

        // Define transaction table headers
        const transactionHeaders = ['Date', 'Paid To/From', 'Category', 'Payment Mode', 'Description', 'Amount'];
        const transactionColumnWidths = [0.15, 0.2, 0.15, 0.15, 0.2, 0.15]; // Proportions

        // Calculate actual column widths
        const transactionTableWidth = doc.page.width - 100;
        const actualTransactionColumnWidths = transactionColumnWidths.map(width => transactionTableWidth * width);

        // Draw transaction table header
        doc.rect(50, currentTop, transactionTableWidth, 30)
           .fillAndStroke('#4F46E5', '#4338CA'); // Indigo

        // Header text
        let headerLeft = 50;
        transactionHeaders.forEach((header, index) => {
          doc.font('Helvetica-Bold')
             .fontSize(10)
             .fillColor('#FFFFFF') // White
             .text(
               header,
               headerLeft + 5,
               currentTop + 10,
               { width: actualTransactionColumnWidths[index] - 10, align: 'center' }
             );
          headerLeft += actualTransactionColumnWidths[index];
        });

        currentTop += 30;

        // Draw transaction rows
        reportData.transactions.forEach((transaction, rowIndex) => {
          // Check if we need a new page
          if (currentTop > doc.page.height - 50) {
            doc.addPage();
            currentTop = 50;

            // Add page header
            doc.font('Helvetica')
               .fontSize(10)
               .fillColor('#6B7280') // Gray
               .text(`${getReportTitle(reportData)} - Transaction Details - Page ${doc.bufferedPageRange().count}`, { align: 'center' });

            // Add table header on new page
            currentTop = doc.y + 20;

            // Header background
            doc.rect(50, currentTop, transactionTableWidth, 30)
               .fillAndStroke('#4F46E5', '#4338CA'); // Indigo

            // Header text
            let headerLeft = 50;
            transactionHeaders.forEach((header, index) => {
              doc.font('Helvetica-Bold')
                 .fontSize(10)
                 .fillColor('#FFFFFF') // White
                 .text(
                   header,
                   headerLeft + 5,
                   currentTop + 10,
                   { width: actualTransactionColumnWidths[index] - 10, align: 'center' }
                 );
              headerLeft += actualTransactionColumnWidths[index];
            });

            currentTop += 30;
          }

          // Row background (alternate colors)
          const rowColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
          doc.rect(50, currentTop, transactionTableWidth, 25)
             .fillAndStroke(rowColor, '#E5E7EB');

          // Row data
          const rowData = [
            formatDate(transaction.date),
            transaction.paidTo || '',
            transaction.category || 'PAYMENT',
            transaction.paymentMode?.type || 'cash',
            transaction.description || '',
            formatCurrency(transaction.amount || 0)
          ];

          // Add row data
          let cellLeft = 50;
          rowData.forEach((value, index) => {
            // Determine text color for amount column
            let textColor = '#000000';

            if (index === 5) { // Amount column
              const numValue = typeof value === 'string' ?
                parseFloat(value.replace(/[^0-9.-]+/g, '')) :
                value;
              textColor = numValue >= 0 ? '#10B981' : '#DC2626'; // Green for positive, Red for negative
            }

            // Determine alignment (check for Rs. instead of ₹ for PDF compatibility)
            const isNumber = typeof value === 'number' ||
                          (typeof value === 'string' && (value.startsWith('₹') || value.startsWith('Rs.')));
            const align = isNumber && index === 5 ? 'right' : 'left';

            doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica')
               .fontSize(9)
               .fillColor(textColor)
               .text(
                 value.toString(),
                 cellLeft + 5,
                 currentTop + 8,
                 {
                   width: actualTransactionColumnWidths[index] - 10,
                   align: align,
                   lineBreak: false,
                   ellipsis: true
                 }
               );

            cellLeft += actualTransactionColumnWidths[index];
          });

          currentTop += 25;
        });
      }

      // Add footer
      doc.font('Helvetica-Oblique')
         .fontSize(8)
         .fillColor('#6B7280') // Gray
         .text(
           `Report generated on ${new Date().toLocaleString()}`,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Format a currency value with Indian number formatting (using Rs. for PDF compatibility)
 */
function formatCurrency(value, showSymbol = false) {
  const formattedNumber = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return showSymbol ? `Rs.${formattedNumber}` : formattedNumber;
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
