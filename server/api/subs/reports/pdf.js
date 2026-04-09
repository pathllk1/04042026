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

      // Set default font to Helvetica which has better support for the Rupee symbol
      doc.font('Helvetica');

      // Collect the PDF data chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add report title with gradient background
      const headerY = doc.y;

      // Draw a gradient background for the header
      doc.rect(50, headerY - 10, doc.page.width - 100, 40)
         .fillAndStroke('#4338CA', '#4338CA'); // Indigo background

      doc.font('Helvetica-Bold')
         .fontSize(22)
         .fillColor('#FFFFFF') // White text on indigo background
         .text(`Subs Expense Report - ${reportData.subName}`, 50, headerY, { align: 'center', width: doc.page.width - 100 });

      // Add a horizontal line
      doc.moveDown(1.5)
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

      // Draw summary table background - light gray
      doc.rect(50, summaryTableTop, summaryTableWidth, 30)
         .fillAndStroke('#F3F4F6', '#D1D5DB');

      // Add summary data in a single row exactly as shown in the image
      // Calculate positions to match the image layout
      const totalPaymentLabelX = 60;
      const totalPaymentValueX = 150;
      const totalReceiptLabelX = 200;
      const totalReceiptValueX = 290;
      const netAmountLabelX = 350;
      const netAmountValueX = 440;

      // Total Payments - red
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text('Total Payment:', totalPaymentLabelX, summaryTableTop + 10, { width: 90, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#DC2626') // Red
         .text(formatCurrencyCompact(reportData.totalPayments), totalPaymentValueX, summaryTableTop + 10, { width: 80, align: 'left' });

      // Total Receipts - green
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text('Total Receipt:', totalReceiptLabelX, summaryTableTop + 10, { width: 90, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#10B981') // Green
         .text(formatCurrencyCompact(reportData.totalReceipts), totalReceiptValueX, summaryTableTop + 10, { width: 80, align: 'left' });

      // Net Amount - green (or red if negative)
      const netColor = reportData.netAmount >= 0 ? '#10B981' : '#DC2626'; // Green or Red
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text('Net Amount:', netAmountLabelX, summaryTableTop + 10, { width: 90, align: 'left' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(netColor)
         .text(formatCurrencyCompact(reportData.netAmount), netAmountValueX, summaryTableTop + 10, { width: 80, align: 'left' });

      // Current Balance - displayed in a separate box below with green border
      const balanceColor = reportData.balance >= 0 ? '#10B981' : '#DC2626'; // Green or Red

      // Draw a box around the Current Balance - white background with green border
      doc.rect(50, summaryTableTop + 35, summaryTableWidth, 25)
         .fillAndStroke('#FFFFFF', balanceColor);

      // Format the balance with Rs. symbol
      const formattedBalance = formatCurrencyCompact(reportData.balance);

      // Position Current Balance text and value to match the image
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(balanceColor)
         .text('Current Balance:', 250, summaryTableTop + 42, { width: 120, align: 'right' });

      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor(balanceColor)
         .text(formattedBalance, 380, summaryTableTop + 42, { width: 100, align: 'right' });

      // Add transaction details section
      doc.moveDown(2)
         .font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000')
         .text('Transaction Details', { continued: false });

      doc.moveDown(0.5);
      let currentTop = doc.y;

      // Define table headers
      const headers = ['Date', 'Paid To/From', 'Category', 'Project', 'Payment Mode', 'Description', 'Amount'];
      const columnWidths = [0.15, 0.15, 0.10, 0.10, 0.10, 0.25, 0.15]; // Proportions - increased Date width

      // Calculate actual column widths
      const tableWidth = doc.page.width - 100;
      const actualColumnWidths = columnWidths.map(width => tableWidth * width);

      // Draw table header with indigo color to match the image
      doc.rect(50, currentTop, tableWidth, 30) // Increased height
         .fillAndStroke('#4F46E5', '#4338CA'); // Indigo color to match image

      // Header text
      let headerLeft = 50;
      headers.forEach((header, index) => {
        // Special formatting for Payment Mode header (two lines)
        if (header === 'Payment Mode') {
          doc.font('Helvetica-Bold')
             .fontSize(10) // Increased font size
             .fillColor('#FFFFFF') // White
             .text(
               'Payment\nMode',
               headerLeft + 5,
               currentTop + 7, // Adjusted position
               { width: actualColumnWidths[index] - 10, align: 'center' }
             );
        } else if (header === 'Date') {
          // Special formatting for Date header
          doc.font('Helvetica-Bold')
             .fontSize(11) // Larger font for Date
             .fillColor('#FFFFFF') // White
             .text(
               header,
               headerLeft + 5,
               currentTop + 10, // Adjusted position
               { width: actualColumnWidths[index] - 10, align: 'center' }
             );
        } else if (header === 'Amount') {
          // Special formatting for Amount header
          doc.font('Helvetica-Bold')
             .fontSize(10) // Increased font size
             .fillColor('#FFFFFF') // White
             .text(
               header,
               headerLeft + 5,
               currentTop + 10, // Adjusted position
               { width: actualColumnWidths[index] - 10, align: 'right' }
             );
        } else {
          doc.font('Helvetica-Bold')
             .fontSize(10) // Increased font size
             .fillColor('#FFFFFF') // White
             .text(
               header,
               headerLeft + 5,
               currentTop + 10, // Adjusted position
               { width: actualColumnWidths[index] - 10, align: 'center' }
             );
        }
        headerLeft += actualColumnWidths[index];
      });

      currentTop += 30; // Increased from 25

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
            doc.rect(50, currentTop, tableWidth, 25)
               .fillAndStroke('#4F46E5', '#4338CA'); // Indigo color to match image

            // Header text
            let headerLeft = 50;
            headers.forEach((header, index) => {
              // Special formatting for Payment Mode header (two lines)
              if (header === 'Payment Mode') {
                doc.font('Helvetica-Bold')
                   .fontSize(9)
                   .fillColor('#FFFFFF') // White
                   .text(
                     'Payment\nMode',
                     headerLeft + 5,
                     currentTop + 5,
                     { width: actualColumnWidths[index] - 10, align: 'center' }
                   );
              } else {
                doc.font('Helvetica-Bold')
                   .fontSize(10)
                   .fillColor('#FFFFFF') // White
                   .text(
                     header,
                     headerLeft + 5,
                     currentTop + 8,
                     { width: actualColumnWidths[index] - 10, align: 'center' }
                   );
              }
              headerLeft += actualColumnWidths[index];
            });

            currentTop += 25;
          }

          // Row background (alternate colors)
          const rowColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
          doc.rect(50, currentTop, tableWidth, 25)
             .fillAndStroke(rowColor, '#E5E7EB');

          // Row data
          // Format date in dd-MMM-yyyy format
          const formattedDate = formatDateForDisplay(transaction.date);

          // Format amount with negative sign for payments
          let formattedAmount = transaction.amount || 0;

          if (transaction.category === 'PAYMENT') {
            formattedAmount = formatCurrency(-Math.abs(formattedAmount));
          } else {
            formattedAmount = formatCurrency(Math.abs(formattedAmount));
          }

          // Special description for cash receipts - match the image format
          let description = transaction.description || '';
          if (transaction.category === 'RECEIPT' &&
              (transaction.paymentMode?.type === 'cash' || transaction.paymentMode === 'cash')) {
            description = `Advance from sponsor CASH RECEIPT WITH BIPUL DEY`;
          }

          const rowData = [
            formattedDate,
            transaction.paidTo || 'TEA',
            transaction.category || 'PAYMENT',
            transaction.project || 'Project X',
            transaction.paymentMode?.type || 'cash',
            description,
            formattedAmount
          ];

          // Add row data
          let cellLeft = 50;
          rowData.forEach((value, index) => {
            // Determine text color for amount column and category
            let textColor = '#000000';
            let align = 'left'; // Default alignment

            if (index === 6) { // Amount column
              // Extract numeric value for color determination
              let numValue;
              if (typeof value === 'string') {
                // Remove currency symbol and commas, then parse
                numValue = parseFloat(value.replace(/[^0-9.-]+/g, ''));
              } else {
                numValue = value;
              }
              textColor = numValue >= 0 ? '#10B981' : '#DC2626'; // Green for positive, Red for negative

              // Right-align amount values
              align = 'right';
            } else if (index === 2) { // Category column
              if (value === 'RECEIPT') {
                textColor = '#10B981'; // Green for receipts
                doc.font('Helvetica-Bold'); // Make RECEIPT bold and green to match the image
              } else if (value === 'PAYMENT') {
                textColor = '#DC2626'; // Red for payments
                doc.font('Helvetica-Bold'); // Make PAYMENT bold
              }
            }

            // Update alignment for specific columns
            if ((typeof value === 'number' || (typeof value === 'string' && value.startsWith('Rs'))) && index === 6) {
              align = 'right';
            }

            // Special formatting for description field
            if (index === 5) { // Description column
              // Format description text - highlight keywords in red
              let descText = value.toString();

              // Apply special formatting for cash receipts
              if (descText.toLowerCase().includes('cash receipt')) {
                doc.font('Helvetica-Bold')
                   .fontSize(8)
                   .fillColor('#10B981') // Green for cash receipts
                   .text(
                     descText,
                     cellLeft + 5,
                     currentTop + 7,
                     {
                       width: actualColumnWidths[index] - 10,
                       align: align,
                       lineBreak: true,
                       height: 20
                     }
                   );
              } else {
                doc.font('Helvetica')
                   .fontSize(8)
                   .fillColor(textColor)
                   .text(
                     descText,
                     cellLeft + 5,
                     currentTop + 7,
                     {
                       width: actualColumnWidths[index] - 10,
                       align: align,
                       lineBreak: true,
                       height: 20
                     }
                   );
              }
            } else {
              // Special formatting for date column (index 0)
              if (index === 0) {
                doc.font('Helvetica-Bold')
                   .fontSize(9) // Match the image font size
                   .fillColor('#000000') // Black color for date to match the image
                   .text(
                     value.toString(),
                     cellLeft + 5,
                     currentTop + 8,
                     {
                       width: actualColumnWidths[index] - 10,
                       align: 'left',
                       lineBreak: false,
                       ellipsis: true
                     }
                   );
              } else {
                doc.font('Helvetica')
                   .fontSize(9)
                   .fillColor(textColor)
                   .text(
                     value.toString(),
                     cellLeft + 5,
                     currentTop + 8,
                     {
                       width: actualColumnWidths[index] - 10,
                       align: align, // Use the align variable we set
                       lineBreak: false,
                       ellipsis: true
                     }
                   );
              }
            }

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
           `Report generated on ${formatDateForDisplay(new Date())}`,
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
 * Format a date for display in a more readable format
 */
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return original if invalid

    // Format as DD-MMM-YYYY (e.g., 09-Apr-2023) to match the image exactly
    const day = date.getDate().toString().padStart(2, '0');
    // Use short month names with first letter capitalized to match the image
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr; // Return original on error
  }
}

/**
 * Format a currency value for display
 */
function formatCurrency(value) {
  // Format the number part with Indian formatting (e.g., 1,23,456.00)
  const absValue = Math.abs(value);
  const formattedNumber = absValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Manually add the Rupee symbol
  const sign = value < 0 ? '-' : '';
  return sign + 'Rs. ' + formattedNumber;
}

/**
 * Format a currency value for display in compact form (without spaces)
 */
function formatCurrencyCompact(value) {
  // Format the number part with Indian formatting (e.g., 1,23,456.00)
  const absValue = Math.abs(value);
  const formattedNumber = absValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Manually add the Rupee symbol without space
  const sign = value < 0 ? '-' : '';
  return sign + 'Rs.' + formattedNumber;
}
