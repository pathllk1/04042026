import { defineEventHandler, createError, setHeader } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';

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
        success: false,
        message: `No backup needed. Current count: ${count} (less than 1000)`,
        count
      };
    }
    
    // Get all documents
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      return {
        success: false,
        message: 'Collection is empty, no backup needed',
        count: 0
      };
    }
    
    // Process documents
    const documents: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();

      // Convert Firestore Timestamps to ISO strings
      const processedData: any = {};
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
    
    // Create JSON backup (MUCH FASTER than Excel)
    const backupData = {
      exportDate: new Date().toISOString(),
      totalRecords: documents.length,
      collection: 'api_logs',
      data: documents
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(backupData, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf8');

    // Create timestamp for filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const filename = `api_logs_backup_${timestamp}.json`;

    // Set headers for JSON file download
    setHeader(event, 'Content-Type', 'application/json');
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    setHeader(event, 'Content-Length', jsonBuffer.length);
    
    // Delete all documents from the collection after successful backup generation
    const batchSize = 400; // Firestore limit is 500 operations per batch
    let batchCount = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      for (const doc of batchDocs) {
        batch.delete(doc.ref);
      }
      
      await batch.commit();
      batchCount++;
    }
    
    console.log(`[Auto Download Backup] ✅ COMPLETED: JSON backup downloaded (${documents.length} records) and collection cleaned up in ${batchCount} batches`);

    // Return the JSON buffer for download
    return jsonBuffer;
    
  } catch (error) {
    console.error('Auto download backup error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create and download backup',
      data: error
    });
  }
});
