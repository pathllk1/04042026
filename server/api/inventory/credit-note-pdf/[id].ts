// server/api/inventory/credit-note-pdf/[id].ts
import { defineEventHandler, createError } from 'h3';
import PDFDocument from 'pdfkit';
import Bills from '../../../models/inventory/Bills';
import StockReg from '../../../models/inventory/StockReg';
import Firm from '../../../models/Firm';

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

    // Get the bill ID from the URL
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Missing bill ID'
      });
    }

    // Find the bill
    const bill = await Bills.findOne({
      _id: id,
      firm: user.firmId,
      btype: 'CREDIT NOTE'
    });

    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found: Credit note not found'
      });
    }

    // Find the firm
    const firm = await Firm.findById(user.firmId);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found: Firm not found'
      });
    }

    // Find stock items for this bill
    const stockItems = await StockReg.find({
      billId: id,
      firm: user.firmId,
      type: 'CREDIT NOTE'
    });

    // Create a new PDF document
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      bufferPages: true, // Enable page buffering for proper page numbering
      info: {
        Title: `Credit Note ${bill.bno}`,
        Author: firm.name,
        Subject: 'Credit Note',
        Keywords: 'credit note, bill, pdf',
        Creator: 'Invoice System'
      }
    });

    // Initialize page counter
    let pageNumber = 1;

    // Create a buffer to collect the PDF data
    const chunks = [];

    // Set up event handlers to collect PDF data
    doc.on('data', (chunk) => chunks.push(chunk));

    // Create a promise that resolves when the PDF is complete
    const pdfPromise = new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Define colors
    const primaryColor = '#4F46E5'; // Indigo
    const secondaryColor = '#818CF8'; // Light indigo
    const textColor = '#1F2937'; // Dark gray
    const lightGray = '#F3F4F6'; // Light gray for alternating rows

    // Add header with firm information
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('CREDIT NOTE', { align: 'center' });

    doc.moveDown(0.5);

    // Add firm details
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(textColor)
       .text(firm.name.toUpperCase(), { align: 'center' });

    doc.fontSize(10)
       .font('Helvetica')
       .text(firm.address || '', { align: 'center' });

    if (firm.gstin) {
      doc.text(`GSTIN: ${firm.gstin}`, { align: 'center' });
    }

    doc.moveDown(1);

    // Add a horizontal line
    doc.strokeColor(primaryColor)
       .lineWidth(1)
       .moveTo(30, doc.y)
       .lineTo(doc.page.width - 30, doc.y)
       .stroke();

    doc.moveDown(1);

    // Add bill details in a table-like format
    const startY = doc.y;
    const colWidth = (doc.page.width - 60) / 2;

    // Left column - Bill details
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('Credit Note No:', 30, startY)
       .font('Helvetica')
       .text(bill.bno, 120, startY);

    doc.font('Helvetica-Bold')
       .text('Date:', 30, startY + 20)
       .font('Helvetica')
       .text(new Date(bill.bdate).toLocaleDateString(), 120, startY + 20);

    // Right column - Party details
    doc.font('Helvetica-Bold')
       .text('Party:', 30 + colWidth, startY)
       .font('Helvetica')
       .text(bill.supply, 30 + colWidth + 70, startY);

    if (bill.gstin) {
      doc.font('Helvetica-Bold')
         .text('GSTIN:', 30 + colWidth, startY + 20)
         .font('Helvetica')
         .text(bill.gstin, 30 + colWidth + 70, startY + 20);
    }

    if (bill.address) {
      doc.font('Helvetica-Bold')
         .text('Address:', 30 + colWidth, startY + 40)
         .font('Helvetica')
         .text(bill.address, 30 + colWidth + 70, startY + 40, {
           width: colWidth - 70,
           height: 40
         });
    }

    doc.moveDown(4);

    // Add stock items table
    const tableTop = doc.y;
    const tableHeaders = ['S.No', 'Item', 'HSN', 'Qty', 'UOM', 'Rate', 'Amount'];
    const tableWidths = [30, 180, 60, 40, 40, 60, 80]; // Adjust widths as needed
    const tableX = 30;
    let tableY = tableTop;

    // Draw table header
    doc.fillColor(primaryColor)
       .rect(tableX, tableY, doc.page.width - 60, 20)
       .fill();

    doc.fillColor('white')
       .font('Helvetica-Bold')
       .fontSize(10);

    let xPos = tableX;
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos + 5, tableY + 5, {
        width: tableWidths[i],
        align: i === 1 ? 'left' : 'center'
      });
      xPos += tableWidths[i];
    });

    tableY += 20;

    // Draw table rows
    stockItems.forEach((item, index) => {
      // Check if we need a new page
      if (tableY > doc.page.height - 100) {
        doc.addPage();
        pageNumber++;
        tableY = 50;

        // Redraw table header on new page
        doc.fillColor(primaryColor)
           .rect(tableX, tableY, doc.page.width - 60, 20)
           .fill();

        doc.fillColor('white')
           .font('Helvetica-Bold')
           .fontSize(10);

        xPos = tableX;
        tableHeaders.forEach((header, i) => {
          doc.text(header, xPos + 5, tableY + 5, {
            width: tableWidths[i],
            align: i === 1 ? 'left' : 'center'
          });
          xPos += tableWidths[i];
        });

        tableY += 20;
      }

      // Draw alternating row background
      if (index % 2 === 0) {
        doc.fillColor(lightGray)
           .rect(tableX, tableY, doc.page.width - 60, 20)
           .fill();
      }

      // Draw row data
      doc.fillColor(textColor)
         .font('Helvetica')
         .fontSize(9);

      xPos = tableX;
      
      // S.No
      doc.text((index + 1).toString(), xPos + 5, tableY + 5, {
        width: tableWidths[0],
        align: 'center'
      });
      xPos += tableWidths[0];
      
      // Item
      doc.text(item.item, xPos + 5, tableY + 5, {
        width: tableWidths[1],
        align: 'left'
      });
      xPos += tableWidths[1];
      
      // HSN
      doc.text(item.hsn, xPos + 5, tableY + 5, {
        width: tableWidths[2],
        align: 'center'
      });
      xPos += tableWidths[2];
      
      // Qty
      doc.text(item.qty.toString(), xPos + 5, tableY + 5, {
        width: tableWidths[3],
        align: 'center'
      });
      xPos += tableWidths[3];
      
      // UOM
      doc.text(item.uom, xPos + 5, tableY + 5, {
        width: tableWidths[4],
        align: 'center'
      });
      xPos += tableWidths[4];
      
      // Rate
      doc.text(item.rate.toFixed(2), xPos + 5, tableY + 5, {
        width: tableWidths[5],
        align: 'center'
      });
      xPos += tableWidths[5];
      
      // Amount
      doc.text(item.total.toFixed(2), xPos + 5, tableY + 5, {
        width: tableWidths[6],
        align: 'center'
      });
      
      tableY += 20;
    });

    // Add total section
    doc.moveDown(1);
    const totalY = tableY + 20;
    
    // Draw total box
    doc.strokeColor(primaryColor)
       .lineWidth(1)
       .rect(doc.page.width - 200, totalY, 170, 80)
       .stroke();
    
    // Add total details
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(textColor);
    
    doc.text('Sub Total:', doc.page.width - 190, totalY + 10);
    doc.font('Helvetica')
       .text(bill.stot.toFixed(2), doc.page.width - 90, totalY + 10, { align: 'right' });
    
    if (bill.dtot > 0) {
      doc.font('Helvetica-Bold')
         .text('Discount:', doc.page.width - 190, totalY + 25);
      doc.font('Helvetica')
         .text(bill.dtot.toFixed(2), doc.page.width - 90, totalY + 25, { align: 'right' });
    }
    
    if (bill.gtot > 0) {
      doc.font('Helvetica-Bold')
         .text('GST:', doc.page.width - 190, totalY + 40);
      doc.font('Helvetica')
         .text(bill.gtot.toFixed(2), doc.page.width - 90, totalY + 40, { align: 'right' });
    }
    
    doc.font('Helvetica-Bold')
       .text('Net Total:', doc.page.width - 190, totalY + 60);
    doc.font('Helvetica-Bold')
       .text(bill.ntot.toFixed(2), doc.page.width - 90, totalY + 60, { align: 'right' });
    
    // Add footer
    const footerY = doc.page.height - 50;
    
    doc.font('Helvetica')
       .fontSize(8)
       .fillColor(textColor)
       .text('This is a computer-generated document. No signature is required.', 30, footerY, { align: 'center' });
    
    // Count total pages
    const totalPageCount = doc.bufferedPageCount;
    
    // Loop through each page and add the correct page number
    for (let i = 0; i < totalPageCount; i++) {
      doc.switchToPage(i);
      
      // Clear the area where the page number is displayed
      doc.fillColor('white')
         .rect(doc.page.width - 100, 30, 70, 20)
         .fill();
      
      // Add the correct page number
      doc.fillColor(textColor)
         .fontSize(10)
         .font('Helvetica')
         .text(`Page ${i + 1} of ${totalPageCount}`, doc.page.width - 60, 30, { align: 'right' });
    }
    
    // Finalize the PDF
    doc.end();
    
    // Return the PDF buffer
    return pdfPromise;
    
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error generating credit note PDF: ${error.message || 'Unknown error'}`
    });
  }
});
