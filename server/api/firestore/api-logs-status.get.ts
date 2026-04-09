import { defineEventHandler, createError } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can view API logs status'
      });
    }

    const db = getFirestore();
    const collectionName = 'api_logs';
    const collectionRef = db.collection(collectionName);
    
    // Count documents in the collection
    const countSnapshot = await collectionRef.count().get();
    const count = countSnapshot.data().count;
    
    // Get the latest log entry for timestamp info
    let latestLog = null;
    try {
      const latestSnapshot = await collectionRef
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (!latestSnapshot.empty) {
        const doc = latestSnapshot.docs[0];
        const data = doc.data();
        latestLog = {
          timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : null,
          method: data.method,
          path: data.path
        };
      }
    } catch (err) {
      console.log('Could not fetch latest log:', err);
    }
    
    return {
      success: true,
      count,
      needsBackup: count >= 1000,
      threshold: 1000,
      latestLog,
      checkInterval: '5 minutes',
      backupFormat: 'Excel (.xlsx)'
    };
    
  } catch (error) {
    console.error('API logs status error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get API logs status',
      data: error
    });
  }
});
