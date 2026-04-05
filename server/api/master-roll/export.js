/**
 * API endpoint for exporting master roll data with filters
 * Supports Excel, CSV, and PDF formats
 */
import { defineEventHandler, readBody, createError, setResponseHeaders } from 'h3';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { MasterRoll } from '../../models/MasterRoll';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const userId = event.context.userId;
    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get request body
    const body = await readBody(event);
    const {
      format = 'excel',
      filters = {},
      selectedColumns = [],
      respectCurrentFilters = true,
      includeSummary = true,
      currentFilters = {},
      searchTerm = ''
    } = body;

    // Validate format
    if (!['excel', 'csv', 'pdf'].includes(format)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid export format. Supported formats: excel, csv, pdf'
      });
    }

    // Validate selected columns
    if (!selectedColumns || selectedColumns.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'At least one column must be selected for export'
      });
    }

    // Get firmId from context
    const firmId = event.context.user?.firmId;
    if (!firmId) {
      throw createError({
        statusCode: 401,
        message: 'Firm ID not found'
      });
    }

    // Fetch all employees for the current firm
    const employees = await MasterRoll.find({ firmId }).lean();

    // Apply filters
    let filteredEmployees = filterEmployees(employees, {
      filters,
      respectCurrentFilters,
      currentFilters,
      searchTerm
    });

    // Generate export based on format
    let buffer;
    let contentType;
    let filename;

    // Combine all filters for display in exports
    const allFilters = { ...filters };
    if (respectCurrentFilters && currentFilters) {
      Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] && currentFilters[key].length > 0) {
          allFilters[key] = currentFilters[key].join(', ');
        }
      });
    }

    switch (format) {
      case 'excel':
        buffer = await generateExcelExport(filteredEmployees, selectedColumns, includeSummary, allFilters, searchTerm);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `master_roll_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        break;
      case 'csv':
        buffer = generateCSVExport(filteredEmployees, selectedColumns);
        contentType = 'text/csv';
        filename = `master_roll_export_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'pdf':
        buffer = await generatePDFExport(filteredEmployees, selectedColumns, includeSummary, allFilters, searchTerm);
        contentType = 'application/pdf';
        filename = `master_roll_export_${new Date().toISOString().split('T')[0]}.pdf`;
        break;
    }

    // Set response headers
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });

    return buffer;

  } catch (error) {
    console.error('Export error:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to export data'
    });
  }
});

/**
 * Filter employees based on provided criteria
 */
function filterEmployees(employees, options) {
  const { filters, respectCurrentFilters, currentFilters, searchTerm } = options;
  let filtered = [...employees];

  // Apply current table filters if enabled
  if (respectCurrentFilters) {
    // Apply search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(employee => {
        return (
          employee.employeeName?.toLowerCase().includes(search) ||
          employee.fatherHusbandName?.toLowerCase().includes(search) ||
          employee.phoneNo?.toLowerCase().includes(search) ||
          employee.category?.toLowerCase().includes(search) ||
          employee.status?.toLowerCase().includes(search) ||
          employee.project?.toLowerCase().includes(search) ||
          employee.site?.toLowerCase().includes(search)
        );
      });
    }

    // Apply column filters
    Object.keys(currentFilters).forEach(column => {
      if (currentFilters[column] && currentFilters[column].length > 0) {
        filtered = filtered.filter(employee => {
          if (column === 'dateOfJoining') {
            const formattedDate = formatDate(employee[column]);
            return currentFilters[column].includes(formattedDate);
          }
          return currentFilters[column].includes(employee[column]);
        });
      }
    });
  }

  // Apply export-specific filters
  if (filters.dateFrom) {
    filtered = filtered.filter(emp => new Date(emp.dateOfJoining) >= new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    filtered = filtered.filter(emp => new Date(emp.dateOfJoining) <= new Date(filters.dateTo));
  }
  if (filters.status) {
    filtered = filtered.filter(emp => emp.status === filters.status);
  }
  if (filters.category) {
    filtered = filtered.filter(emp => emp.category === filters.category);
  }
  if (filters.project) {
    filtered = filtered.filter(emp => emp.project === filters.project);
  }
  if (filters.site) {
    filtered = filtered.filter(emp => emp.site === filters.site);
  }
  if (filters.phoneValidation) {
    if (filters.phoneValidation === 'valid') {
      filtered = filtered.filter(emp => isValidPhoneNumber(emp.phoneNo));
    } else if (filters.phoneValidation === 'invalid') {
      filtered = filtered.filter(emp => !isValidPhoneNumber(emp.phoneNo));
    }
  }

  return filtered;
}

