import { getFirestore } from 'firebase-admin/firestore';
import PDFDocument from 'pdfkit';

/**
 * API endpoint for exporting subs reports to PDF
 *
 * Handles GET operations to generate PDF reports for subs
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
  const paidTo = query.paidTo;

  if (!subId && !paidTo) {
    throw createError({
      statusCode: 400,
      message: 'Either subId or paidTo parameter is required'
    });
  }


  try {
    // Get subs data from Firestore
    const db = getFirestore();
    const subsCollection = db.collection('subs');
    const firmIdStr = firmId.toString();

    // Build the query
    let subsQuery;

    if (subId) {
      subsQuery = subsCollection.doc(subId);
    } else if (paidTo) {
      subsQuery = subsCollection.where('firmId', '==', firmIdStr).where('name', '==', paidTo).limit(1);
    }

    // Execute the query
    let subsModel;

    if (subId) {
      // If we have a subId, get the document directly
      const doc = await subsQuery.get();
      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          message: 'Sub not found'
        });
      }
      subsModel = {
        id: doc.id,
        ...doc.data(),
      };
    } else {
      // If we're querying by name
      const snapshot = await subsQuery.get();
      if (snapshot.empty) {
        throw createError({
          statusCode: 404,
          message: 'Sub not found'
        });
      }

      // Get the first matching document
      const doc = snapshot.docs[0];
      subsModel = {
        id: doc.id,
        ...doc.data(),
      };
    }

    // Process dates in transactions
    if (subsModel.transactions) {
      subsModel.transactions = subsModel.transactions.map(tx => ({
        ...tx,
        date: tx.date?.toDate ? tx.date.toDate() : new Date(tx.date)
      }));

      // Sort transactions by date (newest first)
      subsModel.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      subsModel.transactions = [];
    }

    // Generate the PDF report
    const buffer = await generateSubsPdfReport(subsModel);

    // Set response headers for file download
    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Subs_Expense_Report_${subsModel.name}_${new Date().toISOString().split('T')[0]}.pdf"`,
      'Content-Length': buffer.length
    });

    // Return the PDF buffer
    return buffer;
  } catch (error) {
    console.error('Error generating Subs PDF report:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate Subs PDF report'
    });
  }
});

/**
 * Generate a PDF report for a specific sub
 *
 * @param {Object} subsModel - The subs model with transactions
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
async function generateSubsPdfReport(subsModel) {
  // Process the subs data for reporting
  const reportData = generateSubsReportData(subsModel);

  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        info: {
          Title: `Subs Expense Report - ${reportData.subName}`,
          Author: 'Expense Tracker',
          Subject: 'Subs Expense Report',
          Keywords: 'expenses, finance, report, subs',
          Creator: 'Expense Tracker',
          Producer: 'PDFKit'
        }
      });

      // Collect the PDF data chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add report title
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .fillColor('#4F46E5') // Indigo
         .text(`Subs Expense Report - ${reportData.subName}`, { align: 'center' });

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
      doc.rect(50, summaryTableTop, summaryTableWidth, 70)
         .fillAndStroke('#F3F4F6', '#D1D5DB');

      // Add summary data
      const colWidth = summaryTableWidth / 3;

      // Total Payments
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text('Total Payments:', 60, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text(formatCurrency(reportData.totalPayments), 60 + colWidth - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Total Receipts
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text('Total Receipts:', 60 + colWidth, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text(formatCurrency(reportData.totalReceipts), 60 + colWidth * 2 - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Net Amount
      const netColor = reportData.netAmount >= 0 ? '#10B981' : '#DC2626'; // Green or Red
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text('Net Amount:', 60 + colWidth * 2, summaryTableTop + 15, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text(formatCurrency(reportData.netAmount), 60 + colWidth * 3 - 80, summaryTableTop + 15, { width: 70, align: 'right' });

      // Current Balance
      const balanceColor = reportData.balance >= 0 ? '#10B981' : '#DC2626'; // Green or Red
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(balanceColor)
         .text('Current Balance:', 60, summaryTableTop + 45, { width: colWidth - 20, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(balanceColor)
         .text(formatCurrency(reportData.balance), 60 + colWidth - 80, summaryTableTop + 45, { width: 70, align: 'right' });

      // Add transaction details section
      doc.moveDown(2)
         .font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('Transaction Details', { continued: false });

      doc.moveDown(0.5);
      let currentTop = doc.y;

      // Define table headers
      const headers = ['Date', 'Paid To/From', 'Category', 'Payment Mode', 'Description', 'Amount'];
      const columnWidths = [0.15, 0.2, 0.15, 0.15, 0.2, 0.15]; // Proportions

      // Calculate actual column widths
      const tableWidth = doc.page.width - 100;
      const actualColumnWidths = columnWidths.map(width => tableWidth * width);

      // Draw table header
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

      // Draw transaction rows
      if (reportData.transactions && reportData.transactions.length > 0) {
        reportData.transactions.forEach((transaction, rowIndex) => {
          // Check if we need a new page
          if (currentTop > doc.page.height - 100) {
            doc.addPage();
            currentTop = 50;

            // Add page header
            doc.font('Helvetica')
               .fontSize(10)
               .fillColor('#6B7280') // Gray
               .text(`Subs Expense Report - ${reportData.subName} - Page ${doc.bufferedPageRange().count}`, { align: 'center' });

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
        // No transactions message
        doc.font('Helvetica-Oblique')
           .fontSize(12)
           .fillColor('#6B7280') // Gray
           .text('No transactions available for this sub', 50, currentTop + 20, { align: 'center' });

        currentTop += 40;
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
 * Format a currency value for display
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(value);
}
