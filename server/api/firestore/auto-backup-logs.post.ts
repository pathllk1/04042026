import { defineEventHandler, createError } from 'h3';
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
        statusMessage: 'Forbidden: Only admins can perform this operation'
      });
    }

    const db = getFirestore();
    const collectionName = 'api_logs';
    const collectionRef = db.collection(collectionName);
    
    // Count documents in the collection
    const countSnapshot = await collectionRef.count().get();
    const count = countSnapshot.data().count;
    
    // If count is less than 1000, no action needed
    if (count < 1000) {
      return {
        success: true,
        message: `No backup needed. Current count: ${count} (less than 1000)`,
        count
      };
    }
    
    // Get all documents
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      return {
        success: true,
        message: 'Collection is empty, no backup needed',
        count: 0
      };
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
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(collectionName);
    
    // Determine fields from the first document
    const fields = ['id', ...new Set(documents.flatMap(doc => Object.keys(doc)))];
    
    // Add header row
    worksheet.addRow(fields);
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFA500' } // Orange background for Firestore
    };
    
    // Add data rows
    for (const doc of documents) {
      const rowData = fields.map(field => {
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
    
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    
    // Create a stream to write the workbook
    const stream = new PassThrough();
    await workbook.xlsx.write(stream);
    
    // Get the Excel data as a buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const excelBuffer = Buffer.concat(chunks);
    
    // Create a backup document in a separate collection
    const backupRef = db.collection('api_logs_backups').doc(timestamp);
    await backupRef.set({
      timestamp: new Date(),
      count: documents.length,
      createdBy: user.email || user.username || 'admin'
    });
    
    // Store the Excel file in Firestore Storage (if available)
    // Note: This would typically use Firebase Storage, but we're skipping that
    // to avoid folder creation on the server
    
    // Delete all documents from the collection
    const batch = db.batch();
    const batchSize = 400; // Firestore limit is 500 operations per batch
    let operationCount = 0;
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      operationCount++;
      
      // Commit when batch size is reached
      if (operationCount >= batchSize) {
        await batch.commit();
        batchCount++;
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
      batchCount++;
    }
    
    return {
      success: true,
      message: `Successfully backed up and cleared ${documents.length} documents from ${collectionName}`,
      count: documents.length,
      batches: batchCount,
      backupId: timestamp,
      excelData: excelBuffer.toString('base64')
    };
  } catch (error) {
    console.error('Auto-backup error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to backup and clear logs',
      data: error
    });
  }
});
