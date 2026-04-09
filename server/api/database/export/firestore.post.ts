import { defineEventHandler, createError, setResponseHeader } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can export Firestore data'
      });
    }

    const body = await readBody(event);
    const { collectionName, format = 'json', fields = [] } = body;

    // Validate collection name
    if (!collectionName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Collection name is required'
      });
    }

    const db = getFirestore();

    // Check if collection exists
    const collections = await db.listCollections();
    const collectionExists = collections.some(col => col.id === collectionName);

    if (!collectionExists) {
      throw createError({
        statusCode: 404,
        statusMessage: `Collection '${collectionName}' not found`
      });
    }

    // Fetch all documents
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      throw createError({
        statusCode: 404,
        statusMessage: `Collection '${collectionName}' is empty`
      });
    }

    // Process documents
    const documents = [];
    snapshot.forEach(doc => {
      const data = doc.data();

      // Convert Firestore Timestamps to ISO strings
      const processedData = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
          processedData[key] = value.toDate().toISOString();
        } else {
          processedData[key] = value;
        }
      });

      documents.push({
        id: doc.id,
        ...processedData
      });
    });

    // Process data based on format
    let exportData;
    let contentType;
    let filename;

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');

    if (format === 'excel') {
      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(collectionName);

      // Determine fields to include
      let excelFields = fields.length > 0 ? fields : ['id', ...new Set(documents.flatMap(doc => Object.keys(doc)))];

      // Add header row
      worksheet.addRow(excelFields);

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFA500' } // Orange background for Firestore
      };

      // Add data rows
      for (const doc of documents) {
        const rowData = excelFields.map(field => {
          const value = doc[field];

          // Handle different value types
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'object') {
            return JSON.stringify(value);
          } else {
            return value;
          }
        });

        worksheet.addRow(rowData);
      }

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50); // Maximum width of 50
      });

      // Create a stream to write the workbook
      const stream = new PassThrough();
      workbook.xlsx.write(stream)
        .then(() => {
          stream.end();
        });

      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${collectionName}_export_${timestamp}.xlsx`;

      // Return the stream directly
      setResponseHeader(event, 'Content-Type', contentType);
      setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
      return stream;
    } else {
      // Default to JSON format
      exportData = JSON.stringify(documents, null, 2);
      contentType = 'application/json';
      filename = `${collectionName}_export_${timestamp}.json`;
    }

    // Set response headers for download
    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

    // Return the data directly
    return exportData;
  } catch (error) {
    console.error('Firestore export error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export Firestore data',
      data: error
    });
  }
});
