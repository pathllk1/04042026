// server/api/inventory/purchase-pdf/[id].ts
import { defineEventHandler, createError, setHeader, getQuery, getHeader } from 'h3';
import PDFDocument from 'pdfkit';
import Bills from '../../../models/inventory/Bills';
import Firm from '../../../models/Firm';
import Party from '../../../models/inventory/Party';
import StockReg from '../../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  try {
    // Get bill ID from URL parameter
    const id = event.context.params?.id;

    // If ID is not in params, try to get it from query
    const query = getQuery(event);
    const queryId = query.id;

    // Use either params ID or query ID
    const billId = id || queryId;

    if (!billId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bill ID is required'
      });
    }

    // Get print configuration from headers
    let printConfig = null;
    try {
      const printConfigHeader = getHeader(event, 'x-print-config');
      if (printConfigHeader && printConfigHeader !== 'null') {
        printConfig = JSON.parse(printConfigHeader);
        console.log('📄 Print configuration received:', printConfig);
      }
    } catch (err) {
      console.warn('Failed to parse print configuration:', err);
    }

    // Find the bill with populated stock items
    const bill = await Bills.findById(billId);
    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bill not found'
      });
    }

    // Verify that this is a purchase bill
    if (bill.btype !== 'PURCHASE') {
      throw createError({
        statusCode: 400,
        statusMessage: 'This is not a purchase bill'
      });
    }

    // Find the firm
    const firm = await Firm.findById(bill.firm);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    // Find the party (optional) - this can be used to get additional party details if needed
    let partyDetails = null;
    if (bill.partyId) {
      partyDetails = await Party.findById(bill.partyId);
      console.log('Found party by ID:', partyDetails ? partyDetails._id : 'Not found');
    } else {
      // Try to find party by supply name if partyId is not available
      partyDetails = await Party.findOne({ supply: bill.supply });
      console.log('Found party by supply name:', partyDetails ? partyDetails._id : 'Not found');
    }

    // Use party details if available, otherwise use bill data
    const partyName = bill.supply || (partyDetails?.supply || 'N/A');
    const partyAddress = bill.addr || (partyDetails?.addr || 'N/A');
    const partyGstin = bill.gstin || (partyDetails?.gstin || 'N/A');
    const partyState = bill.state || (partyDetails?.state || 'N/A');

    // Get stock items associated with this bill
    const stockRegItems = await StockReg.find({ billId });
    console.log(`Found ${stockRegItems.length} stock items for bill ${billId}`);

    // Create an array to store our stock items for the PDF
    const stockItems: Array<any> = [];

    // If we found items in StockReg, use those
    if (stockRegItems && stockRegItems.length > 0) {
      stockRegItems.forEach(item => {
        stockItems.push({
          item: item.item || '',
          hsn: item.hsn || '',
          qty: item.qty || 0,
          rate: item.rate || 0,
          cgst: item.cgst || 0,
          sgst: item.sgst || 0,
          igst: item.igst || 0,
          total: item.total || 0
        });
      });
    } else {
      console.log('No stock items found in StockReg, checking bill document');

      // Try to access stockItems from the bill document
      const billDoc: any = bill.toObject ? bill.toObject() : bill;

      if (billDoc && typeof billDoc === 'object') {
        // Check if there's a stockItems property
        if (billDoc.stockItems && Array.isArray(billDoc.stockItems) && billDoc.stockItems.length > 0) {
          console.log(`Found ${billDoc.stockItems.length} stock items in bill document`);
          billDoc.stockItems.forEach((item: any) => {
            stockItems.push({
              item: item.item || '',
              hsn: item.hsn || '',
              qty: item.qty || 0,
              rate: item.rate || 0,
              cgst: item.cgst || 0,
              sgst: item.sgst || 0,
              igst: item.igst || 0,
              total: item.total || 0
            });
          });
        } else {
          console.log('No stock items found in bill document either');
          // Create a dummy stock item for testing
          stockItems.push({
            item: 'Sample Item',
            hsn: '1234',
            qty: 1,
            rate: bill.gtot || 0,
            cgst: bill.cgst || 0,
            sgst: bill.sgst || 0,
            igst: bill.igst || 0,
            total: bill.ntot || 0
          });
        }
      }
    }

    console.log(`Final stock items for PDF: ${stockItems.length}`);
    console.log('First item:', stockItems[0] || 'No items');

    // Set response headers
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `inline; filename="purchase-${bill.bno}.pdf"`);

    // Create a new PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Purchase Invoice ${bill.bno}`,
        Author: firm.name,
        Subject: 'Purchase Invoice',
        Keywords: 'purchase, invoice, bill, pdf',
        Creator: 'Invoice System'
      }
    });

    // Initialize page counter
    let pageNumber = 1;

    // Create a buffer to collect the PDF data
    const chunks: Buffer[] = [];

    // Set up event handlers to collect PDF data
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Create a promise that resolves when the PDF is complete
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Define colors and styles
    const primaryColor = '#9ACD32'; // Yellow-green color
    const textColor = '#333333';
    const backgroundColor = '#f9fafb';

    // Function to format date in dd-MMM-yyyy format
    const formatDate = (dateString: string | Date | undefined): string => {
      if (!dateString) return 'N/A';

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';

      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();

      return `${day}-${month}-${year}`;
    };

    // Function to format currency with Indian number formatting
    const formatCurrency = (amount: number, showSymbol = false): string => {
      const formattedNumber = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return showSymbol ? `Rs.${formattedNumber}` : formattedNumber;
    };

    // Function to convert number to words (Indian currency format)
    const numberToWords = (num: number): string => {
      const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      // Format numbers from 1-99
      const formatTwoDigits = (num: number): string => {
        if (num < 10) return single[num];
        if (num < 20) return double[num - 10];
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        return tens[ten] + (unit > 0 ? ' ' + single[unit] : '');
      };

      // Format numbers with proper scale (hundred, thousand, etc.)
      const formatGroup = (num: number, scale: string): string => {
        if (num === 0) return '';
        return formatTwoDigits(num) + (scale ? ' ' + scale : '');
      };

      let rupees = Math.floor(num);
      let paise = Math.round((num - rupees) * 100);

      if (rupees === 0) return 'Rupees Zero Only';

      let words = '';

      // Handle crores (10 million)
      const crore = Math.floor(rupees / 10000000);
      rupees %= 10000000;
      if (crore > 0) {
        words += formatGroup(crore, 'Crore');
      }

      // Handle lakhs (100 thousand)
      const lakh = Math.floor(rupees / 100000);
      rupees %= 100000;
      if (lakh > 0) {
        words += (words ? ' ' : '') + formatGroup(lakh, 'Lakh');
      }

      // Handle thousands
      const thousand = Math.floor(rupees / 1000);
      rupees %= 1000;
      if (thousand > 0) {
        words += (words ? ' ' : '') + formatGroup(thousand, 'Thousand');
      }

      // Handle hundreds
      const hundred = Math.floor(rupees / 100);
      rupees %= 100;
      if (hundred > 0) {
        words += (words ? ' ' : '') + formatGroup(hundred, 'Hundred');
      }

      // Handle remaining two digits
      if (rupees > 0) {
        words += (words ? ' ' : '') + formatTwoDigits(rupees);
      }

      let result = 'Rupees ' + words.trim();

      // Convert paise to words
      if (paise > 0) {
        result += ' and ' + formatTwoDigits(paise) + ' Paise';
      }

      return result + ' Only';
    };

    // Start rendering the PDF
    let currentY = 30; // Start position from top

    // Add page number to first page
    doc.fontSize(10).font('Helvetica');
    doc.text(`Page ${pageNumber}`, doc.page.width - 100, 30, { align: 'right', width: 80 });

    // Add firm header
    doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(firm.name.toUpperCase(), 50, currentY, { align: 'center', width: doc.page.width - 100 });
    currentY += 20;

    doc.fontSize(10).font('Helvetica');
    doc.text(firm.address, 50, currentY, { align: 'center', width: doc.page.width - 100 });
    currentY += 15;

    doc.text(`GSTIN: ${firm.gstNo || 'N/A'}`, 50, currentY, { align: 'center', width: doc.page.width - 100 });
    currentY += 20;

    // Add invoice title
    doc.rect(50, currentY, doc.page.width - 100, 20).fill(primaryColor);
    doc.fillColor('white').fontSize(12).font('Helvetica-Bold');
    doc.text('PURCHASE INVOICE', 50, currentY + 5, { align: 'center', width: doc.page.width - 100 });
    currentY += 30; // Move down after title
    doc.fillColor(textColor);

    // Add invoice details section - create a 2-column layout
    const colWidth = (doc.page.width - 100) / 2;

    // Left column - Invoice details
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Invoice No:', 50, currentY);
    doc.font('Helvetica').text(bill.bno, 120, currentY);

    // Right column - Date
    doc.font('Helvetica-Bold');
    doc.text('Date:', 50 + colWidth, currentY);
    doc.font('Helvetica').text(formatDate(bill.bdate), 50 + colWidth + 50, currentY);

    currentY += 30; // Add space before party details

    // Add party details section
    doc.rect(50, currentY, doc.page.width - 100, 120).fill(backgroundColor);

    // Supplier details
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
    doc.text('Supplier Details', 55, currentY + 10);
    doc.fillColor(textColor).font('Helvetica').fontSize(9);

    let partyY = currentY + 25;
    doc.font('Helvetica-Bold').text('Name:', 55, partyY);
    doc.font('Helvetica').text(partyName, 100, partyY, { width: colWidth - 105 });
    partyY += 15;

    doc.font('Helvetica-Bold').text('Address:', 55, partyY);
    doc.font('Helvetica').text(partyAddress, 100, partyY, { width: colWidth - 105 });
    partyY += 30;

    doc.font('Helvetica-Bold').text('GSTIN:', 55, partyY);
    doc.font('Helvetica').text(partyGstin, 100, partyY, { width: colWidth - 105 });
    partyY += 15;

    doc.font('Helvetica-Bold').text('State:', 55, partyY);
    doc.font('Helvetica').text(partyState, 100, partyY, { width: colWidth - 105 });

    // Order details
    const orderX = 50 + colWidth;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
    doc.text('Order Details', orderX + 5, currentY + 10);
    doc.fillColor(textColor).font('Helvetica').fontSize(9);

    let orderY = currentY + 25;
    doc.font('Helvetica-Bold').text('Order No:', orderX + 5, orderY);
    doc.font('Helvetica').text(bill.orderNo || 'N/A', orderX + 70, orderY);
    orderY += 15;

    doc.font('Helvetica-Bold').text('Order Date:', orderX + 5, orderY);
    doc.font('Helvetica').text(formatDate(bill.orderDate), orderX + 70, orderY);
    orderY += 15;

    doc.font('Helvetica-Bold').text('Dispatch:', orderX + 5, orderY);
    doc.font('Helvetica').text(bill.dispatchThrough || 'N/A', orderX + 70, orderY);
    orderY += 15;

    doc.font('Helvetica-Bold').text('Vehicle No:', orderX + 5, orderY);
    doc.font('Helvetica').text(bill.vehicleNo || 'N/A', orderX + 70, orderY);

    currentY += 130; // Move down after party details

    // Add stock items table
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Items', 50, currentY);
    currentY += 15;

    // Table headers
    const tableWidth = doc.page.width - 100;
    const colWidths = {
      item: tableWidth * 0.35,
      hsn: tableWidth * 0.1,
      qty: tableWidth * 0.1,
      rate: tableWidth * 0.1,
      amount: tableWidth * 0.1,
      tax: tableWidth * 0.1,
      total: tableWidth * 0.15
    };

    // Calculate column positions
    const colPos = {
      item: 50,
      hsn: 50 + colWidths.item,
      qty: 50 + colWidths.item + colWidths.hsn,
      rate: 50 + colWidths.item + colWidths.hsn + colWidths.qty,
      amount: 50 + colWidths.item + colWidths.hsn + colWidths.qty + colWidths.rate,
      tax: 50 + colWidths.item + colWidths.hsn + colWidths.qty + colWidths.rate + colWidths.amount,
      total: 50 + colWidths.item + colWidths.hsn + colWidths.qty + colWidths.rate + colWidths.amount + colWidths.tax
    };

    // Draw table header with a more visible background
    doc.rect(50, currentY, tableWidth, 20).fill(primaryColor);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('Item', colPos.item + 2, currentY + 6, { width: colWidths.item - 4 });
    doc.text('HSN', colPos.hsn + 2, currentY + 6, { width: colWidths.hsn - 4 });
    doc.text('Qty', colPos.qty + 2, currentY + 6, { width: colWidths.qty - 4 });
    doc.text('Rate', colPos.rate + 2, currentY + 6, { width: colWidths.rate - 4 });
    doc.text('Amount', colPos.amount + 2, currentY + 6, { width: colWidths.amount - 4 });
    doc.text('Tax', colPos.tax + 2, currentY + 6, { width: colWidths.tax - 4 });
    doc.text('Total', colPos.total + 2, currentY + 6, { width: colWidths.total - 4 });

    currentY += 20;
    doc.fillColor(textColor);

    // Draw table rows
    let rowCount = 0;

    // Debug log for stock items
    console.log(`Drawing ${stockItems.length} stock items in PDF`);
    stockItems.forEach((item, index) => {
      console.log(`Item ${index + 1}:`, item);
    });

    // Create a sample item if no stock items are available
    if (stockItems.length === 0) {
      console.log('No stock items found, adding a sample item');
      stockItems.push({
        item: 'Sample Item',
        hsn: '1234',
        qty: 1,
        rate: bill.gtot || 0,
        cgst: bill.cgst || 0,
        sgst: bill.sgst || 0,
        igst: bill.igst || 0,
        total: bill.ntot || 0
      });
    }

    // Draw each stock item
    stockItems.forEach((item, i) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        pageNumber++;
        currentY = 50;

        // Add table header on new page
        doc.rect(50, currentY, tableWidth, 20).fill(primaryColor);
        doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
        doc.text('Item', colPos.item + 2, currentY + 6, { width: colWidths.item - 4 });
        doc.text('HSN', colPos.hsn + 2, currentY + 6, { width: colWidths.hsn - 4 });
        doc.text('Qty', colPos.qty + 2, currentY + 6, { width: colWidths.qty - 4 });
        doc.text('Rate', colPos.rate + 2, currentY + 6, { width: colWidths.rate - 4 });
        doc.text('Amount', colPos.amount + 2, currentY + 6, { width: colWidths.amount - 4 });
        doc.text('Tax', colPos.tax + 2, currentY + 6, { width: colWidths.tax - 4 });
        doc.text('Total', colPos.total + 2, currentY + 6, { width: colWidths.total - 4 });
        currentY += 20;
        doc.fillColor(textColor);
      }

      // Draw alternating row background
      if (rowCount % 2 === 0) {
        doc.rect(50, currentY, tableWidth, 20).fill('#f5f5f5');
      }
      rowCount++;

      // Calculate values
      const amount = (item.qty || 0) * (item.rate || 0);
      const taxAmount = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      const total = amount + taxAmount;

      // Draw row data with black text color
      doc.fillColor('#000000').fontSize(8);

      // Item name
      doc.text(item.item || 'Item ' + (i + 1), colPos.item + 2, currentY + 6, { width: colWidths.item - 4 });

      // HSN code
      doc.text(item.hsn || '-', colPos.hsn + 2, currentY + 6, { width: colWidths.hsn - 4 });

      // Quantity
      doc.text(item.qty?.toString() || '0', colPos.qty + 2, currentY + 6, { width: colWidths.qty - 4 });

      // Rate
      doc.text((item.rate || 0).toFixed(2), colPos.rate + 2, currentY + 6, { width: colWidths.rate - 4 });

      // Amount
      doc.text(amount.toFixed(2), colPos.amount + 2, currentY + 6, { width: colWidths.amount - 4 });

      // Tax
      doc.text(taxAmount.toFixed(2), colPos.tax + 2, currentY + 6, { width: colWidths.tax - 4 });

      // Total
      doc.text(total.toFixed(2), colPos.total + 2, currentY + 6, { width: colWidths.total - 4 });

      currentY += 20;
    });

    // Calculate totals from stock items
    let totalAmount = 0;
    let totalTax = 0;
    let totalValue = 0;

    stockItems.forEach(item => {
      const amount = (item.qty || 0) * (item.rate || 0);
      const tax = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      totalAmount += amount;
      totalTax += tax;
      totalValue += (item.total || 0);
    });

    // If we have no items or the totals don't match the bill, use the bill totals
    if (stockItems.length === 0 || Math.abs(totalValue - (bill.ntot || 0)) > 1) {
      totalAmount = bill.gtot || 0;
      totalTax = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
      totalValue = bill.ntot || 0;
    }

    // Draw table footer with totals
    doc.rect(50, currentY, tableWidth, 20).fill(primaryColor);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    doc.text('Totals', colPos.item + 2, currentY + 6, { width: colWidths.item - 4 });
    doc.text('', colPos.hsn + 2, currentY + 6, { width: colWidths.hsn - 4 });
    doc.text('', colPos.qty + 2, currentY + 6, { width: colWidths.qty - 4 });
    doc.text('', colPos.rate + 2, currentY + 6, { width: colWidths.rate - 4 });
    doc.text(totalAmount.toFixed(2), colPos.amount + 2, currentY + 6, { width: colWidths.amount - 4 });
    doc.text(totalTax.toFixed(2), colPos.tax + 2, currentY + 6, { width: colWidths.tax - 4 });
    doc.text(totalValue.toFixed(2), colPos.total + 2, currentY + 6, { width: colWidths.total - 4 });

    currentY += 30;
    doc.fillColor(textColor);

    // Create HSN summary
    const hsnSummary: Record<string, {
      hsn: string,
      taxableAmount: number,
      cgst: number,
      sgst: number,
      igst: number,
      total: number
    }> = {};

    // Calculate HSN summary
    stockItems.forEach(item => {
      const hsn = item.hsn || 'N/A';
      const amount = (item.qty || 0) * (item.rate || 0);
      const cgstAmount = item.cgst || 0;
      const sgstAmount = item.sgst || 0;
      const igstAmount = item.igst || 0;
      const totalAmount = amount + cgstAmount + sgstAmount + igstAmount;

      if (!hsnSummary[hsn]) {
        hsnSummary[hsn] = {
          hsn,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0
        };
      }

      hsnSummary[hsn].taxableAmount += amount;
      hsnSummary[hsn].cgst += cgstAmount;
      hsnSummary[hsn].sgst += sgstAmount;
      hsnSummary[hsn].igst += igstAmount;
      hsnSummary[hsn].total += totalAmount;
    });

    // Add HSN summary table
    if (Object.keys(hsnSummary).length > 0) {
      // Check if we need a new page
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        pageNumber++;
        currentY = 50;
      }

      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor(textColor);
      doc.text('HSN Summary', 50, currentY);
      currentY += 15;

      // Create HSN table
      const hsnTableWidth = doc.page.width - 100;
      doc.rect(50, currentY, hsnTableWidth, 20).fill(primaryColor);
      doc.fillColor('white').fontSize(9);
      doc.text('HSN', 52, currentY + 6, { width: 80 });
      doc.text('Taxable Amount', 132, currentY + 6, { width: 100 });
      doc.text('CGST', 232, currentY + 6, { width: 80 });
      doc.text('SGST', 312, currentY + 6, { width: 80 });
      doc.text('IGST', 392, currentY + 6, { width: 80 });
      doc.text('Total', 472, currentY + 6, { width: 80 });
      currentY += 20;

      // Add HSN rows
      let rowIndex = 0;
      Object.values(hsnSummary).forEach(row => {
        // Draw alternating row background
        if (rowIndex % 2 === 0) {
          doc.rect(50, currentY, hsnTableWidth, 20).fill('#f5f5f5');
        }
        rowIndex++;

        doc.fillColor('#000000').fontSize(8);
        doc.text(row.hsn, 52, currentY + 6, { width: 80 });
        doc.text(row.taxableAmount.toFixed(2), 132, currentY + 6, { width: 100 });
        doc.text(row.cgst.toFixed(2), 232, currentY + 6, { width: 80 });
        doc.text(row.sgst.toFixed(2), 312, currentY + 6, { width: 80 });
        doc.text(row.igst.toFixed(2), 392, currentY + 6, { width: 80 });
        doc.text(row.total.toFixed(2), 472, currentY + 6, { width: 80 });

        currentY += 20;
      });

      currentY += 10;
    }

    // Add tax breakdown
    const cgst = bill.cgst || 0;
    const sgst = bill.sgst || 0;
    const igst = bill.igst || 0;
    const gtot = bill.gtot || 1; // Avoid division by zero

    if (cgst > 0 || sgst > 0 || igst > 0) {
      // Check if we need a new page
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        pageNumber++;
        currentY = 50;
      }

      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor(textColor);
      doc.text('Tax Breakdown', 50, currentY);
      currentY += 15;

      // Create tax table
      const taxTableWidth = doc.page.width - 300;
      doc.rect(50, currentY, taxTableWidth, 20).fill(primaryColor);
      doc.fillColor('white').fontSize(9);
      doc.text('Tax Type', 52, currentY + 6);
      doc.text('Rate', 150, currentY + 6);
      doc.text('Amount', 200, currentY + 6);
      currentY += 20;
      doc.fillColor(textColor);

      // CGST row (using proper currency formatting)
      if (cgst > 0) {
        doc.fillColor('#000000').fontSize(8);
        doc.text('CGST', 52, currentY + 6);
        doc.text(`${(cgst / gtot * 100).toFixed(1)}%`, 150, currentY + 6);
        doc.text(formatCurrency(cgst, true), 200, currentY + 6);
        currentY += 20;
      }

      // SGST row (using proper currency formatting)
      if (sgst > 0) {
        doc.fillColor('#000000').fontSize(8);
        doc.text('SGST', 52, currentY + 6);
        doc.text(`${(sgst / gtot * 100).toFixed(1)}%`, 150, currentY + 6);
        doc.text(formatCurrency(sgst, true), 200, currentY + 6);
        currentY += 20;
      }

      // IGST row (using proper currency formatting)
      if (igst > 0) {
        doc.fillColor('#000000').fontSize(8);
        doc.text('IGST', 52, currentY + 6);
        doc.text(`${(igst / gtot * 100).toFixed(1)}%`, 150, currentY + 6);
        doc.text(formatCurrency(igst, true), 200, currentY + 6);
        currentY += 20;
      }
    }

    // Add amount in words
    currentY += 10;
    doc.rect(50, currentY, doc.page.width - 100, 30).fill(backgroundColor);
    doc.fillColor(textColor).fontSize(9);
    doc.font('Helvetica-Bold').text('Amount in Words:', 55, currentY + 10);
    doc.font('Helvetica').text(numberToWords(totalValue), 150, currentY + 10, { width: doc.page.width - 180 });

    currentY += 40;

    // Add signature section
    const signatureWidth = (doc.page.width - 100) / 2;

    // Supplier signature
    doc.fontSize(9);
    doc.text('Supplier\'s Signature', 50, currentY + 30, { width: signatureWidth - 10 });

    // Company signature
    doc.fontSize(9);
    doc.text(`For ${firm.name}`, 50 + signatureWidth, currentY + 30, { width: signatureWidth - 10, align: 'right' });
    doc.fontSize(8).text('Authorized Signatory', 50 + signatureWidth, currentY + 45, { width: signatureWidth - 10, align: 'right' });

    // Add page numbers to all pages
    const totalPageCount = doc.bufferedPageRange().count;

    // Loop through each page and add the correct page number
    for (let i = 0; i < totalPageCount; i++) {
      doc.switchToPage(i);

      // Clear the area where the page number is displayed
      doc.fillColor('white')
         .rect(doc.page.width - 150, 30, 120, 20)
         .fill();

      // Add the correct page number
      doc.fillColor(textColor)
         .fontSize(10)
         .font('Helvetica')
         .text(`Page ${i + 1} of ${totalPageCount}`, doc.page.width - 100, 30, { align: 'right', width: 80 });
    }

    // Finalize the PDF
    doc.end();

    // Return the PDF buffer
    return pdfPromise;
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to generate purchase PDF: ${error.message || 'Unknown error'}`
    });
  }
});
