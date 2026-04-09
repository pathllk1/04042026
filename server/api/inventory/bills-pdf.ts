import { defineEventHandler, createError, getQuery, setHeader } from 'h3';
import PDFDocument from 'pdfkit';
import Bills from '../../models/inventory/Bills';
import Firm from '../../models/Firm';
import StockReg from '../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  try {
    // Get query parameters for filtering
    const query = getQuery(event);
    const filterType = query.filterType || '';
    const dateFrom = query.dateFrom || '';
    const dateTo = query.dateTo || '';
    const searchQuery = query.searchQuery || '';

    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Get the firm ID from the authenticated user
    const firmId = user.firmId.toString();

    // Get firm details for the header
    const firm = await Firm.findById(firmId);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    // Build filter conditions
    let filter = { firm: firmId };
    if (filterType) filter['btype'] = filterType;
    if (dateFrom && dateTo) {
      filter['bdate'] = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      };
    }

    // Get bills data with populated stock items
    const bills = await Bills.find(filter)
      .populate('stockRegIds')
      .sort({ bdate: 1 }) // Sort by date ascending
      .lean();

    // Transform the populated data structure
    let billsWithItems = bills.map(bill => ({
      ...bill,
      stockItems: bill.stockRegIds || []
    }));

    // Filter by search query if provided
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      billsWithItems = billsWithItems.filter(bill => {
        return Object.keys(bill).some(key => {
          if (key === 'stockItems') return false; // Skip nested objects
          const value = bill[key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          } else if (typeof value === 'number') {
            return value.toString().includes(query);
          }
          return false;
        });
      });
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: 36, // 0.5 inches in points (72 points per inch)
      autoFirstPage: false,
      bufferPages: true // Enable page buffering for proper page numbering
    });

    // Set response headers
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename=sales_register_${new Date().toISOString().slice(0, 10)}.pdf`);

    // Create a buffer to store the PDF
    const chunks: any[] = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Add first page with header
    doc.addPage();
    
    // Define constants for layout
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    
    // Add firm header - styled like the image
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
    doc.text(firm.name.toUpperCase(), { align: 'center' });
    doc.moveDown(0.2);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`${firm.address}`, { align: 'center' });
    doc.moveDown(0.2);
    
    doc.text(`${firm.state}`, { align: 'center' });
    doc.moveDown(0.2);
    
    // Add email with underline
    const emailText = `E-Mail : ${firm.email}`;
    const emailWidth = doc.widthOfString(emailText);
    const emailX = (pageWidth - emailWidth) / 2 + doc.page.margins.left;
    
    doc.text(emailText, { align: 'center' });
    doc.moveTo(emailX, doc.y)
       .lineTo(emailX + emailWidth, doc.y)
       .stroke();
    doc.moveDown(0.5);
    
    // Add Sales Register title
    doc.fontSize(12).font('Helvetica-Bold');
    
    // Make the title dynamic based on filterType
    let registerTitle = 'All Bills Register';
    if (filterType === 'SALES') registerTitle = 'Sales Register';
    else if (filterType === 'PURCHASE') registerTitle = 'Purchase Register';
    else if (filterType === 'DEBIT NOTE') registerTitle = 'Debit Note Register';
    else if (filterType === 'CREDIT NOTE') registerTitle = 'Credit Note Register';
    
    doc.text(registerTitle, { align: 'center' });
    doc.moveDown(0.2);
    
    // Add date range
    const fromDate = dateFrom ? new Date(dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
    const toDate = dateTo ? new Date(dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
    
    if (fromDate && toDate) {
      doc.fontSize(10).font('Helvetica');
      doc.text(`${fromDate} to ${toDate}`, { align: 'center' });
    }
    doc.moveDown(0.5);
    
    // Add Page number
    doc.text('Page 1', { align: 'right' });
    doc.moveDown(0.5);
    
    // Draw table header
    const tableTop = doc.y;
    const tableHeaders = ['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit Amount', 'Credit Amount'];
    const colWidths = {
      date: pageWidth * 0.12,
      particulars: pageWidth * 0.38,
      vchType: pageWidth * 0.12,
      vchNo: pageWidth * 0.12,
      debit: pageWidth * 0.13,
      credit: pageWidth * 0.13
    };
    
    // Draw table header line
    doc.lineWidth(0.5).moveTo(doc.page.margins.left, tableTop).lineTo(doc.page.margins.left + pageWidth, tableTop).stroke();
    
    // Draw table header text
    let currentX = doc.page.margins.left;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
    
    doc.text(tableHeaders[0], currentX, tableTop + 5, { width: colWidths.date });
    currentX += colWidths.date;
    
    doc.text(tableHeaders[1], currentX, tableTop + 5, { width: colWidths.particulars });
    currentX += colWidths.particulars;
    
    doc.text(tableHeaders[2], currentX, tableTop + 5, { width: colWidths.vchType });
    currentX += colWidths.vchType;
    
    doc.text(tableHeaders[3], currentX, tableTop + 5, { width: colWidths.vchNo });
    currentX += colWidths.vchNo;
    
    doc.text(tableHeaders[4], currentX, tableTop + 5, { width: colWidths.debit, align: 'right' });
    currentX += colWidths.debit;
    
    doc.text(tableHeaders[5], currentX, tableTop + 5, { width: colWidths.credit, align: 'right' });
    
    // Move down after header
    doc.moveDown(1.5);
    
    // Draw header bottom line
    doc.lineWidth(0.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
    
    // Group bills by date
    const billsByDate = {};
    billsWithItems.forEach(bill => {
      const dateKey = new Date(bill.bdate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
      if (!billsByDate[dateKey]) {
        billsByDate[dateKey] = [];
      }
      billsByDate[dateKey].push(bill);
    });
    
    // Track totals
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Function to check if we need a new page
    const checkNewPage = (requiredHeight) => {
      const currentY = doc.y;
      const remainingSpace = doc.page.height - doc.page.margins.bottom - currentY - 40; // Extra space for footer
      
      if (remainingSpace < requiredHeight) {
        doc.addPage();
        
        // Add page number
        const pageCount = doc.bufferedPageRange().count;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Page ${pageCount}`, { align: 'right' });
        doc.moveDown(0.5);
        
        // Redraw table header
        const newTableTop = doc.y;
        
        // Draw table header line
        doc.lineWidth(0.5).moveTo(doc.page.margins.left, newTableTop).lineTo(doc.page.margins.left + pageWidth, newTableTop).stroke();
        
        // Draw table header text
        let newCurrentX = doc.page.margins.left;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        
        doc.text(tableHeaders[0], newCurrentX, newTableTop + 5, { width: colWidths.date });
        newCurrentX += colWidths.date;
        
        doc.text(tableHeaders[1], newCurrentX, newTableTop + 5, { width: colWidths.particulars });
        newCurrentX += colWidths.particulars;
        
        doc.text(tableHeaders[2], newCurrentX, newTableTop + 5, { width: colWidths.vchType });
        newCurrentX += colWidths.vchType;
        
        doc.text(tableHeaders[3], newCurrentX, newTableTop + 5, { width: colWidths.vchNo });
        newCurrentX += colWidths.vchNo;
        
        doc.text(tableHeaders[4], newCurrentX, newTableTop + 5, { width: colWidths.debit, align: 'right' });
        newCurrentX += colWidths.debit;
        
        doc.text(tableHeaders[5], newCurrentX, newTableTop + 5, { width: colWidths.credit, align: 'right' });
        
        // Move down after header
        doc.moveDown(1.5);
        
        // Draw header bottom line
        doc.lineWidth(0.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
        
        return true;
      }
      return false;
    };
    
    // Render bills grouped by date
    for (const [dateKey, dateBills] of Object.entries(billsByDate)) {
      // Check if we need a new page for this date group
      checkNewPage(20 + (dateBills.length * 20));
      
      // Process each bill for this date
      dateBills.forEach((bill, index) => {
        const rowY = doc.y;
        let currentX = doc.page.margins.left;
        
        doc.fontSize(10).font('Helvetica');
        
        // Only show date for the first bill of the date
        if (index === 0) {
          doc.text(dateKey, currentX, rowY, { width: colWidths.date });
        }
        currentX += colWidths.date;
        
        // Particulars column
        doc.text(bill.supply, currentX, rowY, { width: colWidths.particulars });
        currentX += colWidths.particulars;
        
        // Voucher Type column
        doc.text(bill.btype || 'Sales', currentX, rowY, { width: colWidths.vchType });
        currentX += colWidths.vchType;
        
        // Voucher No column
        doc.text(bill.bno || '', currentX, rowY, { width: colWidths.vchNo });
        currentX += colWidths.vchNo;
        
        // Debit Amount column - always show NTOT value
        doc.text(bill.ntot.toFixed(2), currentX, rowY, { width: colWidths.debit, align: 'right' });
        totalDebit += bill.ntot;
        currentX += colWidths.debit;
        
        // Credit Amount column (for SALES type)
        if (bill.btype === 'SALES') {
          doc.text(bill.ntot.toFixed(2), currentX, rowY, { width: colWidths.credit, align: 'right' });
          totalCredit += bill.ntot;
        } else {
          doc.text('', currentX, rowY, { width: colWidths.credit, align: 'right' });
        }
        
        // Add service details for each bill
        if (bill.stockItems && bill.stockItems.length > 0) {
          bill.stockItems.forEach(item => {
            doc.moveDown(0.5);
            checkNewPage(15);
            
            const serviceRowY = doc.y;
            currentX = doc.page.margins.left + colWidths.date; // Indent under the date
            
            // Format the item line with proper item name and UOM
            const serviceText = `${item.item}     ${item.qty} ${item.uom}  ${item.rate.toFixed(2)}/${item.uom}     ${item.total.toFixed(2)}`;
            doc.text(serviceText, currentX, serviceRowY, { width: colWidths.particulars + colWidths.vchType + colWidths.vchNo });
          });
        }
        
        // Add sales line if needed
        if (bill.btype === 'SALES' && bill.stockItems && bill.stockItems.some(item => item.item.includes('SALES'))) {
          doc.moveDown(0.5);
          checkNewPage(15);
          
          const salesRowY = doc.y;
          currentX = doc.page.margins.left + colWidths.date; // Indent under the date
          
          doc.text('SALES @ 18%', currentX, salesRowY, { width: colWidths.particulars });
        }
        
        // Add other charges if available - MOVED BEFORE CGST/SGST
        if (bill.oth_chg && bill.oth_chg.length > 0) {
          bill.oth_chg.forEach(charge => {
            doc.moveDown(0.5);
            checkNewPage(15);
            
            const chargeRowY = doc.y;
            currentX = doc.page.margins.left + colWidths.date; // Indent under the date
            
            // Display charge description and amount
            const chargeText = `${charge.description || 'Other Charge'}: ${charge.oth_amt ? charge.oth_amt.toFixed(2) : '0.00'}`;
            doc.text(chargeText, currentX, chargeRowY, { width: colWidths.particulars + colWidths.vchType + colWidths.vchNo });
          });
        }
        
        // Add cost and SGST lines if needed - MOVED AFTER OTHER CHARGES
        if (bill.cgst > 0 || bill.sgst > 0) {
          doc.moveDown(0.5);
          checkNewPage(30);
          
          const costRowY = doc.y;
          currentX = doc.page.margins.left + colWidths.date; // Indent under the date
          
          // Display CGST with value
          doc.text(`CGST @ ${bill.cgst ? (bill.cgst * 100 / bill.gtot).toFixed(1) : 0}%: ${bill.cgst ? bill.cgst.toFixed(2) : '0.00'}`, currentX, costRowY, { width: colWidths.particulars + colWidths.vchType + colWidths.vchNo });
          doc.moveDown(0.5);
          
          const sgstRowY = doc.y;
          // Display SGST with value
          doc.text(`SGST @ ${bill.sgst ? (bill.sgst * 100 / bill.gtot).toFixed(1) : 0}%: ${bill.sgst ? bill.sgst.toFixed(2) : '0.00'}`, currentX, sgstRowY, { width: colWidths.particulars + colWidths.vchType + colWidths.vchNo });
        }
        
        // Add round off if needed
        if (bill.rof) {
          doc.moveDown(0.5);
          checkNewPage(15);
          
          const rofRowY = doc.y;
          currentX = doc.page.margins.left + colWidths.date; // Indent under the date
          
          doc.text(`ROUND OFF: ${bill.rof ? bill.rof.toFixed(2) : '0.00'}`, currentX, rofRowY, { width: colWidths.particulars + colWidths.vchType + colWidths.vchNo });
        }
        
        doc.moveDown(0.5);
      });
      
      // Add a line after each date group
      doc.lineWidth(0.25).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
      doc.moveDown(0.5);
    }
    
    // Check if we need a new page for the total
    checkNewPage(30);
    
    // Add total row
    const totalRowY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total:', doc.page.margins.left, totalRowY, { width: colWidths.date + colWidths.particulars + colWidths.vchType + colWidths.vchNo });
    
    // Total Debit
    doc.text(totalDebit.toFixed(2), doc.page.margins.left + colWidths.date + colWidths.particulars + colWidths.vchType + colWidths.vchNo, totalRowY, { width: colWidths.debit, align: 'right' });
    
    // Total Credit
    doc.text(totalCredit.toFixed(2), doc.page.margins.left + colWidths.date + colWidths.particulars + colWidths.vchType + colWidths.vchNo + colWidths.debit, totalRowY, { width: colWidths.credit, align: 'right' });
    
    // Draw final line
    doc.moveDown(0.5);
    doc.lineWidth(0.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).stroke();
    
    // Finalize PDF
    doc.end();

    // Return the buffered PDF
    return new Promise((resolve) => {
      let isResolved = false;
      doc.on('end', () => {
        if (!isResolved) {
          isResolved = true;
          resolve(Buffer.concat(chunks));
        }
      });
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to generate PDF'
    });
  }
});