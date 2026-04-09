import { defineEventHandler, createError, setResponseHeader } from 'h3';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can export database data'
      });
    }

    const body = await readBody(event);
    const { modelName, format = 'json', fields = [] } = body;

    // Validate model name
    if (!modelName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model name is required'
      });
    }

    // Check if model exists
    if (!mongoose.modelNames().includes(modelName)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Model '${modelName}' not found`
      });
    }

    // Get the model
    const model = mongoose.model(modelName);

    // Fetch all documents
    const documents = await model.find().lean();

    // Process data based on format
    let exportData;
    let contentType;
    let filename;

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');

    if (format === 'excel') {
      // Create a new Excel workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(modelName);

      // Determine fields to include
      let excelFields = fields.length > 0 ? fields : Object.keys(model.schema.paths);

      // Remove internal MongoDB fields if not explicitly requested
      if (fields.length === 0) {
        excelFields = excelFields.filter(field => !['__v', '_id'].includes(field));
      }

      // Add header row
      worksheet.addRow(excelFields);

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' } // Light gray background
      };

      // Add data rows
      for (const doc of documents) {
        const rowData = excelFields.map(field => {
          const value = field === '_id' ? doc._id?.toString() : doc[field];

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
      filename = `${modelName}_export_${timestamp}.xlsx`;

      // Return the stream directly
      setResponseHeader(event, 'Content-Type', contentType);
      setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
      return stream;
    } else {
      // Default to JSON format
      exportData = JSON.stringify(documents, null, 2);
      contentType = 'application/json';
      filename = `${modelName}_export_${timestamp}.json`;
    }

    // Set response headers for download
    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

    // Return the data directly
    return exportData;
  } catch (error) {
    console.error('Database export error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export database data',
      data: error
    });
  }
});
