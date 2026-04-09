import { defineEventHandler, createError } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can check auto backup status'
      });
    }

    const db = getFirestore();
    const collectionName = 'api_logs';
    const collectionRef = db.collection(collectionName);
    
    // Count documents in the collection
    const countSnapshot = await collectionRef.count().get();
    const count = countSnapshot.data().count;
    
    // Check if auto backup is ready
    const autoBackup = (global as any).autoBackupReady;
    
    // Check if backup is currently in progress
    const isProcessing = (global as any).backupInProgress || false;

    return {
      success: true,
      currentCount: count,
      needsBackup: count >= 1000,
      threshold: 1000,
      autoBackupReady: !!autoBackup,
      isProcessing: isProcessing,
      autoBackupInfo: autoBackup ? {
        filename: autoBackup.filename,
        count: autoBackup.count,
        timestamp: autoBackup.timestamp
      } : null
    };
    
  } catch (error) {
    console.error('Auto backup status error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get auto backup status',
      data: error
    });
  }
});
