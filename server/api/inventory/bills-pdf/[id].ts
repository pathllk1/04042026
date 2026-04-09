// server/api/inventory/bills-pdf/[id].ts
import { defineEventHandler, createError, setHeader, getQuery, getHeader } from 'h3';
import PDFDocument from 'pdfkit';
import Bills from '../../../models/inventory/Bills';
import Firm from '../../../models/Firm';
import Party from '../../../models/inventory/Party';
import StockReg from '../../../models/inventory/StockReg';
import type { PrintConfig } from '../../../utils/pdf-templates';

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

    // Get print configuration from headers or query parameters
    let printConfig: PrintConfig | null = null;
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
    console.log('Bill data:', {
      billId: bill._id,
      partyId: bill.partyId,
      supply: bill.supply,
      state: bill.state
    });

    if (bill.partyId) {
      party = await Party.findById(bill.partyId);
      console.log('Party found by ID:', party ? {
        partyId: party._id,
        supply: party.supply,
        state: party.state
      } : 'No party found');
    } else {
      // Try to find party by supply name if partyId is not available
      party = await Party.findOne({ supply: bill.supply });
      console.log('Party found by supply name:', party ? {
        partyId: party._id,
        supply: party.supply,
        state: party.state
      } : 'No party found by supply name');
    }

    // Transform the populated data structure
    const stockItems: any[] = bill.stockRegIds || [];

    // Get party state from selected party for GST calculation
    // SIMPLE: Use saved GST selection from bill (no complex logic)
    let firmGSTNumber = firm.gstNo;
    let firmState = firm.state;
    let firmName = firm.name;
    let firmAddress = firm.address;
    let firmContactNo = firm.contactNo;
    let firmEmail = firm.email;
    let partyGSTNumber = bill.gstin;
    let partyState = bill.partyState || bill.state;

    // If bill has saved GST selection, use it directly
    if (bill.gstSelection) {
      console.log('📋 Using saved GST selection from bill:', bill.gstSelection);

      if (bill.gstSelection.firmGST) {
        firmGSTNumber = bill.gstSelection.firmGST.gstNumber || firmGSTNumber;
        firmState = bill.gstSelection.firmGST.state || firmState;

        // Use selected firm GST location details for header
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

    // Simple same state check
    const sameState = firmState?.toLowerCase() === partyState?.toLowerCase();

    console.log('🎯 PDF GST Data:', {
      firmGSTNumber,
      firmState,
      firmName,
      firmAddress,
      partyGSTNumber,
      partyState,
      sameState
    });

    // Set response headers
    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="invoice_${bill.bno}.pdf"`);

    // Create a new PDF document
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      bufferPages: true, // Enable page buffering for proper page numbering
      info: {
        Title: `Invoice ${bill.bno}`,
        Author: firmName,
        Subject: `${bill.btype} Invoice`,
        Keywords: 'invoice, bill, pdf',
        Creator: 'Invoice System'
      }
    });

    // Initialize page counter
    let pageNumber: number = 1;

    // Create a buffer to collect the PDF data
    const chunks: Buffer[] = [];

    // Set up event handlers to collect PDF data
    doc.on('data', (chunk) => chunks.push(chunk));

    // Create a promise that resolves when the PDF is complete
    const pdfPromise = new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Template system removed - using only your original PDF generation system

    // Define enhanced colors and styles
    const primaryColor = '#48bb78'; // Professional green
    const secondaryColor = '#4299e1'; // Professional blue
    const textColor = '#2d3748'; // Darker text for better readability
    const lightTextColor = '#4a5568'; // Light text for labels
    const backgroundColor = '#f7fafc'; // Lighter background
    const borderColor = '#e2e8f0'; // Light border color

    // Helper functions
    // Function to draw a rectangle
    const drawRect = (x: number, y: number, width: number, height: number, color: string): void => {
      doc.rect(x, y, width, height).fill(color);
    };

    // Function to get state code from state name
    const getStateCode = (stateName: string | null | undefined): string => {
      if (!stateName) return '';

      // Normalize the state name
      const normalizedStateName = stateName.toLowerCase().trim();

      // State code mapping
      const stateMap: Record<string, string> = {
        'andhra pradesh': '37',
        'arunachal pradesh': '12',
        'assam': '18',
        'bihar': '10',
        'chhattisgarh': '22',
        'goa': '30',
        'gujarat': '24',
        'haryana': '06',
        'himachal pradesh': '02',
        'jharkhand': '20',
        'karnataka': '29',
        'kerala': '32',
        'madhya pradesh': '23',
        'maharashtra': '27',
        'manipur': '14',
        'meghalaya': '17',
        'mizoram': '15',
        'nagaland': '13',
        'odisha': '21',
        'punjab': '03',
        'rajasthan': '08',
        'sikkim': '11',
        'tamil nadu': '33',
        'telangana': '36',
        'tripura': '16',
        'uttar pradesh': '09',
        'uttarakhand': '05',
        'west bengal': '19',
        'andaman and nicobar islands': '35',
        'chandigarh': '04',
        'dadra and nagar haveli and daman and diu': '26',
        'delhi': '07',
        'jammu and kashmir': '01',
        'ladakh': '38',
        'lakshadweep': '31',
        'puducherry': '34'
      };

      const stateCode = stateMap[normalizedStateName];
      if (stateCode) {
        return `(${stateCode})`;
      }

      return '';
    };

    // Function to format date in dd-MMM-yyyy format
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

    // Function to safely parse numbers and handle NaN
    const safeParseFloat = (value: any, defaultValue: number = 0): number => {
      if (value === null || value === undefined || value === '') return defaultValue;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Function to format currency with Indian number formatting
    const formatCurrency = (amount: any, showSymbol: boolean = false): string => {
      const safeAmount = safeParseFloat(amount, 0);
      const formattedNumber = safeAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return showSymbol ? `Rs.${formattedNumber}` : formattedNumber;
    };

    // Function to format address with proper line breaks
    const formatAddress = (address: string | null | undefined, doc: any, x: number, y: number, options: any = {}): number => {
      if (!address) return y;

      const { width = 200, fontSize = 8, lineGap = 3, maxLines = 4, align = 'left' } = options;

      // Set font size for accurate text measurement
      doc.fontSize(fontSize);

      // Split address by commas and clean up
      const parts = address.split(',').map(part => part.trim()).filter(part => part);

      // Group parts into lines using actual text width measurement
      const lines = [];
      let currentLine = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const testLine = currentLine ? `${currentLine}, ${part}` : part;

        // Use PDFKit's widthOfString to check actual text width
        const testLineWidth = doc.widthOfString(testLine);

        // Check if adding this part would make the line too wide
        if (testLineWidth > width && currentLine) {
          lines.push(currentLine);
          currentLine = part;
        } else {
          currentLine = testLine;
        }
      }

      // Add the last line
      if (currentLine) {
        lines.push(currentLine);
      }

      // Process each line to ensure it fits within width, breaking long lines if necessary
      const finalLines = [];
      for (const line of lines) {
        const lineWidth = doc.widthOfString(line);
        if (lineWidth <= width) {
          finalLines.push(line);
        } else {
          // Break long line into words and fit within width
          const words = line.split(' ');
          let currentWordLine = '';

          for (const word of words) {
            const testWordLine = currentWordLine ? `${currentWordLine} ${word}` : word;
            const testWordLineWidth = doc.widthOfString(testWordLine);

            if (testWordLineWidth <= width) {
              currentWordLine = testWordLine;
            } else {
              if (currentWordLine) {
                finalLines.push(currentWordLine);
                currentWordLine = word;
              } else {
                // Single word is too long, truncate it
                finalLines.push(word.substring(0, Math.floor(word.length * width / doc.widthOfString(word))));
              }
            }
          }

          if (currentWordLine) {
            finalLines.push(currentWordLine);
          }
        }
      }

      // Limit to maxLines
      const displayLines = finalLines.slice(0, maxLines);

      // Draw each line with proper width constraint and alignment
      let currentY = y;
      displayLines.forEach((line, index) => {
        // Use PDFKit's built-in text wrapping with width constraint and alignment
        doc.text(line, x, currentY, {
          width: width,
          align: align,
          lineBreak: false // Prevent automatic line breaks since we're handling them manually
        });
        currentY += fontSize + lineGap;
      });

      return currentY;
    };

    // Function to convert number to words (Indian currency format)
    const numberToWords = (num: any): string => {
      // Handle invalid numbers
      const safeNum = safeParseFloat(num, 0);
      if (safeNum === 0) return 'Zero';

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

      let rupees = Math.floor(safeNum);
      let paise = Math.round((safeNum - rupees) * 100);

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

    // Function to add a new page with header information
    const addNewPage = (): void => {
      doc.addPage();

      // Add header information on new page
      // Reset Y position for header
      let headerY = 30;

      // Add firm name and logo
      doc.font('Helvetica-Bold').fontSize(16);
      doc.fillColor(primaryColor).text(firmName.toUpperCase(), 30, headerY, { align: 'center', width: doc.page.width - 60 });

      // Add firm address with dynamic spacing
      doc.font('Helvetica').fontSize(9).fillColor(textColor);
      let firmAddressEndY = headerY + 25;
      if (firmAddress) {
        firmAddressEndY = formatAddress(firmAddress, doc, 30, headerY + 25, {
          align: 'center',
          width: doc.page.width - 60,
          fontSize: 9,
          lineGap: 2
        });
      }

      // Add contact information with proper spacing
      const contactInfo = `Phone: ${firmContactNo || 'N/A'} | Email: ${firmEmail || 'N/A'} | GSTIN: ${firmGSTNumber || 'N/A'}`;
      const contactY = firmAddressEndY + 10;
      doc.text(contactInfo, 30, contactY, { align: 'center', width: doc.page.width - 60 });

      // Add page number
      pageNumber++; // Increment page number for each new page
      doc.text(`Page ${pageNumber}`, doc.page.width - 60, headerY, { align: 'right' });

      // Add a separator line with dynamic positioning
      const separatorY = contactY + 15;
      doc.moveTo(30, separatorY).lineTo(doc.page.width - 30, separatorY).stroke();

      // Add invoice title with dynamic positioning
      doc.font('Helvetica-Bold').fontSize(12);
      const titleY = separatorY + 10;
      doc.text('TAX INVOICE', 30, titleY, { align: 'center', width: doc.page.width - 60 });

      // Add invoice details with dynamic positioning
      headerY = titleY + 20;

      // Create two columns for invoice details
      const colWidth = (doc.page.width - 60) / 2;

      // Left column - Invoice details
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Invoice No:', 30, headerY);
      doc.font('Helvetica').text(bill.bno || 'N/A', 90, headerY);

      doc.font('Helvetica-Bold');
      doc.text('Date:', 30, headerY + 15);
      doc.font('Helvetica').text(formatDate(bill.bdate), 90, headerY + 15);

      // Right column - Order details
      doc.font('Helvetica-Bold');
      doc.text('Order No:', 30 + colWidth, headerY);
      doc.font('Helvetica').text(bill.orderNo || 'N/A', 30 + colWidth + 60, headerY);

      doc.font('Helvetica-Bold');
      doc.text('Order Date:', 30 + colWidth, headerY + 15);
      doc.font('Helvetica').text(formatDate(bill.orderDate), 30 + colWidth + 60, headerY + 15);

      // Add a separator line
      doc.moveTo(30, headerY + 35).lineTo(doc.page.width - 30, headerY + 35).stroke();

      // Add party and consignee details
      headerY = headerY + 45;

      // Party details - left column
      doc.font('Helvetica-Bold').fontSize(9).text('Party:', 30, headerY);
      doc.font('Helvetica').fontSize(8).text(party ? party.supply : (bill.supply || 'N/A'), 80, headerY, { width: colWidth - 110 });

      // Add party address if available with proper formatting
      let addressY = headerY + 15; // Increased spacing from name to address
      let addressEndY = addressY;
      if (bill.addr) {
        addressEndY = formatAddress(bill.addr, doc, 80, addressY, { width: colWidth - 110, fontSize: 8, lineGap: 2 });
      } else if (party && party.addr) {
        addressEndY = formatAddress(party.addr, doc, 80, addressY, { width: colWidth - 110, fontSize: 8, lineGap: 2 });
      }

      // Add party state and GSTIN if available with dynamic spacing based on address height
      let partyDetailY = Math.max(addressEndY + 5, headerY + 45); // Dynamic spacing based on address height

      // Display state information
      const stateWithCode = partyState ? `${partyState} ${getStateCode(partyState)}` : 'N/A';
      doc.font('Helvetica-Bold').text('State:', 30, partyDetailY);
      doc.font('Helvetica').text(stateWithCode, 80, partyDetailY, { width: colWidth - 110 });

      // Display GSTIN information
      doc.font('Helvetica-Bold').text('GSTIN:', 30, partyDetailY + 10);
      doc.font('Helvetica').text(partyGSTNumber || 'N/A', 80, partyDetailY + 10, { width: colWidth - 110 });

      // Consignee details - right column
      doc.font('Helvetica-Bold').fontSize(9).text('Consignee:', 30 + colWidth, headerY);
      doc.font('Helvetica').fontSize(8).text(bill.consigneeName || (party ? party.supply : (bill.supply || 'N/A')), 30 + colWidth + 70, headerY, { width: colWidth - 100 });

      // Add consignee address if available with proper formatting
      let consigneeAddressY = headerY + 15; // Increased spacing from name to address
      let consigneeAddressEndY = consigneeAddressY;
      if (bill.consigneeAddress) {
        consigneeAddressEndY = formatAddress(bill.consigneeAddress, doc, 30 + colWidth + 70, consigneeAddressY, { width: colWidth - 100, fontSize: 8, lineGap: 2 });
      } else if (bill.addr) {
        consigneeAddressEndY = formatAddress(bill.addr, doc, 30 + colWidth + 70, consigneeAddressY, { width: colWidth - 100, fontSize: 8, lineGap: 2 });
      }

      // Add consignee state and GSTIN if available with dynamic spacing based on address height
      let consigneeDetailY = Math.max(consigneeAddressEndY + 5, headerY + 45); // Dynamic spacing based on address height
      const consigneeState = bill.consigneeState || (party ? party.state : bill.state);

      // Display state information
      const consigneeStateWithCode = consigneeState ? `${consigneeState} ${getStateCode(consigneeState)}` : 'N/A';
      doc.font('Helvetica-Bold').text('State:', 30 + colWidth, consigneeDetailY);
      doc.font('Helvetica').text(consigneeStateWithCode, 30 + colWidth + 70, consigneeDetailY, { width: colWidth - 100 });

      // Display GSTIN information
      doc.font('Helvetica-Bold').text('GSTIN:', 30 + colWidth, consigneeDetailY + 10);
      doc.font('Helvetica').text(bill.consigneeGstin || partyGSTNumber || 'N/A', 30 + colWidth + 70, consigneeDetailY + 10, { width: colWidth - 100 });

      // Add a separator line - account for dynamic address heights
      const maxDetailY = Math.max(partyDetailY + 20, consigneeDetailY + 20); // Added extra space for GSTIN
      doc.moveTo(30, maxDetailY).lineTo(doc.page.width - 30, maxDetailY).stroke();

      // Set Y position for content
      currentY = maxDetailY + 10;
    };

    // Start rendering the PDF
    // Set font and size
    doc.font('Helvetica');
    let currentY: number = 30; // Start position from top

    // Add page number to first page
    doc.fontSize(10).font('Helvetica');
    doc.text(`Page ${pageNumber}`, doc.page.width - 60, 30, { align: 'right' });

    // Add properly formatted firm header with better spacing
    doc.fontSize(20).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(firmName.toUpperCase(), 30, currentY, { align: 'center', width: doc.page.width - 60 });
    currentY += 30;

    // Add firm address with dynamic spacing based on content height
    doc.fontSize(9).font('Helvetica').fillColor(textColor);
    if (firmAddress) {
      const addressEndY = formatAddress(firmAddress, doc, 30, currentY, {
        align: 'center',
        width: doc.page.width - 60,
        fontSize: 9,
        lineGap: 2
      });
      currentY = addressEndY + 10; // Dynamic spacing based on actual address height
    }

    // Add contact information with proper spacing
    const contactInfo = `Phone: ${firmContactNo || 'N/A'} | Email: ${firmEmail || 'N/A'} | GSTIN: ${firmGSTNumber || 'N/A'}`;
    doc.fontSize(9).fillColor(textColor);
    doc.text(contactInfo, 30, currentY, { align: 'center', width: doc.page.width - 60 });
    currentY += 25;

    // Add enhanced invoice title with gradient-like effect
    doc.rect(30, currentY, doc.page.width - 60, 25).fill(primaryColor);
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold');
    doc.text(`${bill.btype} INVOICE`, 30, currentY + 7, { align: 'center', width: doc.page.width - 60 });
    currentY += 35; // More space after title
    doc.fillColor(textColor);

    // Add top declaration if configured
    if (printConfig?.declaration?.enabled && printConfig.declaration?.showOnInvoice && printConfig.declaration?.position === 'top') {
      doc.rect(30, currentY, doc.page.width - 60, 40).fill('#fff9c4'); // Light yellow background
      doc.fillColor(textColor).fontSize(10);
      doc.font('Helvetica-Bold').text('Declaration:', 35, currentY + 8);

      if (printConfig.declaration.text) {
        doc.font('Helvetica').fontSize(9).text(printConfig.declaration.text, 35, currentY + 22, { width: doc.page.width - 70 });
      }

      currentY += 50;
    }

    // Add enhanced invoice details section with better layout
    const colWidth = (doc.page.width - 60) / 2;

    // Create a subtle background for invoice details
    doc.rect(30, currentY, doc.page.width - 60, 25).fill(backgroundColor);
    doc.rect(30, currentY, doc.page.width - 60, 25).stroke(borderColor);

    // Left column - Invoice details with better spacing
    doc.font('Helvetica-Bold').fontSize(11).fillColor(lightTextColor);
    doc.text('Invoice No:', 40, currentY + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(textColor);
    doc.text(bill.bno, 110, currentY + 8);

    // Right column - Date with better alignment
    doc.font('Helvetica-Bold').fontSize(11).fillColor(lightTextColor);
    doc.text('Date:', 30 + colWidth + 10, currentY + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(textColor);
    doc.text(formatDate(bill.bdate), 30 + colWidth + 50, currentY + 8);

    currentY += 40; // More space before party details

    // Calculate dynamic height for party details section
    const partyColWidth = (doc.page.width - 60) / 3;
    const baseY = currentY + 28;
    let maxColumnHeight = 0;

    // Calculate height for Bill To column
    let billToHeight = 18; // Name row
    if (bill.addr) {
      const partyAddrHeight = doc.heightOfString(bill.addr, { width: partyColWidth - 100 });
      billToHeight += Math.max(18, partyAddrHeight + 8);
    }
    if (partyGSTNumber) billToHeight += 18;
    if (partyState) billToHeight += 18;
    maxColumnHeight = Math.max(maxColumnHeight, billToHeight);

    // Calculate height for Ship To column
    let shipToHeight = 18; // Name row
    const calcConsigneeAddr = bill.consigneeAddress || bill.addr;
    if (calcConsigneeAddr) {
      const calcConsigneeAddrHeight = doc.heightOfString(calcConsigneeAddr, { width: partyColWidth - 70 });
      shipToHeight += Math.max(18, calcConsigneeAddrHeight + 8);
    }
    const calcConsigneeGstin = bill.consigneeGstin || partyGSTNumber;
    if (calcConsigneeGstin) shipToHeight += 18;
    const calcConsigneeState = bill.consigneeState || partyState;
    if (calcConsigneeState) shipToHeight += 18;
    maxColumnHeight = Math.max(maxColumnHeight, shipToHeight);

    // Calculate height for Order & Dispatch column (5 rows: Order No, Order Date, Dispatch, Docket No, Vehicle No)
    // Since most fields are empty (showing dashes), use minimal height
    let calcDispatchHeight = 18 * 5; // 5 standard rows, all simple single-line content
    maxColumnHeight = Math.max(maxColumnHeight, calcDispatchHeight);

    // Add header space and minimal padding - keep it extremely tight to content
    const partyBoxHeight = maxColumnHeight + 15; // Just 15px for header space, no bottom padding

    // Draw the box with calculated height
    doc.rect(30, currentY, doc.page.width - 60, partyBoxHeight).fill(backgroundColor);
    doc.rect(30, currentY, doc.page.width - 60, partyBoxHeight).stroke(borderColor);

    // Enhanced Party details column with better typography
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Bill To', 40, currentY + 12);

    // Add column separator line
    doc.moveTo(30 + partyColWidth, currentY).lineTo(30 + partyColWidth, currentY + partyBoxHeight).stroke(borderColor);

    doc.fillColor(textColor).font('Helvetica').fontSize(9);

    let partyY = currentY + 28;
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Name:', 40, partyY);
    doc.font('Helvetica').fillColor(textColor).text(bill.supply, 75, partyY, { width: partyColWidth - 80 });
    partyY += 18;

    // Only show address if it exists
    if (bill.addr) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Address:', 40, partyY);
      const partyAddrHeight = doc.heightOfString(bill.addr, { width: partyColWidth - 100 });
      doc.font('Helvetica').fillColor(textColor).text(bill.addr, 95, partyY, { width: partyColWidth - 100 });
      partyY += Math.max(18, partyAddrHeight + 8);
    }

    // Only show GSTIN if it exists
    if (partyGSTNumber) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('GSTIN:', 40, partyY);
      doc.font('Helvetica').fillColor(textColor).text(partyGSTNumber, 75, partyY, { width: partyColWidth - 80 });
      partyY += 18;
    }

    // Only show state if it exists
    if (partyState) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('State:', 40, partyY);
      doc.font('Helvetica').fillColor(textColor).text(`${partyState} ${getStateCode(partyState)}`, 75, partyY, { width: partyColWidth - 80 });
    }

    // Consignee details column - always show (use party data as default)
    const consigneeX = 30 + partyColWidth;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Ship To', consigneeX + 10, currentY + 12);

    // Add column separator line
    doc.moveTo(consigneeX + partyColWidth, currentY).lineTo(consigneeX + partyColWidth, currentY + partyBoxHeight).stroke(borderColor);

    doc.fillColor(textColor).font('Helvetica').fontSize(9);

    let consigneeY = currentY + 28;
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Name:', consigneeX + 10, consigneeY);
    doc.font('Helvetica').fillColor(textColor).text(bill.consigneeName || bill.supply, consigneeX + 45, consigneeY, { width: partyColWidth - 50 });
    consigneeY += 18;

    // Show address (consignee or party address)
    const consigneeAddr = bill.consigneeAddress || bill.addr;
    if (consigneeAddr) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Address:', consigneeX + 10, consigneeY);
      const consigneeAddrHeight = doc.heightOfString(consigneeAddr, { width: partyColWidth - 70 });
      doc.font('Helvetica').fillColor(textColor).text(consigneeAddr, consigneeX + 65, consigneeY, { width: partyColWidth - 70 });
      consigneeY += Math.max(18, consigneeAddrHeight + 8);
    }

    // Show GSTIN (consignee or party GSTIN)
    const consigneeGstin = bill.consigneeGstin || partyGSTNumber;
    if (consigneeGstin) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('GSTIN:', consigneeX + 10, consigneeY);
      doc.font('Helvetica').fillColor(textColor).text(consigneeGstin, consigneeX + 45, consigneeY, { width: partyColWidth - 50 });
      consigneeY += 18;
    }

    // Show state (consignee or party state)
    const consigneeState = bill.consigneeState || partyState;
    if (consigneeState) {
      doc.font('Helvetica-Bold').fillColor(lightTextColor).text('State:', consigneeX + 10, consigneeY);
      doc.font('Helvetica').fillColor(textColor).text(`${consigneeState} ${getStateCode(consigneeState)}`, consigneeX + 45, consigneeY, { width: partyColWidth - 50 });
    }

    // Order & Dispatch details column - always show with available data
    const dispatchX = 30 + partyColWidth * 2;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Order & Dispatch', dispatchX + 10, currentY + 12);
    doc.fillColor(textColor).font('Helvetica').fontSize(9);

    let dispatchY = currentY + 28;

    // Show order number (or dash if empty)
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Order No:', dispatchX + 10, dispatchY);
    doc.font('Helvetica').fillColor(textColor).text(bill.orderNo || '-', dispatchX + 65, dispatchY, { width: partyColWidth - 70 });
    dispatchY += 18;

    // Show order date (or dash if empty)
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Order Date:', dispatchX + 10, dispatchY);
    doc.font('Helvetica').fillColor(textColor).text(bill.orderDate ? formatDate(bill.orderDate) : '-', dispatchX + 65, dispatchY, { width: partyColWidth - 70 });
    dispatchY += 18;

    // Show dispatch method (or dash if empty)
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Dispatch:', dispatchX + 10, dispatchY);
    const dispatchText = bill.dispatchThrough || '-';
    const dispatchHeight = doc.heightOfString(dispatchText, { width: partyColWidth - 70 });
    doc.font('Helvetica').fillColor(textColor).text(dispatchText, dispatchX + 65, dispatchY, { width: partyColWidth - 70 });
    dispatchY += Math.max(18, dispatchHeight + 8);

    // Show docket number (or dash if empty)
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Docket No:', dispatchX + 10, dispatchY);
    doc.font('Helvetica').fillColor(textColor).text(bill.docketNo || '-', dispatchX + 65, dispatchY, { width: partyColWidth - 70 });
    dispatchY += 18;

    // Show vehicle number (or dash if empty)
    doc.font('Helvetica-Bold').fillColor(lightTextColor).text('Vehicle No:', dispatchX + 10, dispatchY);
    doc.font('Helvetica').fillColor(textColor).text(bill.vehicleNo || '-', dispatchX + 65, dispatchY, { width: partyColWidth - 70 });

    // Move to next section with proper spacing
    currentY += partyBoxHeight + 25; // More space after party details

    // Add enhanced items table header
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13);
    doc.text('Items', 30, currentY);
    currentY += 25; // More space before table

    // Define enhanced table columns and widths with better proportions
    // Check which fields should be shown based on print configuration
    const inventoryFields = printConfig?.inventoryFields || {
      showHSN: true,
      showBatch: true,
      showMRP: true,
      showExpiryDate: true,
      showDiscount: true,
      showGSTRate: true,
      showCGST: true,
      showSGST: true,
      showIGST: true,
      showProject: true,
      showNarration: false
    };

    const tableWidth = doc.page.width - 60;

    // Calculate dynamic column widths based on visible fields
    // Build columns in the correct order: sl, item, hsn, qty, rate, disc, gst, amount
    let visibleColumns = ['sl', 'item']; // Always visible

    if (inventoryFields.showHSN) visibleColumns.push('hsn');

    visibleColumns.push('qty', 'rate'); // Always visible

    if (inventoryFields.showDiscount) visibleColumns.push('disc');
    if (inventoryFields.showGSTRate) visibleColumns.push('gst');

    visibleColumns.push('amount'); // Always at the end

    // Calculate proportional widths
    const baseWidths = {
      sl: 0.05,      // 5% for serial number
      item: 0.30,    // 30% for item name
      hsn: 0.12,     // 12% for HSN code (increased from 8%)
      qty: 0.10,     // 10% for quantity with unit
      rate: 0.12,    // 12% for rate
      disc: 0.10,    // 10% for discount
      gst: 0.08,     // 8% for GST rate
      amount: 0.13   // 13% for amount (decreased from 17%)
    };

    // Adjust widths based on visible columns
    const totalBaseWidth = visibleColumns.reduce((sum, col) => sum + baseWidths[col], 0);
    const colWidths = {};
    visibleColumns.forEach(col => {
      colWidths[col] = tableWidth * (baseWidths[col] / totalBaseWidth);
    });

    // Calculate column positions for visible columns only
    const colPositions = {};
    let runningX = 30;
    visibleColumns.forEach(col => {
      colPositions[col] = runningX;
      runningX += colWidths[col];
    });

    // Draw enhanced table header with better styling
    const headerHeight = 28; // Taller header for better appearance

    // Draw outer table border
    doc.rect(30, currentY, tableWidth, headerHeight).stroke(borderColor);

    // Draw table header with gradient-like fill
    doc.rect(30, currentY, tableWidth, headerHeight).fill(primaryColor);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold'); // Larger, bold font

    // Draw column headers dynamically based on visible columns
    const headerLabels = {
      sl: 'Sl',
      item: 'Item Description',
      hsn: 'HSN',
      qty: 'Qty',
      rate: 'Rate',
      disc: 'Disc Amt',
      gst: 'GST%',
      amount: 'Amount'
    };

    visibleColumns.forEach((col, index) => {
      const isLastColumn = index === visibleColumns.length - 1;
      const align = (col === 'sl' || col === 'hsn' || col === 'qty' || col === 'rate' || col === 'disc' || col === 'gst' || col === 'amount') ? 'center' : 'left';

      doc.text(headerLabels[col], colPositions[col] + 3, currentY + 10, {
        width: colWidths[col] - 6,
        align: align
      });

      // Draw column separator (except for last column)
      if (!isLastColumn) {
        doc.moveTo(colPositions[col] + colWidths[col], currentY)
           .lineTo(colPositions[col] + colWidths[col], currentY + headerHeight)
           .stroke('white');
      }
    });

    // Draw enhanced table rows for each item
    let rowY = currentY + headerHeight; // Start after header
    let evenRow = false;

    // Process each stock item
    stockItems.forEach((item, index) => {
      // Check if we need to add a new page
      if (rowY + 20 > doc.page.height - 50) {
        addNewPage();
        rowY = currentY; // Use the currentY set by addNewPage
      }

      // Calculate discount amount with safe parsing
      const itemRate = safeParseFloat(item.rate, 0);
      const itemQty = safeParseFloat(item.qty, 0);
      const itemDisc = safeParseFloat(item.disc, 0);

      const discountAmount = safeParseFloat(((itemRate * itemQty) * itemDisc / 100).toFixed(2));
      const taxableAmount = safeParseFloat((itemRate * itemQty - discountAmount).toFixed(2));

      // Determine which GST values to show based on state with safe parsing
      const cgstValue = sameState ? safeParseFloat(item.cgst, 0) : 0;
      const sgstValue = sameState ? safeParseFloat(item.sgst, 0) : 0;
      const igstValue = !sameState ? safeParseFloat(item.igst, 0) : 0;

      // Item name with optional narration
      const itemText = item.item + (item.item_narration ? `\n${item.item_narration}` : '');

      // Calculate the height of the item text to adjust row height
      doc.fontSize(9); // Slightly larger font for better readability
      const itemTextHeight = doc.heightOfString(itemText, { width: colWidths.item - 8 });
      const rowHeight = Math.max(35, itemTextHeight + 18); // More padding for better appearance

      // Draw enhanced alternating row background
      doc.rect(30, rowY, tableWidth, rowHeight).fill(evenRow ? backgroundColor : 'white');
      evenRow = !evenRow;

      // Draw row border with lighter color
      doc.rect(30, rowY, tableWidth, rowHeight).stroke(borderColor);

      // Draw column dividers with lighter color for visible columns only
      visibleColumns.forEach((col, i) => {
        if (i > 0) { // Skip first column
          const xPosition = colPositions[col];
          doc.moveTo(xPosition, rowY).lineTo(xPosition, rowY + rowHeight).stroke(borderColor);
        }
      });

      // Draw enhanced row content with better typography
      doc.fillColor(textColor);

      // Generate content for each visible column
      visibleColumns.forEach(col => {
        const centerY = rowY + (rowHeight / 2) - 5;

        switch (col) {
          case 'sl':
            // Serial number - centered vertically with better styling
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text((index + 1).toString(), colPositions.sl + 3, centerY, { width: colWidths.sl - 6, align: 'center' });
            break;

          case 'item':
            // Item name with optional narration - better formatting
            const itemY = rowY + 8; // More padding from top
            doc.fontSize(9).font('Helvetica-Bold').fillColor(textColor);

            // Split item text into main item and narration
            if (inventoryFields.showNarration && item.item_narration) {
              doc.text(item.item, colPositions.item + 4, itemY, { width: colWidths.item - 8 });
              doc.fontSize(8).font('Helvetica').fillColor(lightTextColor);
              doc.text(item.item_narration, colPositions.item + 4, itemY + 12, { width: colWidths.item - 8 });
            } else {
              doc.text(item.item, colPositions.item + 4, itemY, { width: colWidths.item - 8 });
            }
            break;

          case 'hsn':
            // HSN code - centered vertically with better styling
            doc.fontSize(9).font('Helvetica').fillColor(textColor);
            doc.text(item.hsn && item.hsn.trim() !== '' ? item.hsn : '-', colPositions.hsn + 3, centerY, { width: colWidths.hsn - 6, align: 'center' });
            break;

          case 'qty':
            // Quantity - centered vertically with better formatting
            doc.fontSize(9).font('Helvetica').fillColor(textColor);
            doc.text(`${safeParseFloat(item.qty, 0)} ${item.uom || ''}`, colPositions.qty + 3, centerY, { align: 'center', width: colWidths.qty - 6 });
            break;

          case 'rate':
            // Rate - centered vertically with proper formatting
            doc.text(formatCurrency(itemRate), colPositions.rate + 3, centerY, { align: 'right', width: colWidths.rate - 8 });
            break;

          case 'disc':
            // Discount amount - centered vertically, show dash if zero
            doc.text(discountAmount > 0 ? formatCurrency(discountAmount) : '-', colPositions.disc + 3, centerY, { align: 'right', width: colWidths.disc - 8 });
            break;

          case 'gst':
            // GST rate - centered vertically
            doc.text(`${safeParseFloat(item.grate, 0)}%`, colPositions.gst + 3, centerY, { align: 'center', width: colWidths.gst - 6 });
            break;

          case 'amount':
            // Amount - centered vertically with bold formatting
            doc.font('Helvetica-Bold').fillColor(textColor);
            doc.text(formatCurrency(taxableAmount), colPositions.amount + 3, centerY, { align: 'right', width: colWidths.amount - 8 });
            break;
        }
      });

      // Increment row position by the calculated row height
      rowY += rowHeight;
    });

    // Add other charges if any
    if (bill.oth_chg && bill.oth_chg.length > 0) {
      bill.oth_chg.forEach((charge, index) => {
        // Check if we need to add a new page
        if (rowY + 20 > doc.page.height - 50) {
          addNewPage();
          rowY = currentY; // Use the currentY set by addNewPage
        }

        // Determine which GST values to show based on state with safe parsing
        const cgstValue = sameState ? safeParseFloat(charge.oth_cgst, 0) : 0;
        const sgstValue = sameState ? safeParseFloat(charge.oth_sgst, 0) : 0;
        const igstValue = !sameState ? safeParseFloat(charge.oth_igst, 0) : 0;

        // Calculate effective GST rate with safe parsing
        let gstRate = safeParseFloat(charge.oth_grate, 0);

        // If oth_grate is not available, calculate it from the tax values
        const chargeAmount = safeParseFloat(charge.oth_amt, 0);
        if (!gstRate && chargeAmount > 0) {
          if (sameState) {
            gstRate = (cgstValue + sgstValue) / chargeAmount * 100;
          } else {
            gstRate = igstValue / chargeAmount * 100;
          }
        }

        // Get description text and calculate row height
        const descText = charge.description || 'Other Charge';
        doc.fontSize(8);
        const descTextHeight = doc.heightOfString(descText, { width: colWidths.item - 6 });
        const rowHeight = Math.max(25, descTextHeight + 10);

        // Draw alternating row background
        doc.rect(30, rowY, tableWidth, rowHeight).fill(evenRow ? backgroundColor : 'white');
        evenRow = !evenRow;

        // Draw row border
        doc.rect(30, rowY, tableWidth, rowHeight).stroke();

        // Draw column dividers for visible columns only
        visibleColumns.forEach((col, i) => {
          if (i > 0) { // Skip first column
            const xPosition = colPositions[col];
            doc.moveTo(xPosition, rowY).lineTo(xPosition, rowY + rowHeight).stroke();
          }
        });

        // Draw row content for visible columns only
        doc.fillColor(textColor);

        // Calculate vertical center position
        const vertCenter = rowY + (rowHeight / 2) - 4;

        // Generate content for each visible column
        visibleColumns.forEach(col => {
          switch (col) {
            case 'sl':
              // Serial number - centered vertically
              doc.fontSize(8);
              doc.text((stockItems.length + index + 1).toString(), colPositions.sl + 3, vertCenter, { width: colWidths.sl - 6, align: 'center' });
              break;

            case 'item':
              // Description - align to top with padding
              doc.text(descText, colPositions.item + 3, rowY + 5, { width: colWidths.item - 6 });
              break;

            case 'hsn':
              // HSN code - centered vertically
              doc.text(charge.oth_hsn && charge.oth_hsn.trim() !== '' ? charge.oth_hsn : 'No HSN', colPositions.hsn + 3, vertCenter, { width: colWidths.hsn - 6, align: 'center' });
              break;

            case 'qty':
              // Quantity (empty for charges) - centered vertically
              doc.text('', colPositions.qty + 3, vertCenter, { align: 'right', width: colWidths.qty - 6 });
              break;

            case 'rate':
              // Rate/Amount - centered vertically
              doc.text(formatCurrency(chargeAmount), colPositions.rate + 3, vertCenter, { align: 'right', width: colWidths.rate - 10 });
              break;

            case 'disc':
              // Discount (always 0 for charges) - centered vertically
              doc.text(formatCurrency(0), colPositions.disc + 3, vertCenter, { align: 'right', width: colWidths.disc - 10 });
              break;

            case 'gst':
              // GST rate - centered vertically
              doc.text(`${safeParseFloat(gstRate, 0).toFixed(2)}%`, colPositions.gst + 3, vertCenter, { align: 'right', width: colWidths.gst - 8 });
              break;

            case 'amount':
              // Amount - centered vertically
              doc.text(formatCurrency(chargeAmount), colPositions.amount + 3, vertCenter, { align: 'right', width: colWidths.amount - 10 });
              break;
          }
        });

        // Increment row position by the calculated row height
        rowY += rowHeight;
      });
    }

    // Update the current Y position
    currentY = rowY + 10;

    // Add totals section
    const totalsWidth = 250;
    const totalsX = doc.page.width - 30 - totalsWidth;

    // Check if we need a new page for totals
    if (currentY + 100 > doc.page.height - 50) {
      doc.addPage();
      currentY = 50;
    }

    // Draw totals table with a border
    doc.rect(totalsX, currentY, totalsWidth, 120).stroke(); // Create a border around the totals section

    // Add a header row with background
    doc.rect(totalsX, currentY, totalsWidth, 20).fill(primaryColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
    doc.text('INVOICE SUMMARY', totalsX + 10, currentY + 6);
    doc.fillColor(textColor);

    currentY += 25; // Move to first row

    // Gross Total row
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Gross Total (Rs.):', totalsX + 10, currentY);
    doc.font('Helvetica').text(formatCurrency(safeParseFloat(bill.gtot, 0)), totalsX + totalsWidth - 110, currentY, { align: 'right', width: 100 });

    currentY += 15;

    // Show CGST/SGST or IGST based on state
    if (sameState) {
      // Same state - show CGST and SGST
      doc.font('Helvetica-Bold').text('CGST (Rs.):', totalsX + 10, currentY);
      doc.font('Helvetica').text(formatCurrency(safeParseFloat(bill.cgst, 0)), totalsX + totalsWidth - 110, currentY, { align: 'right', width: 100 });
      currentY += 15;

      doc.font('Helvetica-Bold').text('SGST (Rs.):', totalsX + 10, currentY);
      doc.font('Helvetica').text(formatCurrency(safeParseFloat(bill.sgst, 0)), totalsX + totalsWidth - 110, currentY, { align: 'right', width: 100 });
      currentY += 15;
    } else {
      // Different state - show IGST
      doc.font('Helvetica-Bold').text('IGST (Rs.):', totalsX + 10, currentY);
      doc.font('Helvetica').text(formatCurrency(safeParseFloat(bill.igst, 0)), totalsX + totalsWidth - 110, currentY, { align: 'right', width: 100 });
      currentY += 15;
    }

    // Round off
    doc.font('Helvetica-Bold').text('Round Off (Rs.):', totalsX + 10, currentY);
    doc.font('Helvetica').text(formatCurrency(safeParseFloat(bill.rof, 0)), totalsX + totalsWidth - 110, currentY, { align: 'right', width: 100 });
    currentY += 15;

    // Net total with background - this is the main total, so show Rs. symbol
    doc.rect(totalsX, currentY, totalsWidth, 25).fill(primaryColor);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10).text('Net Total (Rs.):', totalsX + 10, currentY + 7);
    doc.text(formatCurrency(safeParseFloat(bill.ntot, 0), true), totalsX + totalsWidth - 110, currentY + 7, { align: 'right', width: 100 });
    doc.fillColor(textColor);

    // Update Y position
    currentY += 30;

    // Add HSN summary table
    // Create a map to group items by HSN code
    const hsnSummary = new Map();

    // Process stock items
    stockItems.forEach(item => {
      const hsn = item.hsn || 'No HSN';
      const itemRate = safeParseFloat(item.rate, 0);
      const itemQty = safeParseFloat(item.qty, 0);
      const itemDisc = safeParseFloat(item.disc, 0);
      const taxableAmount = safeParseFloat(((itemRate * itemQty) * (1 - itemDisc / 100)).toFixed(2));
      const gstRate = safeParseFloat(item.grate, 0);

      if (!hsnSummary.has(hsn)) {
        hsnSummary.set(hsn, {
          taxableAmount,
          gstRate,
          cgst: sameState ? (taxableAmount * gstRate / 200) : 0, // Half of GST if same state
          sgst: sameState ? (taxableAmount * gstRate / 200) : 0, // Half of GST if same state
          igst: !sameState ? (taxableAmount * gstRate / 100) : 0, // Full GST if different state
          count: 1
        });
      } else {
        const existing = hsnSummary.get(hsn);
        existing.taxableAmount += taxableAmount;
        existing.cgst += sameState ? (taxableAmount * gstRate / 200) : 0;
        existing.sgst += sameState ? (taxableAmount * gstRate / 200) : 0;
        existing.igst += !sameState ? (taxableAmount * gstRate / 100) : 0;
        existing.count += 1;
      }
    });

    // Process other charges
    if (bill.oth_chg && bill.oth_chg.length > 0) {
      bill.oth_chg.forEach(charge => {
        const hsn = charge.oth_hsn || 'No HSN';
        const taxableAmount = safeParseFloat(charge.oth_amt, 0);

        // Get GST rate from charge or calculate it with safe parsing
        let gstRate = safeParseFloat(charge.oth_grate, 0);

        // If oth_grate is not available, calculate it from the tax values
        if (!gstRate && taxableAmount > 0) {
          if (sameState) {
            gstRate = (safeParseFloat(charge.oth_cgst, 0) + safeParseFloat(charge.oth_sgst, 0)) / taxableAmount * 100;
          } else {
            gstRate = safeParseFloat(charge.oth_igst, 0) / taxableAmount * 100;
          }
        }

        if (!hsnSummary.has(hsn)) {
          hsnSummary.set(hsn, {
            taxableAmount,
            gstRate,
            cgst: sameState ? safeParseFloat(charge.oth_cgst, 0) : 0,
            sgst: sameState ? safeParseFloat(charge.oth_sgst, 0) : 0,
            igst: !sameState ? safeParseFloat(charge.oth_igst, 0) : 0,
            count: 1
          });
        } else {
          const existing = hsnSummary.get(hsn);
          existing.taxableAmount += taxableAmount;
          existing.cgst += sameState ? safeParseFloat(charge.oth_cgst, 0) : 0;
          existing.sgst += sameState ? safeParseFloat(charge.oth_sgst, 0) : 0;
          existing.igst += !sameState ? safeParseFloat(charge.oth_igst, 0) : 0;
          existing.count += 1;
        }
      });
    }

    // Check if we need a new page for HSN summary
    if (currentY + 150 > doc.page.height - 50) {
      addNewPage();
      // currentY is already set by addNewPage
    }

    // Draw HSN summary table header
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
    doc.text('HSN Summary', 30, currentY);
    currentY += 20;

    // Define HSN table columns and widths based on state comparison
    const hsnTableWidth = doc.page.width - 60;
    let hsnColWidths;

    if (sameState) {
      // Same state - show CGST and SGST columns
      hsnColWidths = {
        hsn: hsnTableWidth * 0.15,      // 15% for HSN code
        taxable: hsnTableWidth * 0.25,   // 25% for taxable amount
        rate: hsnTableWidth * 0.1,      // 10% for rate
        cgst: hsnTableWidth * 0.15,     // 15% for CGST
        sgst: hsnTableWidth * 0.15,     // 15% for SGST
        total: hsnTableWidth * 0.2      // 20% for total
      };
    } else {
      // Different state - show only IGST column
      hsnColWidths = {
        hsn: hsnTableWidth * 0.15,      // 15% for HSN code
        taxable: hsnTableWidth * 0.25,   // 25% for taxable amount
        rate: hsnTableWidth * 0.1,      // 10% for rate
        igst: hsnTableWidth * 0.3,      // 30% for IGST
        total: hsnTableWidth * 0.2      // 20% for total
      };
    }

    // Calculate column positions
    const hsnColPositions = {};
    let hsnRunningX = 30;
    Object.keys(hsnColWidths).forEach(col => {
      hsnColPositions[col] = hsnRunningX;
      hsnRunningX += hsnColWidths[col];
    });

    // Draw HSN table header
    doc.rect(30, currentY, hsnTableWidth, 25).fill(primaryColor);
    doc.fillColor('white').fontSize(9);

    // Draw column headers
    doc.text('HSN', hsnColPositions.hsn + 3, currentY + 9, { width: hsnColWidths.hsn - 6 });
    doc.moveTo(hsnColPositions.hsn + hsnColWidths.hsn, currentY).lineTo(hsnColPositions.hsn + hsnColWidths.hsn, currentY + 25).stroke();

    doc.text('Taxable Amount (Rs.)', hsnColPositions.taxable + 3, currentY + 9, { align: 'right', width: hsnColWidths.taxable - 6 });
    doc.moveTo(hsnColPositions.taxable + hsnColWidths.taxable, currentY).lineTo(hsnColPositions.taxable + hsnColWidths.taxable, currentY + 25).stroke();

    doc.text('Rate', hsnColPositions.rate + 3, currentY + 9, { align: 'right', width: hsnColWidths.rate - 6 });
    doc.moveTo(hsnColPositions.rate + hsnColWidths.rate, currentY).lineTo(hsnColPositions.rate + hsnColWidths.rate, currentY + 25).stroke();

    if (sameState) {
      // Same state - show CGST and SGST columns
      doc.text('CGST (Rs.)', hsnColPositions.cgst + 3, currentY + 9, { align: 'right', width: hsnColWidths.cgst - 6 });
      doc.moveTo(hsnColPositions.cgst + hsnColWidths.cgst, currentY).lineTo(hsnColPositions.cgst + hsnColWidths.cgst, currentY + 25).stroke();

      doc.text('SGST (Rs.)', hsnColPositions.sgst + 3, currentY + 9, { align: 'right', width: hsnColWidths.sgst - 6 });
      doc.moveTo(hsnColPositions.sgst + hsnColWidths.sgst, currentY).lineTo(hsnColPositions.sgst + hsnColWidths.sgst, currentY + 25).stroke();
    } else {
      // Different state - show only IGST column
      doc.text('IGST (Rs.)', hsnColPositions.igst + 3, currentY + 9, { align: 'right', width: hsnColWidths.igst - 6 });
      doc.moveTo(hsnColPositions.igst + hsnColWidths.igst, currentY).lineTo(hsnColPositions.igst + hsnColWidths.igst, currentY + 25).stroke();
    }

    doc.text('Total (Rs.)', hsnColPositions.total + 3, currentY + 9, { align: 'right', width: hsnColWidths.total - 6 });

    // Start drawing rows
    let hsnRowY = currentY + 25;
    let hsnEvenRow = true;

    // Draw HSN summary rows
    let totalTaxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    hsnSummary.forEach((data, hsn) => {
      // Check if we need a new page
      if (hsnRowY + 20 > doc.page.height - 50) {
        addNewPage();
        hsnRowY = currentY; // Use the currentY set by addNewPage
      }

      // Draw alternating row background
      doc.rect(30, hsnRowY, hsnTableWidth, 20).fill(hsnEvenRow ? backgroundColor : 'white');
      hsnEvenRow = !hsnEvenRow;

      // Draw row border
      doc.rect(30, hsnRowY, hsnTableWidth, 20).stroke();

      // Draw column dividers
      Object.keys(hsnColWidths).forEach((col, i) => {
        if (i > 0) { // Skip first column
          const xPosition = hsnColPositions[col];
          doc.moveTo(xPosition, hsnRowY).lineTo(xPosition, hsnRowY + 20).stroke();
        }
      });

      // Draw row content
      doc.fillColor(textColor).fontSize(8);

      // HSN code
      doc.text(hsn, hsnColPositions.hsn + 3, hsnRowY + 6, { width: hsnColWidths.hsn - 6 });

      // Taxable amount
      doc.text(formatCurrency(data.taxableAmount), hsnColPositions.taxable + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.taxable - 10 });

      // GST rate
      doc.text(`${safeParseFloat(data.gstRate, 0).toFixed(2)}%`, hsnColPositions.rate + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.rate - 8 });

      // Apply state logic for GST columns
      if (sameState) {
        // CGST amount - show when same state
        doc.text(formatCurrency(data.cgst), hsnColPositions.cgst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.cgst - 10 });

        // SGST amount - show when same state
        doc.text(formatCurrency(data.sgst), hsnColPositions.sgst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.sgst - 10 });
      } else {
        // IGST amount - show when different state
        doc.text(formatCurrency(data.igst), hsnColPositions.igst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.igst - 10 });
      }

      // Total tax amount
      const totalTax = data.cgst + data.sgst + data.igst;
      doc.text(formatCurrency(totalTax), hsnColPositions.total + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.total - 10 });

      // Update totals
      totalTaxableAmount += data.taxableAmount;
      totalCGST += data.cgst;
      totalSGST += data.sgst;
      totalIGST += data.igst;

      // Increment row position
      hsnRowY += 20;
    });

    // Draw total row
    doc.rect(30, hsnRowY, hsnTableWidth, 20).fill(primaryColor);
    doc.rect(30, hsnRowY, hsnTableWidth, 20).stroke();

    // Draw column dividers for total row
    Object.keys(hsnColWidths).forEach((col, i) => {
      if (i > 0) { // Skip first column
        const xPosition = hsnColPositions[col];
        doc.moveTo(xPosition, hsnRowY).lineTo(xPosition, hsnRowY + 20).stroke();
      }
    });

    // Draw total row content
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');

    // Total label
    doc.text('Total', hsnColPositions.hsn + 3, hsnRowY + 6, { width: hsnColWidths.hsn - 6 });

    // Total taxable amount
    doc.text(formatCurrency(totalTaxableAmount), hsnColPositions.taxable + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.taxable - 10 });

    // Empty rate cell
    doc.text('', hsnColPositions.rate + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.rate - 8 });

    // Apply state logic for totals row
    if (sameState) {
      // Total CGST - show when same state
      doc.text(formatCurrency(totalCGST), hsnColPositions.cgst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.cgst - 10 });

      // Total SGST - show when same state
      doc.text(formatCurrency(totalSGST), hsnColPositions.sgst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.sgst - 10 });
    } else {
      // Total IGST - show when different state
      doc.text(formatCurrency(totalIGST), hsnColPositions.igst + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.igst - 10 });
    }

    // Total tax amount
    const grandTotalTax = totalCGST + totalSGST + totalIGST;
    doc.text(formatCurrency(grandTotalTax), hsnColPositions.total + 3, hsnRowY + 6, { align: 'right', width: hsnColWidths.total - 10 });

    // Update current Y position
    currentY = hsnRowY + 30;

    // Add amount in words section for both net total and tax amount
    const netTotalInWords = numberToWords(safeParseFloat(bill.ntot, 0));

    // Calculate total tax amount
    const totalTaxAmount = totalCGST + totalSGST + totalIGST;
    const taxAmountInWords = numberToWords(totalTaxAmount);

    // Check if we need a new page
    if (currentY + 120 > doc.page.height - 50) {
      addNewPage();
      // currentY is already set by addNewPage
    }

    // Draw combined amount in words box (both net total and tax amount)
    doc.rect(30, currentY, doc.page.width - 60, 50).fill(backgroundColor);
    doc.fillColor(textColor).fontSize(9);

    // Net amount in words (first row)
    doc.font('Helvetica-Bold').text('Amount in Words:', 35, currentY + 10);
    doc.font('Helvetica').text(netTotalInWords, 150, currentY + 10, { width: doc.page.width - 180 });

    // Tax amount in words (second row)
    doc.font('Helvetica-Bold').text('Tax Amount in Words:', 35, currentY + 28);
    doc.font('Helvetica').text(taxAmountInWords, 150, currentY + 28, { width: doc.page.width - 180 });

    currentY += 40; // Reduced spacing between sections

    // Add print configuration sections if available
    if (printConfig) {
      // Add Bank Details
      if (printConfig.bankDetails?.enabled && printConfig.bankDetails?.showOnInvoice) {
        // Check if we need a new page
        if (currentY + 80 > doc.page.height - 50) {
          addNewPage();
        }

        doc.rect(30, currentY, doc.page.width - 60, 45).fill(backgroundColor);
        doc.fillColor(textColor).fontSize(10);
        doc.font('Helvetica-Bold').text('Bank Details:', 35, currentY + 10);

        // Use 2-column layout for bank details
        const leftColumnX = 35;
        const rightColumnX = (doc.page.width - 60) / 2 + 30;
        let leftY = currentY + 25;
        let rightY = currentY + 25;

        // Left column
        if (printConfig.bankDetails.bankName) {
          doc.font('Helvetica').fontSize(9).text(`Bank: ${printConfig.bankDetails.bankName}`, leftColumnX, leftY);
          leftY += 12;
        }
        if (printConfig.bankDetails.accountNumber) {
          doc.font('Helvetica').fontSize(9).text(`Account No: ${printConfig.bankDetails.accountNumber}`, leftColumnX, leftY);
        }

        // Right column
        if (printConfig.bankDetails.ifscCode) {
          doc.font('Helvetica').fontSize(9).text(`IFSC Code: ${printConfig.bankDetails.ifscCode}`, rightColumnX, rightY);
          rightY += 12;
        }
        if (printConfig.bankDetails.branch) {
          doc.font('Helvetica').fontSize(9).text(`Branch: ${printConfig.bankDetails.branch}`, rightColumnX, rightY);
        }

        currentY += 55;
      }

      // Add Jurisdiction
      if (printConfig.jurisdiction?.enabled) {
        // Check if we need a new page
        if (currentY + 60 > doc.page.height - 50) {
          addNewPage();
        }

        doc.rect(30, currentY, doc.page.width - 60, 30).fill(backgroundColor);
        doc.fillColor(textColor).fontSize(10);

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
          doc.font('Helvetica-Bold').text(jurisdictionText, 35, currentY + 10, { width: doc.page.width - 70 });
        }

        currentY += 40;
      }

      // Add Declaration
      if (printConfig.declaration?.enabled && printConfig.declaration?.showOnInvoice && printConfig.declaration?.position === 'bottom') {
        // Check if we need a new page
        if (currentY + 60 > doc.page.height - 50) {
          addNewPage();
        }

        doc.rect(30, currentY, doc.page.width - 60, 50).fill(backgroundColor);
        doc.fillColor(textColor).fontSize(10);
        doc.font('Helvetica-Bold').text('Declaration:', 35, currentY + 10);

        if (printConfig.declaration.text) {
          doc.font('Helvetica').fontSize(9).text(printConfig.declaration.text, 35, currentY + 25, { width: doc.page.width - 70 });
        }

        currentY += 60;
      }
    }

    // Add Invoice Narration if available
    if (bill.narration && bill.narration.trim()) {
      // Check if we need a new page
      if (currentY + 60 > doc.page.height - 50) {
        addNewPage();
      }

      doc.rect(30, currentY, doc.page.width - 60, 50).fill('#f8f9fa'); // Light gray background
      doc.fillColor(textColor).fontSize(10);
      doc.font('Helvetica-Bold').text('Invoice Notes:', 35, currentY + 10);

      doc.font('Helvetica').fontSize(9).text(bill.narration.trim(), 35, currentY + 25, {
        width: doc.page.width - 70,
        lineGap: 2
      });

      currentY += 60;
    }

    // Add signature section
    const signatureWidth = (doc.page.width - 60) / 2;

    // Customer signature
    doc.fontSize(9);
    doc.text('Customer\'s Signature', 30, currentY + 30, { width: signatureWidth - 10 });
    doc.fontSize(8).text('Received the above goods in good condition.', 30, currentY + 45, { width: signatureWidth - 10 });

    // Company signature
    doc.fontSize(9);
    doc.text(`For ${firmName}`, 30 + signatureWidth, currentY + 30, { width: signatureWidth - 10, align: 'right' });
    doc.fontSize(8).text('Authorized Signatory', 30 + signatureWidth, currentY + 45, { width: signatureWidth - 10, align: 'right' });

    // Add page numbers to all pages
    const totalPageCount = doc.bufferedPageRange().count;

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
      statusMessage: `Error generating bill PDF: ${error.message || 'Unknown error'}`
    });
  }
});
