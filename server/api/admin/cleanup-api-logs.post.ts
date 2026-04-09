import { defineEventHandler, createError } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can cleanup API logs'
      });
    }

    const db = getFirestore();
    const collectionName = 'api_logs';
    const collectionRef = db.collection(collectionName);
    
    console.log('🧹 [CLEANUP] Starting API logs cleanup...');
    
    // Get all documents that are admin monitoring calls (the flood)
    const monitoringPaths = [
      '/api/firestore/api-logs-status',
      '/api/firestore/auto-backup-status', 
      '/api/firestore/collections',
      '/api/admin/status',
      '/api/health',
      '/api/ping'
    ];
    
    let totalDeleted = 0;
    let batchCount = 0;
    
    // Delete monitoring calls in batches
    for (const path of monitoringPaths) {
      console.log(`🧹 [CLEANUP] Deleting logs for path: ${path}`);
      
      let hasMore = true;
      while (hasMore) {
        // Get batch of documents to delete
        const snapshot = await collectionRef
          .where('path', '==', path)
          .limit(400) // Firestore batch limit
          .get();
        
        if (snapshot.empty) {
          hasMore = false;
          continue;
        }
        
        // Create batch delete
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Execute batch
        await batch.commit();
        
        totalDeleted += snapshot.docs.length;
        batchCount++;
        
        console.log(`🧹 [CLEANUP] Deleted batch ${batchCount}: ${snapshot.docs.length} documents for ${path}`);
        
        // If we got less than 400, we're done with this path
        if (snapshot.docs.length < 400) {
          hasMore = false;
        }
      }
    }
    
    // Also delete any logs from the last hour (likely flood)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    console.log('🧹 [CLEANUP] Deleting recent flood logs...');
    
    let hasMoreRecent = true;
    while (hasMoreRecent) {
      const recentSnapshot = await collectionRef
        .where('timestamp', '>', oneHourAgo)
        .limit(400)
        .get();
      
      if (recentSnapshot.empty) {
        hasMoreRecent = false;
        continue;
      }
      
      const batch = db.batch();
      recentSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      totalDeleted += recentSnapshot.docs.length;
      batchCount++;
      
      console.log(`🧹 [CLEANUP] Deleted recent flood batch ${batchCount}: ${recentSnapshot.docs.length} documents`);
      
      if (recentSnapshot.docs.length < 400) {
        hasMoreRecent = false;
      }
    }
    
    // Get final count
    const finalCountSnapshot = await collectionRef.count().get();
    const finalCount = finalCountSnapshot.data().count;
    
    console.log(`🧹 [CLEANUP] ✅ COMPLETED: Deleted ${totalDeleted} flood logs in ${batchCount} batches. Remaining: ${finalCount} logs`);
    
    return {
      success: true,
      deletedCount: totalDeleted,
      batchCount,
      remainingCount: finalCount,
      message: `Successfully cleaned up ${totalDeleted} flood logs. ${finalCount} legitimate logs remain.`
    };
    
  } catch (error) {
    console.error('Cleanup API logs error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to cleanup API logs',
      data: error
    });
  }
});