/**
 * Phone number validation function
 */
function isValidPhoneNumber(phoneNo) {
  if (!phoneNo) return false;
  const cleanPhone = phoneNo.toString().replace(/\D/g, '');
  const invalidPatterns = [
    /^0+$/, /^1+$/, /^2+$/, /^3+$/, /^4+$/, /^5+$/, /^6+$/, /^7+$/, /^8+$/, /^9+$/,
    /^123456789[0-9]$/, /^987654321[0-9]$/
  ];
  for (const pattern of invalidPatterns) {
    if (pattern.test(cleanPhone)) return false;
  }
  if (cleanPhone.length === 10) return /^[6-9]/.test(cleanPhone);
  if (cleanPhone.length === 11) return /^[0-9]/.test(cleanPhone);
  return false;
}

/**
 * Format date to dd-mm-yyyy
 */
function formatDate(date) {
  if (!date) return '';
  const dateObj = new Date(date);
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Get column label for display
 */
function getColumnLabel(columnKey) {
  const columnLabels = {
    employeeName: 'Employee Name',
    fatherHusbandName: 'Father/Husband Name',
    dateOfBirth: 'Date of Birth',
    dateOfJoining: 'Date of Joining',
    aadhar: 'Aadhar',
    pan: 'PAN',
    phoneNo: 'Phone Number',
    address: 'Address',
    bank: 'Bank',
    branch: 'Branch',
    accountNo: 'Account Number',
    ifsc: 'IFSC',
    uan: 'UAN',
    esicNo: 'ESIC Number',
    sKalyanNo: 'S Kalyan Number',
    pDayWage: 'Per Day Wage',
    project: 'Project',
    site: 'Site',
    category: 'Category',
    status: 'Status',
    dateOfExit: 'Date of Exit',
    doeRem: 'Exit Remarks'
  };
  return columnLabels[columnKey] || columnKey;
}

/**
 * Format cell value for display
 */
function formatCellValue(employee, columnKey) {
  const value = employee[columnKey];

  if (columnKey === 'dateOfJoining' || columnKey === 'dateOfBirth' || columnKey === 'dateOfExit') {
    return formatDate(value);
  }

  if (columnKey === 'pDayWage') {
    return value ? parseFloat(value).toFixed(2) : '0.00';
  }

  if (columnKey === 'status') {
    return value || 'Active';
  }

  return value || '';
}

/**
 * Get appropriate column width for Excel export
 */
function getColumnWidth(columnKey) {
  const columnWidths = {
    employeeName: 25,
    fatherHusbandName: 25,
    dateOfBirth: 15,
    dateOfJoining: 15,
    aadhar: 18,
    pan: 15,
    phoneNo: 15,
    address: 30,
    bank: 20,
    branch: 20,
    accountNo: 18,
    ifsc: 15,
    uan: 15,
    esicNo: 15,
    sKalyanNo: 15,
    pDayWage: 12,
    project: 20,
    site: 20,
    category: 15,
    status: 12,
    dateOfExit: 15,
    doeRem: 25
  };
  return columnWidths[columnKey] || 15;
}

/**
 * Generate Excel export with filter information
 */
async function generateExcelExport(employees, selectedColumns, includeSummary, filters = {}, searchTerm = '') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Master Roll Export');

  let currentRow = 1;

  // Add title
  worksheet.mergeCells('A1', String.fromCharCode(65 + selectedColumns.length - 1) + '1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Master Roll Export Report';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' }
  };
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFF' } };
  currentRow++;

  // Add export date
  worksheet.mergeCells('A2', String.fromCharCode(65 + selectedColumns.length - 1) + '2');
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`;
  dateCell.font = { size: 12 };
  dateCell.alignment = { horizontal: 'center' };
  currentRow++;

  // Add filter information if filters exist
  if (filters && (Object.keys(filters).length > 0 || searchTerm)) {
    currentRow++; // Empty row

    // Filter header
    worksheet.mergeCells(`A${currentRow}`, String.fromCharCode(65 + selectedColumns.length - 1) + currentRow);
    const filterHeaderCell = worksheet.getCell(`A${currentRow}`);
    filterHeaderCell.value = 'Applied Filters:';
    filterHeaderCell.font = { size: 14, bold: true };
    filterHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E5E7EB' }
    };
    filterHeaderCell.alignment = { horizontal: 'center' };
    currentRow++;

    // Display filters
    const filterTexts = [];
    if (searchTerm) filterTexts.push(`Search Term: "${searchTerm}"`);
    if (filters.dateFrom) filterTexts.push(`Date From: ${filters.dateFrom}`);
    if (filters.dateTo) filterTexts.push(`Date To: ${filters.dateTo}`);
    if (filters.status) filterTexts.push(`Status: ${filters.status}`);
    if (filters.category) filterTexts.push(`Category: ${filters.category}`);
    if (filters.project) filterTexts.push(`Project: ${filters.project}`);
    if (filters.site) filterTexts.push(`Site: ${filters.site}`);
    if (filters.phoneValidation) filterTexts.push(`Phone Validation: ${filters.phoneValidation}`);

    if (filterTexts.length === 0) {
      filterTexts.push('No specific filters applied');
    }

    // Add filter details in rows
    filterTexts.forEach((filterText) => {
      worksheet.mergeCells(`A${currentRow}`, String.fromCharCode(65 + selectedColumns.length - 1) + currentRow);
      const filterCell = worksheet.getCell(`A${currentRow}`);
      filterCell.value = filterText;
      filterCell.font = { size: 10 };
      filterCell.alignment = { horizontal: 'left', indent: 1 };
      currentRow++;
    });

    currentRow++; // Empty row after filters
  }

  // Add headers
  const headerRow = worksheet.getRow(currentRow);
  selectedColumns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = getColumnLabel(column);
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  currentRow++;

  // Add data rows
  employees.forEach((employee, rowIndex) => {
    const row = worksheet.getRow(currentRow + rowIndex);
    selectedColumns.forEach((column, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = formatCellValue(employee, column);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Highlight invalid phone numbers
      if (column === 'phoneNo' && !isValidPhoneNumber(employee.phoneNo)) {
        cell.font = { color: { argb: 'DC2626' }, bold: true };
      }
    });
  });

  currentRow += employees.length;

  // Add summary if requested
  if (includeSummary) {
    currentRow += 2; // Empty rows before summary

    // Summary title
    worksheet.mergeCells(`A${currentRow}`, String.fromCharCode(65 + selectedColumns.length - 1) + currentRow);
    const summaryTitleCell = worksheet.getCell(`A${currentRow}`);
    summaryTitleCell.value = 'Summary Statistics';
    summaryTitleCell.font = { size: 14, bold: true };
    summaryTitleCell.alignment = { horizontal: 'center' };
    summaryTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E5E7EB' }
    };
    currentRow++;

    currentRow++; // Empty row

    // Summary data
    const summaryData = [
      ['Total Employees', employees.length],
      ['Active Employees', employees.filter(emp => (emp.status || 'Active').toLowerCase() === 'active').length],
      ['Inactive Employees', employees.filter(emp => {
        const status = (emp.status || 'Active').toLowerCase();
        return status === 'inactive' || status === 'terminated' || status === 'left';
      }).length],
      ['Valid Phone Numbers', employees.filter(emp => isValidPhoneNumber(emp.phoneNo)).length],
      ['Invalid Phone Numbers', employees.filter(emp => !isValidPhoneNumber(emp.phoneNo)).length]
    ];

    summaryData.forEach((data, index) => {
      const row = worksheet.getRow(currentRow + index);
      row.getCell(1).value = data[0];
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = data[1];
      row.getCell(1).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      row.getCell(2).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  }

  // Auto-fit columns with appropriate widths
  selectedColumns.forEach((column, index) => {
    const columnLetter = String.fromCharCode(65 + index);
    worksheet.getColumn(columnLetter).width = getColumnWidth(column);
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate CSV export
 */
function generateCSVExport(employees, selectedColumns) {
  const headers = selectedColumns.map(column => getColumnLabel(column));
  const csvContent = [
    headers.join(','),
    ...employees.map(employee => 
      selectedColumns.map(column => {
        const value = formatCellValue(employee, column);
        // Escape commas and quotes in CSV
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generate PDF export using PDFKit (simplified version)
 */
async function generatePDFExport(employees, selectedColumns, includeSummary, filters = {}, searchTerm = '') {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'landscape'
      });

      // Create buffer to collect PDF data
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      let yPosition = 50;

      // Add title
      doc.fontSize(18).font('Helvetica-Bold').text('Master Roll Export Report', 40, yPosition);
      yPosition += 30;

      // Add date
      doc.fontSize(10).font('Helvetica').fillColor('gray').text(`Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, 40, yPosition);
      yPosition += 20;

      // Reset color
      doc.fillColor('black');

  // Title with background
  const titleHeight = 35;
  drawBorderedRect(margin, yPosition - titleHeight, contentWidth, titleHeight, rgb(0.27, 0.31, 0.8)); // Indigo background

  currentPage.drawText('Master Roll Export Report', {
    x: margin + 20,
    y: yPosition - 25,
    size: 18,
    font: boldFont,
    color: rgb(1, 1, 1) // White text
  });

  yPosition -= titleHeight + 10;

  // Date and generation info
  const dateText = `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`;
  currentPage.drawText(dateText, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4)
  });

  yPosition -= 25;

  // Filter information section
  if (filters && (Object.keys(filters).length > 0 || searchTerm)) {
    checkAndAddNewPage(100);

    // Filter header
    const filterHeaderHeight = 25;
    drawBorderedRect(margin, yPosition - filterHeaderHeight, contentWidth, filterHeaderHeight, rgb(0.93, 0.95, 0.98));

    currentPage.drawText('Applied Filters:', {
      x: margin + 10,
      y: yPosition - 18,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2)
    });

    yPosition -= filterHeaderHeight + 8;

    // Display filters in a more organized way
    const filterTexts = [];
    if (searchTerm) filterTexts.push(`Search Term: "${searchTerm}"`);
    if (filters.dateFrom) filterTexts.push(`Date From: ${filters.dateFrom}`);
    if (filters.dateTo) filterTexts.push(`Date To: ${filters.dateTo}`);
    if (filters.status) filterTexts.push(`Status: ${filters.status}`);
    if (filters.category) filterTexts.push(`Category: ${filters.category}`);
    if (filters.project) filterTexts.push(`Project: ${filters.project}`);
    if (filters.site) filterTexts.push(`Site: ${filters.site}`);
    if (filters.phoneValidation) filterTexts.push(`Phone Validation: ${filters.phoneValidation}`);

    if (filterTexts.length === 0) {
      filterTexts.push('No specific filters applied');
    }

    // Draw filter background box
    const filterBoxHeight = Math.ceil(filterTexts.length / 2) * 16 + 16;
    drawBorderedRect(margin, yPosition - filterBoxHeight, contentWidth, filterBoxHeight, rgb(0.98, 0.99, 1));

    filterTexts.forEach((filterText, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const xPos = margin + 15 + (col * (contentWidth / 2));
      const yPos = yPosition - 15 - (row * 16);

      currentPage.drawText(`• ${filterText}`, {
        x: xPos,
        y: yPos,
        size: 9,
        font: font,
        color: rgb(0.25, 0.25, 0.25)
      });
    });

    yPosition -= filterBoxHeight + 15;
  }

  // Calculate dynamic column widths and determine if we need column splitting
  const getPreferredColumnWidth = (column) => {
    switch (column) {
      case 'employeeName':
      case 'fatherHusbandName':
        return 95;
      case 'address':
        return 120;
      case 'phoneNo':
        return 75;
      case 'aadhar':
        return 85;
      case 'pan':
        return 70;
      case 'accountNo':
        return 100; // Increased for full account numbers
      case 'ifsc':
        return 85; // Increased for better IFSC code visibility
      case 'dateOfJoining':
      case 'dateOfBirth':
      case 'dateOfExit':
        return 65;
      case 'project':
        return 90; // Increased for project names
      case 'site':
        return 80;
      case 'bank':
      case 'branch':
        return 80;
      case 'category':
        return 70;
      case 'status':
        return 60;
      case 'uan':
      case 'esicNo':
      case 'sKalyanNo':
        return 75;
      case 'pDayWage':
        return 65;
      default:
        return 70;
    }
  };

  // Split columns into groups that fit on one page
  const splitColumnsIntoGroups = () => {
    const groups = [];
    let currentGroup = [];
    let currentGroupWidth = 0;
    const maxPageWidth = contentWidth - 20; // Leave some margin for safety

    // Always include employeeName in first column of each group for reference
    const employeeNameWidth = getPreferredColumnWidth('employeeName');

    selectedColumns.forEach((column, index) => {
      const columnWidth = getPreferredColumnWidth(column);

      // If this is not the first column and adding it would exceed page width
      if (currentGroup.length > 0 && currentGroupWidth + columnWidth > maxPageWidth) {
        // Start new group
        groups.push({
          columns: [...currentGroup],
          widths: currentGroup.map(col => getPreferredColumnWidth(col))
        });

        // Start new group with employeeName (unless it's already the current column)
        if (column !== 'employeeName') {
          currentGroup = ['employeeName', column];
          currentGroupWidth = employeeNameWidth + columnWidth;
        } else {
          currentGroup = [column];
          currentGroupWidth = columnWidth;
        }
      } else {
        currentGroup.push(column);
        currentGroupWidth += columnWidth;
      }
    });

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push({
        columns: [...currentGroup],
        widths: currentGroup.map(col => getPreferredColumnWidth(col))
      });
    }

    return groups;
  };

  const columnGroups = splitColumnsIntoGroups();
  const needsColumnSplitting = columnGroups.length > 1;

  const baseRowHeight = 20;
  const headerHeight = 25;

  // Add information about column splitting if needed
  if (needsColumnSplitting) {
    checkAndAddNewPage(60);

    const infoHeight = 40;
    drawBorderedRect(margin, yPosition - infoHeight, contentWidth, infoHeight, rgb(1, 0.95, 0.8)); // Light orange background

    currentPage.drawText('Note: Due to the large number of columns, the table has been split across multiple sections.', {
      x: margin + 10,
      y: yPosition - 15,
      size: 10,
      font: font,
      color: rgb(0.6, 0.3, 0.1)
    });

    currentPage.drawText(`Total sections: ${columnGroups.length} | Employee Name is repeated in each section for reference.`, {
      x: margin + 10,
      y: yPosition - 30,
      size: 9,
      font: font,
      color: rgb(0.6, 0.3, 0.1)
    });

    yPosition -= infoHeight + 15;
  }

  // Helper function to wrap text and calculate required height
  const wrapText = (text, maxWidth, fontSize = 8) => {
    if (!text || text.toString().trim() === '') return [''];

    const textStr = text.toString();
    const words = textStr.split(' ');
    const lines = [];
    let currentLine = '';

    // Improved character width calculation based on font size
    const charWidth = fontSize * 0.55;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is too long, break it more intelligently
          if (word.length > maxCharsPerLine) {
            const breakPoint = Math.max(maxCharsPerLine - 3, 5);
            lines.push(word.substring(0, breakPoint) + '...');
            currentLine = '';
          } else {
            currentLine = word;
          }
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  };

  // Helper function to calculate row height based on content
  const calculateRowHeight = (employee, selectedColumns, columnWidths) => {
    let maxLines = 1;

    selectedColumns.forEach((column, index) => {
      const value = formatCellValue(employee, column);
      const lines = wrapText(value, columnWidths[index] - 8, 8); // 8px padding
      maxLines = Math.max(maxLines, lines.length);
    });

    // Improved row height calculation with better spacing
    return Math.max(baseRowHeight, maxLines * 11 + 10); // 11px line height + 10px padding
  };

  // Render each column group as a separate table
  columnGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      // Add a new page for each additional column group
      currentPage = pdfDoc.addPage([842, 595]);
      yPosition = height - margin;

      // Add section header for continuation
      const sectionHeaderHeight = 30;
      drawBorderedRect(margin, yPosition - sectionHeaderHeight, contentWidth, sectionHeaderHeight, rgb(0.9, 0.9, 0.95));

      currentPage.drawText(`Master Roll Export Report - Section ${groupIndex + 1} of ${columnGroups.length}`, {
        x: margin + 10,
        y: yPosition - 20,
        size: 14,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      });

      yPosition -= sectionHeaderHeight + 20;
    }

    const currentColumns = group.columns;
    const currentColumnWidths = group.widths;

    // Calculate header height for this group
    let maxHeaderLines = 1;
    currentColumns.forEach((column, index) => {
      const headerText = getColumnLabel(column);
      const lines = wrapText(headerText, currentColumnWidths[index] - 8, 9);
      maxHeaderLines = Math.max(maxHeaderLines, lines.length);
    });
    const dynamicHeaderHeight = Math.max(headerHeight, maxHeaderLines * 11 + 10);

    checkAndAddNewPage(dynamicHeaderHeight + 40);

    // Calculate total width for this group
    const groupTotalWidth = currentColumnWidths.reduce((sum, width) => sum + width, 0);

    // Draw table headers with background and borders
    let xPosition = margin;

    // Header background
    drawBorderedRect(margin, yPosition - dynamicHeaderHeight, groupTotalWidth, dynamicHeaderHeight, rgb(0.27, 0.31, 0.8));

    currentColumns.forEach((column, index) => {
      // Draw header cell border
      drawBorderedRect(xPosition, yPosition - dynamicHeaderHeight, currentColumnWidths[index], dynamicHeaderHeight);

      // Header text with wrapping
      const headerText = getColumnLabel(column);
      const wrappedHeaderLines = wrapText(headerText, currentColumnWidths[index] - 8, 9);

      wrappedHeaderLines.forEach((line, lineIndex) => {
        const lineY = yPosition - 13 - (lineIndex * 11);

        currentPage.drawText(line, {
          x: xPosition + 4,
          y: lineY,
          size: 9,
          font: boldFont,
          color: rgb(1, 1, 1) // White text
        });
      });

      xPosition += currentColumnWidths[index];
    });

    yPosition -= dynamicHeaderHeight;

    // Draw data rows for this column group
    employees.forEach((employee, rowIndex) => {
      // Calculate dynamic row height based on content for this group
      const calculateGroupRowHeight = (employee, columns, widths) => {
        let maxLines = 1;
        columns.forEach((column, index) => {
          const value = formatCellValue(employee, column);
          const lines = wrapText(value, widths[index] - 8, 8);
          maxLines = Math.max(maxLines, lines.length);
        });
        return Math.max(baseRowHeight, maxLines * 11 + 10);
      };

      const dynamicRowHeight = calculateGroupRowHeight(employee, currentColumns, currentColumnWidths);

      checkAndAddNewPage(dynamicRowHeight + 5);

      // Alternating row colors
      const isEvenRow = rowIndex % 2 === 0;
      const rowColor = isEvenRow ? rgb(0.98, 0.98, 0.98) : rgb(1, 1, 1);

      // Calculate total width for this group
      const groupTotalWidth = currentColumnWidths.reduce((sum, width) => sum + width, 0);

      // Draw row background
      drawBorderedRect(margin, yPosition - dynamicRowHeight, groupTotalWidth, dynamicRowHeight, rowColor);

      xPosition = margin;

      currentColumns.forEach((column, colIndex) => {
        // Draw cell border
        drawBorderedRect(xPosition, yPosition - dynamicRowHeight, currentColumnWidths[colIndex], dynamicRowHeight);

        const value = formatCellValue(employee, column);
        let textColor = rgb(0, 0, 0);
        let textFont = font;

        // Special formatting for different data types
        if (column === 'phoneNo' && !isValidPhoneNumber(employee.phoneNo)) {
          textColor = rgb(0.8, 0.1, 0.1); // Red for invalid phone numbers
          textFont = boldFont;
        } else if (column === 'status') {
          // Color code status
          const status = (employee.status || 'Active').toLowerCase();
          if (status === 'active') {
            textColor = rgb(0.1, 0.6, 0.1); // Green
          } else if (status === 'inactive' || status === 'terminated' || status === 'left') {
            textColor = rgb(0.8, 0.1, 0.1); // Red
          } else if (status === 'on leave') {
            textColor = rgb(0.8, 0.6, 0.1); // Orange
          }
        } else if (column === 'category') {
          // Color code categories
          const category = (employee.category || '').toLowerCase();
          if (category.includes('skilled')) {
            textColor = rgb(0.1, 0.4, 0.8); // Blue for skilled workers
          } else if (category === 'technician' || category === 'electrician') {
            textColor = rgb(0.6, 0.1, 0.6); // Purple for technical roles
          }
        }

        // Wrap text and draw multiple lines with improved spacing
        const wrappedLines = wrapText(value, currentColumnWidths[colIndex] - 8, 8);

        wrappedLines.forEach((line, lineIndex) => {
          const lineY = yPosition - 13 - (lineIndex * 11); // 11px line spacing for better readability

          currentPage.drawText(line, {
            x: xPosition + 4,
            y: lineY,
            size: 8,
            font: textFont,
            color: textColor
          });
        });

        xPosition += currentColumnWidths[colIndex];
      });

      yPosition -= dynamicRowHeight;
    });

    // Add some space between column groups (except for the last one)
    if (groupIndex < columnGroups.length - 1) {
      yPosition -= 30;
    }
  }); // End of column groups loop

  // Add summary if requested
  if (includeSummary) {
    yPosition -= 20;
    checkAndAddNewPage(120);

    // Summary header
    const summaryHeaderHeight = 25;
    drawBorderedRect(margin, yPosition - summaryHeaderHeight, contentWidth, summaryHeaderHeight, rgb(0.9, 0.95, 1));

    currentPage.drawText('Summary Statistics', {
      x: margin + 10,
      y: yPosition - 18,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2)
    });

    yPosition -= summaryHeaderHeight + 10;

    const summaryData = [
      `Total Employees: ${employees.length}`,
      `Active Employees: ${employees.filter(emp => (emp.status || 'Active').toLowerCase() === 'active').length}`,
      `Inactive Employees: ${employees.filter(emp => {
        const status = (emp.status || 'Active').toLowerCase();
        return status === 'inactive' || status === 'terminated' || status === 'left';
      }).length}`,
      `Valid Phone Numbers: ${employees.filter(emp => isValidPhoneNumber(emp.phoneNo)).length}`,
      `Invalid Phone Numbers: ${employees.filter(emp => !isValidPhoneNumber(emp.phoneNo)).length}`,
      `Categories: ${[...new Set(employees.map(emp => emp.category).filter(Boolean))].length} unique`,
      `Projects: ${[...new Set(employees.map(emp => emp.project).filter(Boolean))].length} unique`,
      `Sites: ${[...new Set(employees.map(emp => emp.site).filter(Boolean))].length} unique`
    ];

    // Draw summary in a bordered box
    const summaryBoxHeight = summaryData.length * 18 + 20;
    drawBorderedRect(margin, yPosition - summaryBoxHeight, contentWidth, summaryBoxHeight, rgb(0.98, 0.98, 0.98));

    summaryData.forEach((text, index) => {
      currentPage.drawText(text, {
        x: margin + 15,
        y: yPosition - 20 - (index * 18),
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.2)
      });
    });

    yPosition -= summaryBoxHeight + 10;
  }

  // Add footer with page numbers and generation info
  const pageCount = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();

  pages.forEach((page, pageIndex) => {
    const footerY = 20;

    // Left side - generation info
    page.drawText(`Generated by Master Roll System - ${new Date().toLocaleDateString('en-IN')}`, {
      x: margin,
      y: footerY,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Right side - page numbers
    page.drawText(`Page ${pageIndex + 1} of ${pageCount}`, {
      x: width - margin - 80,
      y: footerY,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });

    // Center - record count info
    if (pageIndex === 0) {
      page.drawText(`Total Records: ${employees.length}`, {
        x: width / 2 - 40,
        y: footerY,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
  });

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}
