import ExcelJS from 'exceljs';
import Document from '../../../models/Document'; // Import your Mongoose model
import { createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;
    
    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Fetch documents by userId
    const documents = await Document.find({ userId }).lean();
    if (!documents || documents.length === 0) {
      throw new Error('No documents found for the given userId');
    }

    // Calculate summary statistics
    const today = new Date();
    const summary = {
      totalDocuments: documents.length,
      expired: documents.filter(doc => new Date(doc.expiryDate) < today).length,
      expiringSoon: documents.filter(doc => {
        const expiryDate = new Date(doc.expiryDate);
        return expiryDate >= today && (expiryDate - today) / (1000 * 60 * 60 * 24) <= 30;
      }).length,
      statusOk: documents.filter(doc => new Date(doc.expiryDate) > today && (new Date(doc.expiryDate) - today) / (1000 * 60 * 60 * 24) > 30).length,
    };

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add "Documents" worksheet
    const documentSheet = workbook.addWorksheet('Documents');
    documentSheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Ref No.', key: 'ref_no', width: 20 },
      { header: 'Value (₹)', key: 'value', width: 20 },
      { header: 'Start Date', key: 'startDate', width: 20 },
      { header: 'Expiry Date', key: 'expiryDate', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    const documentHeaderRow = documentSheet.getRow(1);
    documentHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White font
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E90FF' } }; // Blue background
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Add document data with conditional formatting for expiryDate
    documents.forEach((doc) => {
      const row = documentSheet.addRow({
        name: doc.name,
        description: doc.description,
        ref_no: doc.ref_no,
        value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(doc.value),
        startDate: doc.startDate ? new Date(doc.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        expiryDate: new Date(doc.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        createdAt: new Date(doc.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }),
      });

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      const expiryDateCell = row.getCell('expiryDate');
      const expiryDate = new Date(doc.expiryDate);

      if (expiryDate < today) {
        expiryDateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Red
        expiryDateCell.font = { color: { argb: 'FFFFFFFF' } };
      } else if ((expiryDate - today) / (1000 * 60 * 60 * 24) <= 30) {
        expiryDateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA500' } }; // Orange
      } else {
        expiryDateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } }; // Green
      }
    });

    // Add "Summary" worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Category', 'Count']); // Add header
    summarySheet.addRow(['Total Documents', summary.totalDocuments]);
    summarySheet.addRow(['Expired', summary.expired]);
    summarySheet.addRow(['Expiring Soon (Next 30 days)', summary.expiringSoon]);
    summarySheet.addRow(['Status OK', summary.statusOk]);

    // Style the header row
    const headerRow = summarySheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White font
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E90FF' } }; // Blue background
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers to download the file
    setHeaders(event, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="documents_summary.xlsx"',
    });

    return buffer;
  } catch (error) {
    console.error('Error exporting documents:', error.message);
    throw error;
  }
});
