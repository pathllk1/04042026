// server/api/inventory/bills-professional-pdf/[id].ts
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
    const query = getQuery(event);
    const queryId = query.id;
    const billId = id || queryId;

    if (!billId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bill ID is required'
      });
    }

    // Get print configuration from headers or query parameters (like original system)
    let printConfig: any = null;
    try {
      // First try headers
      const printConfigHeader = getHeader(event, 'x-print-config') ||
                               getHeader(event, 'X-Print-Config') ||
                               getHeader(event, 'X-PRINT-CONFIG');

      if (printConfigHeader && printConfigHeader !== 'null') {
        printConfig = JSON.parse(printConfigHeader);
      } else {
        // Try query parameter as fallback
        const query = getQuery(event);
        const printConfigQuery = query.printConfig;

        if (printConfigQuery && printConfigQuery !== 'null') {
          printConfig = JSON.parse(decodeURIComponent(printConfigQuery as string));
        }
      }
    } catch (err) {
      console.warn('Failed to parse print configuration:', err);
    }

    // Find the bill with populated stock items
    const bill = await Bills.findById(billId).populate('stockRegIds').lean();
    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bill not found'
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

    // Find the party (optional)
    let party: any = null;
    if (bill.partyId) {
      party = await Party.findById(bill.partyId);
    } else {
      party = await Party.findOne({ supply: bill.supply });
    }

    // Transform the populated data structure
    const stockItems: any[] = bill.stockRegIds || [];

    // Get firm details from database (Bills.ts model)
    let firmGSTNumber = firm.gstNo;
    let firmState = firm.state;
    let firmName = firm.name;
    let firmAddress = firm.address;
    let firmContactNo = firm.contactNo;
    let firmEmail = firm.email;

    // Get party details from bill and party data
    let partyGSTNumber = bill.gstin;
    let partyState = (bill as any).partyState || bill.state;

    // If party data exists, use it for more accurate information
    if (party) {
      partyState = party.state || partyState;
      // If party has GST registrations, use the primary one or first available
      if ((party as any).gstRegistrations && (party as any).gstRegistrations.length > 0) {
        const primaryGST = (party as any).gstRegistrations.find((gst: any) => gst.isPrimary) || (party as any).gstRegistrations[0];
        if (primaryGST) {
          partyGSTNumber = primaryGST.gstNumber || partyGSTNumber;
          partyState = primaryGST.state || partyState;
        }
      }
    }

    // Use saved GST selection if available (this overrides above)
    if (bill.gstSelection) {
      if (bill.gstSelection.firmGST) {
        firmGSTNumber = bill.gstSelection.firmGST.gstNumber || firmGSTNumber;
        firmState = bill.gstSelection.firmGST.state || firmState;
        if (bill.gstSelection.firmGST.address) {
          firmAddress = bill.gstSelection.firmGST.address;
        }
        if (bill.gstSelection.firmGST.locationName && bill.gstSelection.firmGST.locationName !== 'Head Office') {
          firmName = `${firm.name} - ${bill.gstSelection.firmGST.locationName}`;
        }
      }
      if (bill.gstSelection.partyGST) {
        partyGSTNumber = bill.gstSelection.partyGST.gstNumber || partyGSTNumber;
        partyState = bill.gstSelection.partyGST.state || partyState;
      }
    }

    // Extract state code from GSTIN for validation
    const getStateCodeFromGSTIN = (gstin: string): string => {
      if (!gstin || gstin === 'UNREGISTERED') return '';
      const stateCode = gstin.substring(0, 2);
      return stateCode;
    };

    // State code mapping function (declare early to avoid hoisting issues)
    const getStateCode = (stateName: string | null | undefined): string => {
      if (!stateName) return '';
      const normalizedStateName = stateName.toLowerCase().trim();
      const stateMap: Record<string, string> = {
        'andhra pradesh': '37', 'arunachal pradesh': '12', 'assam': '18', 'bihar': '10',
        'chhattisgarh': '22', 'goa': '30', 'gujarat': '24', 'haryana': '06',
        'himachal pradesh': '02', 'jharkhand': '20', 'karnataka': '29', 'kerala': '32',
        'madhya pradesh': '23', 'maharashtra': '27', 'manipur': '14', 'meghalaya': '17',
        'mizoram': '15', 'nagaland': '13', 'odisha': '21', 'punjab': '03',
        'rajasthan': '08', 'sikkim': '11', 'tamil nadu': '33', 'telangana': '36',
        'tripura': '16', 'uttar pradesh': '09', 'uttarakhand': '05', 'west bengal': '19',
        'andaman and nicobar islands': '35', 'chandigarh': '04', 'dadra and nagar haveli and daman and diu': '26',
        'delhi': '07', 'jammu and kashmir': '01', 'ladakh': '38', 'lakshadweep': '31', 'puducherry': '34'
      };
      const stateCode = stateMap[normalizedStateName];
      return stateCode ? `(${stateCode})` : '';
    };

    // Validate and correct state code mismatch (declared after getStateCode)
    const validateStateCode = (gstin: string, stateName: string): string => {
      if (!gstin || gstin === 'UNREGISTERED' || !stateName) return stateName;

      const gstinStateCode = gstin.substring(0, 2);
      const expectedStateCode = getStateCode(stateName).replace(/[()]/g, '');

      if (gstinStateCode !== expectedStateCode) {
        // Find correct state name from GSTIN code
        const stateCodeMap: Record<string, string> = {
          '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
          '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
          '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
          '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
          '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
          '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
          '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
          '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
          '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
        };

        return stateCodeMap[gstinStateCode] || stateName;
      }

      return stateName;
    };

    // Correct state names based on GSTIN (now called after functions are declared)
    if (partyGSTNumber && partyGSTNumber !== 'UNREGISTERED') {
      partyState = validateStateCode(partyGSTNumber, partyState);
    }
    if (firmGSTNumber && firmGSTNumber !== 'UNREGISTERED') {
      firmState = validateStateCode(firmGSTNumber, firmState);
    }

    // Simple same state check for GST calculation
    const sameState = firmState?.toLowerCase() === partyState?.toLowerCase();

    // Set response headers
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="professional_invoice_${bill.bno}.pdf"`);

    // Create a new PDF document with compact settings (max 10px margins)
    const doc = new PDFDocument({
      margin: 10,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Professional Invoice ${bill.bno}`,
        Author: firmName,
        Subject: `${bill.btype} Professional Invoice`,
        Keywords: 'professional, invoice, bill, pdf',
        Creator: 'Professional Invoice System'
      }
    });

    // Initialize page counter
    let pageNumber: number = 1;

    // Create a buffer to collect the PDF data
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Create a promise that resolves when the PDF is complete
    const pdfPromise = new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks as any));
      });
    });

    // Professional color scheme - different from existing API
    const colors = {
      primary: '#1e40af',      // Professional blue
      secondary: '#059669',    // Professional green
      accent: '#dc2626',       // Professional red
      text: '#1f2937',         // Dark gray
      lightText: '#6b7280',    // Light gray
      background: '#f8fafc',   // Very light blue
      border: '#d1d5db',       // Light border
      white: '#ffffff'
    };

    // Helper functions for professional styling
    const safeParseFloat = (value: any, defaultValue: number = 0): number => {
      if (value === null || value === undefined || value === '') return defaultValue;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const formatCurrency = (amount: any, showSymbol: boolean = false): string => {
      const safeAmount = safeParseFloat(amount, 0);
      const formattedNumber = safeAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return showSymbol ? `Rs.${formattedNumber}` : formattedNumber;
    };

    const formatDate = (dateString: string | Date | null | undefined): string => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    // Start rendering the professional PDF with compact margins
    let currentY: number = 10;

    // Section A: Firm Header (Dynamic) - Compact
    const renderFirmHeader = () => {
      // Add page number
      doc.fontSize(9).font('Helvetica').fillColor(colors.lightText);
      doc.text(`Page ${pageNumber}`, doc.page.width - 50, 10, { align: 'right' });

      // Firm name with professional styling - more compact
      doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.primary);
      doc.text(firmName.toUpperCase(), 10, currentY, { align: 'center', width: doc.page.width - 20 });
      currentY += 25;

      // Firm address with dynamic height - more compact
      if (firmAddress) {
        doc.fontSize(9).font('Helvetica').fillColor(colors.text);
        const addressHeight = doc.heightOfString(firmAddress, { width: doc.page.width - 20 });
        doc.text(firmAddress, 10, currentY, { align: 'center', width: doc.page.width - 20 });
        currentY += Math.max(12, addressHeight + 3);
      }

      // Contact information - more compact
      const contactInfo = `Phone: ${firmContactNo || 'N/A'} | Email: ${firmEmail || 'N/A'} | GSTIN: ${firmGSTNumber || 'N/A'}`;
      doc.fontSize(8).fillColor(colors.lightText);
      doc.text(contactInfo, 10, currentY, { align: 'center', width: doc.page.width - 20 });
      currentY += 15;

      // Professional separator line - more compact
      doc.moveTo(10, currentY).lineTo(doc.page.width - 10, currentY).lineWidth(1).stroke(colors.primary);
      currentY += 8;
    };

    // Section B: Invoice Title (Dynamic) - Compact
    const renderInvoiceTitle = () => {
      // Professional title background - more compact
      doc.rect(10, currentY, doc.page.width - 20, 22).fill(colors.primary);
      doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold');
      const title = bill.btype === 'SALES' ? 'TAX INVOICE' : 'SALES INVOICE';
      doc.text(title, 10, currentY + 6, { align: 'center', width: doc.page.width - 20 });
      currentY += 28;
      doc.fillColor(colors.text);
    };

    // Section C: Invoice Number & Date - Compact
    const renderInvoiceDetails = () => {
      // Professional box for invoice details - more compact
      const boxHeight = 18;
      doc.rect(10, currentY, doc.page.width - 20, boxHeight).fill(colors.background).stroke(colors.border);

      const colWidth = (doc.page.width - 20) / 2;

      // Invoice number - more compact
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.text);
      doc.text('Invoice No:', 15, currentY + 5);
      doc.font('Helvetica').text(bill.bno || 'N/A', 75, currentY + 5);

      // Invoice date - more compact
      doc.font('Helvetica-Bold');
      doc.text('Date:', 15 + colWidth, currentY + 5);
      doc.font('Helvetica').text(formatDate(bill.bdate), 15 + colWidth + 35, currentY + 5);

      currentY += boxHeight + 5; // Reduced spacing from 8px to 5px
    };

    // Section D: Party Details (Two rows layout) - Dynamic height
    const renderPartyDetails = () => {
      const colWidth = (doc.page.width - 20) / 2;
      const sectionStartY = currentY;

      // Calculate content first to determine dynamic height
      let leftY = currentY + 18;
      let rightY = currentY + 18;

      // Calculate left column height
      leftY += 12; // Name
      if (bill.addr) {
        const addrHeight = doc.heightOfString(bill.addr, { width: colWidth - 70 });
        leftY += Math.max(12, addrHeight + 3); // Address
      }
      leftY += 12; // GSTIN
      if (partyState) {
        leftY += 12; // State
      }

      // Calculate right column height
      rightY += 12; // Name
      const consigneeAddr = bill.consigneeAddress || bill.addr;
      if (consigneeAddr) {
        const consigneeAddrHeight = doc.heightOfString(consigneeAddr, { width: colWidth - 55 });
        rightY += Math.max(12, consigneeAddrHeight + 3); // Address
      }
      rightY += 12; // GSTIN
      const consigneeState = bill.consigneeState || partyState;
      if (consigneeState) {
        rightY += 12; // State
      }

      // Calculate dynamic section height with minimum height
      const contentHeight = Math.max(leftY, rightY) - sectionStartY;
      const sectionHeight = Math.max(80, contentHeight + 10); // Minimum 80px, or content + padding

      // Draw section background
      doc.rect(10, currentY, doc.page.width - 20, sectionHeight).fill(colors.background).stroke(colors.border);

      // Bill To section - more compact
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10);
      doc.text('Bill To', 15, currentY + 5);

      leftY = currentY + 18;
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);

      // Party name - more compact with better spacing
      doc.font('Helvetica-Bold').text('Name:', 15, leftY);
      doc.font('Helvetica').text(bill.supply || 'N/A', 60, leftY, { width: colWidth - 70 });
      leftY += 12;

      // Party address - more compact with better spacing
      if (bill.addr) {
        doc.font('Helvetica-Bold').text('Address:', 15, leftY);
        const addrHeight = doc.heightOfString(bill.addr, { width: colWidth - 70 });
        doc.font('Helvetica').text(bill.addr, 60, leftY, { width: colWidth - 70 });
        leftY += Math.max(12, addrHeight + 3);
      }

      // Party GSTIN - more compact with better spacing
      doc.font('Helvetica-Bold').text('GSTIN:', 15, leftY);
      doc.font('Helvetica').text(partyGSTNumber || 'UNREGISTERED', 60, leftY, { width: colWidth - 70 });
      leftY += 12;

      // Party state - more compact with better spacing
      if (partyState) {
        doc.font('Helvetica-Bold').text('State:', 15, leftY);
        doc.font('Helvetica').text(`${partyState} ${getStateCode(partyState)}`, 60, leftY, { width: colWidth - 70 });
      }

      // Ship To section (right column) - more compact
      const rightX = 15 + colWidth;
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10);
      doc.text('Ship To', rightX, currentY + 5);

      rightY = currentY + 18;
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);

      // Consignee name - more compact with better spacing
      doc.font('Helvetica-Bold').text('Name:', rightX, rightY);
      doc.font('Helvetica').text(bill.consigneeName || bill.supply || 'N/A', rightX + 45, rightY, { width: colWidth - 55 });
      rightY += 12;

      // Consignee address - more compact with better spacing
      if (consigneeAddr) {
        doc.font('Helvetica-Bold').text('Address:', rightX, rightY);
        const consigneeAddrHeight = doc.heightOfString(consigneeAddr, { width: colWidth - 55 });
        doc.font('Helvetica').text(consigneeAddr, rightX + 45, rightY, { width: colWidth - 55 });
        rightY += Math.max(12, consigneeAddrHeight + 3);
      }

      // Consignee GSTIN - more compact with better spacing
      const consigneeGstin = bill.consigneeGstin || partyGSTNumber;
      doc.font('Helvetica-Bold').text('GSTIN:', rightX, rightY);
      doc.font('Helvetica').text(consigneeGstin || 'UNREGISTERED', rightX + 45, rightY, { width: colWidth - 55 });
      rightY += 12;

      // Consignee state - more compact with better spacing
      if (consigneeState) {
        doc.font('Helvetica-Bold').text('State:', rightX, rightY);
        doc.font('Helvetica').text(`${consigneeState} ${getStateCode(consigneeState)}`, rightX + 45, rightY, { width: colWidth - 55 });
      }

      currentY += sectionHeight + 5; // Reduced spacing from 10px to 5px
    };

    // Section E: Order & Dispatch Details (Optional) - Dynamic height
    const renderOrderDispatchDetails = () => {
      // Check if any order/dispatch data exists
      const hasOrderData = bill.orderNo || bill.orderDate;
      const hasDispatchData = bill.dispatchThrough || bill.docketNo || bill.vehicleNo;

      if (!hasOrderData && !hasDispatchData) {
        return; // Skip section if no data
      }

      const colWidth = (doc.page.width - 20) / 2;
      const sectionStartY = currentY;

      // Calculate content height for dynamic sizing
      let leftY = currentY + 18;
      let rightY = currentY + 18;

      // Calculate left column height (Order Details)
      if (bill.orderNo) leftY += 12;
      if (bill.orderDate) leftY += 12;

      // Calculate right column height (Dispatch Details)
      if (bill.dispatchThrough) rightY += 12;
      if (bill.docketNo) rightY += 12;
      if (bill.vehicleNo) rightY += 12;

      // Calculate dynamic section height with minimum height
      const contentHeight = Math.max(leftY, rightY) - sectionStartY;
      const sectionHeight = Math.max(50, contentHeight + 10); // Minimum 50px, or content + padding

      // Draw section background
      doc.rect(10, currentY, doc.page.width - 20, sectionHeight).fill(colors.background).stroke(colors.border);

      // Section headers
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10);
      if (hasOrderData) {
        doc.text('Order Details', 15, currentY + 5);
      }
      if (hasDispatchData) {
        const rightX = 15 + colWidth;
        doc.text('Dispatch Details', rightX, currentY + 5);
      }

      doc.fillColor(colors.text).font('Helvetica').fontSize(8);

      // Left Column - Order Details
      if (hasOrderData) {
        leftY = currentY + 18;

        if (bill.orderNo) {
          doc.font('Helvetica-Bold').text('Order No:', 15, leftY);
          doc.font('Helvetica').text(bill.orderNo, 70, leftY, { width: colWidth - 80 });
          leftY += 12;
        }

        if (bill.orderDate) {
          doc.font('Helvetica-Bold').text('Order Date:', 15, leftY);
          const orderDateStr = new Date(bill.orderDate).toLocaleDateString('en-GB');
          doc.font('Helvetica').text(orderDateStr, 70, leftY, { width: colWidth - 80 });
          leftY += 12;
        }
      }

      // Right Column - Dispatch Details
      if (hasDispatchData) {
        const rightX = 15 + colWidth;
        rightY = currentY + 18;

        if (bill.dispatchThrough) {
          doc.font('Helvetica-Bold').text('Dispatch Through:', rightX, rightY);
          doc.font('Helvetica').text(bill.dispatchThrough, rightX + 85, rightY, { width: colWidth - 95 });
          rightY += 12;
        }

        if (bill.docketNo) {
          doc.font('Helvetica-Bold').text('Docket No:', rightX, rightY);
          doc.font('Helvetica').text(bill.docketNo, rightX + 65, rightY, { width: colWidth - 75 });
          rightY += 12;
        }

        if (bill.vehicleNo) {
          doc.font('Helvetica-Bold').text('Vehicle No:', rightX, rightY);
          doc.font('Helvetica').text(bill.vehicleNo, rightX + 65, rightY, { width: colWidth - 75 });
          rightY += 12;
        }
      }

      currentY += sectionHeight + 5; // Reduced spacing from 10px to 5px
    };

    // Section F: Items Details Table - Compact with outside borders
    const renderItemsTable = () => {
      // Define table structure - more compact
      const tableWidth = doc.page.width - 20;
      const colWidths: any = {
        sl: tableWidth * 0.06,
        item: tableWidth * 0.32,
        hsn: tableWidth * 0.10,
        qty: tableWidth * 0.08,
        rate: tableWidth * 0.10,
        disc: tableWidth * 0.08,
        gst: tableWidth * 0.08,
        amount: tableWidth * 0.18
      };

      // Draw title section without stroke to avoid white lines
      const titleHeight = 18;
      doc.rect(10, currentY, tableWidth, titleHeight).fill(colors.primary);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10);
      doc.text('ITEMS DETAILS', 15, currentY + 5); // Centered vertically in title section
      currentY += titleHeight;

      // Store table start position (after title) for border calculation
      const tableDataStartY = currentY;

      let xPos = 10;
      const headerHeight = 22;

      // Draw table header without stroke to avoid white lines
      doc.rect(10, currentY, tableWidth, headerHeight).fill(colors.secondary);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(9);

      // Header labels - more compact
      const headers = ['Sl', 'Item Description', 'HSN', 'Qty', 'Rate', 'Disc Amt', 'GST%', 'Amount'];
      const colKeys = ['sl', 'item', 'hsn', 'qty', 'rate', 'disc', 'gst', 'amount'];

      colKeys.forEach((key, index) => {
        const align = ['sl', 'hsn', 'qty', 'rate', 'disc', 'gst', 'amount'].includes(key) ? 'center' : 'left';
        doc.text(headers[index], xPos + 2, currentY + 7, { width: colWidths[key] - 4, align });

        // Draw column separator
        if (index < colKeys.length - 1) {
          doc.moveTo(xPos + colWidths[key], currentY).lineTo(xPos + colWidths[key], currentY + headerHeight).stroke(colors.white);
        }
        xPos += colWidths[key];
      });

      currentY += headerHeight;

      // Draw table rows with outside borders - dynamic height for narration
      let rowIndex = 0;
      stockItems.forEach((item, index) => {
        // Calculate dynamic row height for BOTH item text and narration - minimal spacing but complete content
        let rowHeight = 12; // Base height for simple items

        // Calculate item text height (for long item names that wrap)
        const rawItemHeight = doc.heightOfString(item.item, { width: colWidths.item - 4 });
        const itemHeight = rawItemHeight * 0.6; // Apply minimal spacing to item text too

        if (item.item_narration) {
          // Calculate narration height
          const rawNarrationHeight = doc.heightOfString(item.item_narration, { width: colWidths.item - 4 });
          const narrationHeight = rawNarrationHeight * 0.6; // Minimal spacing for narration

          // Total height = item text + small gap + narration + minimal padding
          rowHeight = Math.max(14, itemHeight + 2 + narrationHeight + 2); // 2px gap between item and narration, 2px bottom padding
        } else {
          // Only item text, no narration
          rowHeight = Math.max(12, itemHeight + 2); // Item text + minimal padding
        }
        const isEven = rowIndex % 2 === 0;

        // Alternating row colors with outside border
        doc.rect(10, currentY, tableWidth, rowHeight).fill(isEven ? colors.white : colors.background).stroke(colors.border).lineWidth(1);

        xPos = 10;
        doc.fillColor(colors.text).font('Helvetica').fontSize(8);

        // Calculate values
        const itemRate = safeParseFloat(item.rate, 0);
        const itemQty = safeParseFloat(item.qty, 0);
        const itemDisc = safeParseFloat(item.disc, 0);
        const discountAmount = (itemRate * itemQty * itemDisc / 100);
        const taxableAmount = (itemRate * itemQty) - discountAmount;

        // Row data
        const rowData = [
          (index + 1).toString(),
          item.item + (item.item_narration ? `\n${item.item_narration}` : ''),
          item.hsn || '-',
          `${itemQty} ${item.uom || ''}`,
          formatCurrency(itemRate),
          discountAmount > 0 ? formatCurrency(discountAmount) : '-',
          `${safeParseFloat(item.grate, 0)}%`,
          formatCurrency(taxableAmount)
        ];

        colKeys.forEach((key, colIndex) => {
          const align = ['sl', 'hsn', 'qty', 'rate', 'disc', 'gst', 'amount'].includes(key) ? 'center' : 'left';

          if (key === 'item' && item.item_narration) {
            // Handle item with narration - dynamic height with compact spacing
            doc.font('Helvetica-Bold').text(item.item, xPos + 2, currentY + 1, { width: colWidths[key] - 4 });
            doc.font('Helvetica').fontSize(6).fillColor(colors.lightText);
            doc.text(item.item_narration, xPos + 2, currentY + 9, { width: colWidths[key] - 4 });
            doc.fontSize(8).fillColor(colors.text);
          } else {
            // Calculate vertical center position for other columns when narration exists
            const yOffset = item.item_narration ? Math.max(4, (rowHeight - 8) / 2) : 4;
            doc.text(rowData[colIndex], xPos + 2, currentY + yOffset, { width: colWidths[key] - 4, align });
          }

          // Draw column separator
          if (colIndex < colKeys.length - 1) {
            doc.moveTo(xPos + colWidths[key], currentY).lineTo(xPos + colWidths[key], currentY + rowHeight).stroke(colors.border);
          }
          xPos += colWidths[key];
        });

        currentY += rowHeight;
        rowIndex++;
      });

      // Add other charges if any - more compact
      if (bill.oth_chg && bill.oth_chg.length > 0) {
        bill.oth_chg.forEach((charge, index) => {
          const rowHeight = 14; // Consistent with items table
          const isEven = (rowIndex + index) % 2 === 0;

          doc.rect(10, currentY, tableWidth, rowHeight).fill(isEven ? colors.white : colors.background).stroke(colors.border).lineWidth(1);

          xPos = 10;
          doc.fillColor(colors.text).font('Helvetica').fontSize(8);

          const chargeAmount = safeParseFloat(charge.oth_amt, 0);
          const gstRate = safeParseFloat(charge.oth_grate, 0);

          const chargeRowData = [
            (stockItems.length + index + 1).toString(),
            charge.description || 'Other Charge',
            charge.oth_hsn || 'No HSN',
            '',
            formatCurrency(chargeAmount),
            '-',
            `${gstRate}%`,
            formatCurrency(chargeAmount)
          ];

          colKeys.forEach((key, colIndex) => {
            const align = ['sl', 'hsn', 'qty', 'rate', 'disc', 'gst', 'amount'].includes(key) ? 'center' : 'left';
            doc.text(chargeRowData[colIndex], xPos + 2, currentY + 4, { width: colWidths[key] - 4, align });

            if (colIndex < colKeys.length - 1) {
              doc.moveTo(xPos + colWidths[key], currentY).lineTo(xPos + colWidths[key], currentY + rowHeight).stroke(colors.border);
            }
            xPos += colWidths[key];
          });

          currentY += rowHeight;
        });
      }

      // Draw complete outside border for the table data only (excluding title)
      const tableEndY = currentY;
      doc.rect(10, tableDataStartY, tableWidth, tableEndY - tableDataStartY).stroke(colors.border).lineWidth(2);

      currentY += 10;
    };

    // Section G: Invoice Total Section - Compact
    const renderInvoiceTotals = () => {
      const totalsWidth = 200;
      const totalsX = doc.page.width - 10 - totalsWidth;
      const totalsHeight = sameState ? 90 : 75; // More compact height

      // Totals box
      doc.rect(totalsX, currentY, totalsWidth, totalsHeight).fill(colors.background).stroke(colors.border);

      // Header - more compact
      doc.rect(totalsX, currentY, totalsWidth, 18).fill(colors.secondary);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(9);
      doc.text('INVOICE SUMMARY', totalsX + 8, currentY + 5);

      let totalsY = currentY + 22;
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);

      // Gross Total - more compact
      doc.font('Helvetica-Bold').text('Gross Total:', totalsX + 8, totalsY);
      doc.font('Helvetica').text(`Rs.${formatCurrency(bill.gtot)}`, totalsX + totalsWidth - 80, totalsY, { align: 'right', width: 70 });
      totalsY += 12;

      // GST breakdown - more compact
      if (sameState) {
        // CGST
        doc.font('Helvetica-Bold').text('CGST:', totalsX + 8, totalsY);
        doc.font('Helvetica').text(`Rs.${formatCurrency(bill.cgst)}`, totalsX + totalsWidth - 80, totalsY, { align: 'right', width: 70 });
        totalsY += 12;

        // SGST
        doc.font('Helvetica-Bold').text('SGST:', totalsX + 8, totalsY);
        doc.font('Helvetica').text(`Rs.${formatCurrency(bill.sgst)}`, totalsX + totalsWidth - 80, totalsY, { align: 'right', width: 70 });
        totalsY += 12;
      } else {
        // IGST
        doc.font('Helvetica-Bold').text('IGST:', totalsX + 8, totalsY);
        doc.font('Helvetica').text(`Rs.${formatCurrency(bill.igst)}`, totalsX + totalsWidth - 80, totalsY, { align: 'right', width: 70 });
        totalsY += 12;
      }

      // Round Off - more compact
      doc.font('Helvetica-Bold').text('Round Off:', totalsX + 8, totalsY);
      doc.font('Helvetica').text(`Rs.${formatCurrency(bill.rof)}`, totalsX + totalsWidth - 80, totalsY, { align: 'right', width: 70 });
      totalsY += 12;

      // Net Total - more compact
      doc.rect(totalsX, totalsY - 3, totalsWidth, 18).fill(colors.primary);
      doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10);
      doc.text('Net Total:', totalsX + 8, totalsY + 2);
      doc.text(`Rs.${formatCurrency(bill.ntot)}`, totalsX + totalsWidth - 80, totalsY + 2, { align: 'right', width: 70 });

      currentY += totalsHeight + 10;
    };

    // Section H: HSN Summary Section
    const renderHSNSummary = () => {
      // Create HSN summary data
      const hsnSummary = new Map();

      // Process stock items
      stockItems.forEach(item => {
        const hsn = item.hsn || 'No HSN';
        const itemRate = safeParseFloat(item.rate, 0);
        const itemQty = safeParseFloat(item.qty, 0);
        const itemDisc = safeParseFloat(item.disc, 0);
        const taxableAmount = (itemRate * itemQty) * (1 - itemDisc / 100);
        const gstRate = safeParseFloat(item.grate, 0);

        if (!hsnSummary.has(hsn)) {
          hsnSummary.set(hsn, {
            taxableAmount,
            gstRate,
            cgst: sameState ? (taxableAmount * gstRate / 200) : 0,
            sgst: sameState ? (taxableAmount * gstRate / 200) : 0,
            igst: !sameState ? (taxableAmount * gstRate / 100) : 0
          });
        } else {
          const existing = hsnSummary.get(hsn);
          existing.taxableAmount += taxableAmount;
          existing.cgst += sameState ? (taxableAmount * gstRate / 200) : 0;
          existing.sgst += sameState ? (taxableAmount * gstRate / 200) : 0;
          existing.igst += !sameState ? (taxableAmount * gstRate / 100) : 0;
        }
      });

      if (hsnSummary.size > 0) {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10);
        doc.text('HSN SUMMARY', 10, currentY);
        currentY += 15;

        // HSN table - more compact with outside borders
        const hsnTableWidth = doc.page.width - 20;
        const hsnColWidths: any = sameState
          ? { hsn: 0.2, taxable: 0.2, cgst: 0.2, sgst: 0.2, totalGst: 0.2 }
          : { hsn: 0.33, taxable: 0.33, igst: 0.34 };

        // Header with outside border
        const hsnHeaderHeight = 18;
        doc.rect(10, currentY, hsnTableWidth, hsnHeaderHeight).fill(colors.accent).stroke(colors.border).lineWidth(2);
        doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(9);

        let hsnXPos = 10;
        const hsnHeaders = sameState ? ['HSN Code', 'Taxable Amount', 'CGST', 'SGST', 'Total GST'] : ['HSN Code', 'Taxable Amount', 'IGST'];
        const hsnColKeys = sameState ? ['hsn', 'taxable', 'cgst', 'sgst', 'totalGst'] : ['hsn', 'taxable', 'igst'];

        hsnColKeys.forEach((key, index) => {
          doc.text(hsnHeaders[index], hsnXPos + 3, currentY + 5, { width: hsnTableWidth * hsnColWidths[key] - 6, align: 'center' });
          if (index < hsnColKeys.length - 1) {
            doc.moveTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY)
               .lineTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY + hsnHeaderHeight)
               .stroke(colors.white);
          }
          hsnXPos += hsnTableWidth * hsnColWidths[key];
        });

        currentY += hsnHeaderHeight;

        // HSN rows with outside borders - more compact
        let hsnRowIndex = 0;
        let totalTaxableAmount = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        hsnSummary.forEach((summary, hsn) => {
          const hsnRowHeight = 15;
          const isEven = hsnRowIndex % 2 === 0;

          doc.rect(10, currentY, hsnTableWidth, hsnRowHeight).fill(isEven ? colors.white : colors.background).stroke(colors.border).lineWidth(1);

          hsnXPos = 10;
          doc.fillColor(colors.text).font('Helvetica').fontSize(8);

          // Calculate totals
          totalTaxableAmount += summary.taxableAmount;
          totalCgst += summary.cgst;
          totalSgst += summary.sgst;
          totalIgst += summary.igst;

          const hsnRowData = sameState
            ? [hsn, `Rs.${formatCurrency(summary.taxableAmount)}`, `Rs.${formatCurrency(summary.cgst)}`, `Rs.${formatCurrency(summary.sgst)}`, `Rs.${formatCurrency(summary.cgst + summary.sgst)}`]
            : [hsn, `Rs.${formatCurrency(summary.taxableAmount)}`, `Rs.${formatCurrency(summary.igst)}`];

          hsnColKeys.forEach((key, colIndex) => {
            const align = key === 'hsn' ? 'left' : 'right';
            doc.text(hsnRowData[colIndex], hsnXPos + 3, currentY + 4, {
              width: hsnTableWidth * hsnColWidths[key] - 6,
              align
            });

            if (colIndex < hsnColKeys.length - 1) {
              doc.moveTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY)
                 .lineTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY + hsnRowHeight)
                 .stroke(colors.border);
            }
            hsnXPos += hsnTableWidth * hsnColWidths[key];
          });

          currentY += hsnRowHeight;
          hsnRowIndex++;
        });

        // Add total row
        const totalRowHeight = 18;
        doc.rect(10, currentY, hsnTableWidth, totalRowHeight).fill(colors.primary).stroke(colors.border).lineWidth(1);

        hsnXPos = 10;
        doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(8);

        const totalRowData = sameState
          ? ['TOTAL', `Rs.${formatCurrency(totalTaxableAmount)}`, `Rs.${formatCurrency(totalCgst)}`, `Rs.${formatCurrency(totalSgst)}`, `Rs.${formatCurrency(totalCgst + totalSgst)}`]
          : ['TOTAL', `Rs.${formatCurrency(totalTaxableAmount)}`, `Rs.${formatCurrency(totalIgst)}`];

        hsnColKeys.forEach((key, colIndex) => {
          const align = key === 'hsn' ? 'center' : 'right';
          doc.text(totalRowData[colIndex], hsnXPos + 3, currentY + 5, {
            width: hsnTableWidth * hsnColWidths[key] - 6,
            align
          });

          if (colIndex < hsnColKeys.length - 1) {
            doc.moveTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY)
               .lineTo(hsnXPos + hsnTableWidth * hsnColWidths[key], currentY + totalRowHeight)
               .stroke(colors.white);
          }
          hsnXPos += hsnTableWidth * hsnColWidths[key];
        });

        currentY += totalRowHeight;

        // Draw complete outside border for HSN table
        const hsnTableStartY = currentY - (hsnHeaderHeight + (hsnSummary.size * 15) + totalRowHeight);
        const hsnTableEndY = currentY;
        doc.rect(10, hsnTableStartY, hsnTableWidth, hsnTableEndY - hsnTableStartY).stroke(colors.border).lineWidth(2);

        currentY += 10;
      }
    };

    // Section I: Amount in Words Section
    const renderAmountInWords = () => {
      const numberToWords = (num: any): string => {
        const safeNum = safeParseFloat(num, 0);
        if (safeNum === 0) return 'Zero';

        const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const formatTwoDigits = (num: number): string => {
          if (num < 10) return single[num];
          if (num < 20) return double[num - 10];
          const ten = Math.floor(num / 10);
          const unit = num % 10;
          return tens[ten] + (unit > 0 ? ' ' + single[unit] : '');
        };

        const formatGroup = (num: number, scale: string): string => {
          if (num === 0) return '';
          return formatTwoDigits(num) + (scale ? ' ' + scale : '');
        };

        let rupees = Math.floor(safeNum);
        let paise = Math.round((safeNum - rupees) * 100);

        if (rupees === 0) return 'Rupees Zero Only';

        let words = '';

        // Handle crores
        const crore = Math.floor(rupees / 10000000);
        rupees %= 10000000;
        if (crore > 0) {
          words += formatGroup(crore, 'Crore');
        }

        // Handle lakhs
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

        if (paise > 0) {
          result += ' and ' + formatTwoDigits(paise) + ' Paise';
        }

        return result + ' Only';
      };

      const amountInWords = numberToWords(bill.ntot);

      // Calculate total GST amount
      const totalGstAmount = sameState
        ? safeParseFloat(bill.cgst, 0) + safeParseFloat(bill.sgst, 0)
        : safeParseFloat(bill.igst, 0);
      const gstAmountInWords = numberToWords(totalGstAmount);

      const sectionHeight = 30; // Compact height for two lines
      doc.rect(10, currentY, doc.page.width - 20, sectionHeight).fill(colors.background).stroke(colors.border);

      // Amount in Words - Both label and value on same line for proper alignment
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9);
      doc.text('Amount in Words:', 15, currentY + 5);
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);
      doc.text(amountInWords, 120, currentY + 5, { width: doc.page.width - 135 });

      // GST amount in words - Both label and value on same line for proper alignment
      doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(8);
      doc.text('Total GST in Words:', 15, currentY + 18);
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);
      doc.text(gstAmountInWords, 120, currentY + 18, { width: doc.page.width - 135 });

      currentY += sectionHeight + 5;
    };

    // Section J: Bank Details Section (from user preferences) - Compact
    const renderBankDetails = () => {
      // Only render if bank details are enabled and available in print config
      if (printConfig?.bankDetails?.enabled && printConfig.bankDetails) {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9);
        doc.text('BANK DETAILS', 10, currentY);
        currentY += 12;

        const bankDetailsHeight = 40;
        doc.rect(10, currentY, doc.page.width - 20, bankDetailsHeight).fill(colors.background).stroke(colors.border);
        doc.fillColor(colors.text).font('Helvetica').fontSize(8);

        // Use 2-column layout for bank details like original system
        const leftColumnX = 15;
        const rightColumnX = (doc.page.width - 20) / 2 + 10;
        let leftY = currentY + 8;
        let rightY = currentY + 8;

        // Left column
        if (printConfig.bankDetails.bankName) {
          doc.text(`Bank: ${printConfig.bankDetails.bankName}`, leftColumnX, leftY);
          leftY += 12;
        }
        if (printConfig.bankDetails.accountNumber) {
          doc.text(`Account No: ${printConfig.bankDetails.accountNumber}`, leftColumnX, leftY);
        }

        // Right column
        if (printConfig.bankDetails.ifscCode) {
          doc.text(`IFSC Code: ${printConfig.bankDetails.ifscCode}`, rightColumnX, rightY);
          rightY += 12;
        }
        if (printConfig.bankDetails.branch) {
          doc.text(`Branch: ${printConfig.bankDetails.branch}`, rightColumnX, rightY);
        }

        currentY += bankDetailsHeight + 5;
      }
    };

    // Section K: Invoice Narration Section (conditional) - Compact
    const renderInvoiceNarration = () => {
      if (bill.narration && bill.narration.trim()) {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9);
        doc.text('INVOICE NARRATION', 10, currentY);
        currentY += 12;

        const narrationHeight = Math.max(25, doc.heightOfString(bill.narration, { width: doc.page.width - 30 }) + 15);
        doc.rect(10, currentY, doc.page.width - 20, narrationHeight).fill(colors.background).stroke(colors.border);
        doc.fillColor(colors.text).font('Helvetica').fontSize(8);
        doc.text(bill.narration, 15, currentY + 8, { width: doc.page.width - 30 });

        currentY += narrationHeight + 8;
      }
    };

    // Section L: Jurisdiction Section (from user preferences) - Compact
    const renderJurisdiction = () => {
      // Only render if jurisdiction is enabled and available in print config
      if (printConfig?.jurisdiction?.enabled) {
        doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(9);
        doc.text('JURISDICTION', 10, currentY);
        currentY += 12;

        const jurisdictionHeight = 20;
        doc.rect(10, currentY, doc.page.width - 20, jurisdictionHeight).fill(colors.background).stroke(colors.border);
        doc.fillColor(colors.text).font('Helvetica').fontSize(8);

        // Build jurisdiction text like original system
        let jurisdictionText = '';
        if (printConfig.jurisdiction.customText) {
          jurisdictionText = `Jurisdiction: ${printConfig.jurisdiction.customText}`;
        } else {
          const parts = [];
          if (printConfig.jurisdiction.state) parts.push(`State: ${printConfig.jurisdiction.state}`);
          if (printConfig.jurisdiction.district) parts.push(`District: ${printConfig.jurisdiction.district}`);
          if (printConfig.jurisdiction.court) parts.push(`Court: ${printConfig.jurisdiction.court}`);
          jurisdictionText = `Jurisdiction: ${parts.join(', ')}`;
        }

        if (jurisdictionText) {
          doc.text(jurisdictionText, 15, currentY + 8, { width: doc.page.width - 30 });
        }

        currentY += jurisdictionHeight + 5;
      }
    };

    // Section M: Signature Section - Compact
    const renderSignatureSection = () => {
      const signatureWidth = 150;
      const signatureX = doc.page.width - 10 - signatureWidth;

      doc.rect(signatureX, currentY, signatureWidth, 40).stroke(colors.border);
      doc.fillColor(colors.text).font('Helvetica').fontSize(8);
      doc.text('Authorized Signatory', signatureX + 8, currentY + 30);
      doc.text(`For ${firmName}`, signatureX + 8, currentY + 8);

      currentY += 45;
    };

    // Multi-page support function - Compact
    const addNewPageWithHeader = () => {
      doc.addPage();
      pageNumber++;
      currentY = 10;

      // Add sections a, b, c on new pages (no order/dispatch details on subsequent pages)
      renderFirmHeader();
      renderInvoiceTitle();
      renderInvoiceDetails();
      renderPartyDetails();
    };

    // Check if we need a new page before rendering sections - more compact
    const checkPageSpace = (requiredSpace: number) => {
      if (currentY + requiredSpace > doc.page.height - 20) {
        addNewPageWithHeader();
      }
    };

    // Render all sections with compact spacing
    renderFirmHeader();
    renderInvoiceTitle();
    renderInvoiceDetails();
    renderPartyDetails();

    // Check space before order/dispatch section
    checkPageSpace(60);
    renderOrderDispatchDetails();

    checkPageSpace(120);
    renderItemsTable();

    checkPageSpace(100);
    renderInvoiceTotals();

    checkPageSpace(60);
    renderHSNSummary();

    checkPageSpace(40);
    renderAmountInWords();

    checkPageSpace(50);
    renderBankDetails();

    checkPageSpace(40);
    renderInvoiceNarration();

    checkPageSpace(30);
    renderJurisdiction();

    checkPageSpace(50);
    renderSignatureSection();

    // Finalize the PDF
    doc.end();

    // Return the PDF buffer
    return await pdfPromise;

  } catch (error) {
    console.error('Error generating professional PDF:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate professional PDF'
    });
  }
});
