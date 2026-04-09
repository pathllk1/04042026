import { defineEventHandler, createError } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can access Firestore data'
      });
    }

    const db = getFirestore();
    
    // Get all collections
    const collections = await db.listCollections();
    
    // Map collections to a more usable format
    const collectionData = await Promise.all(collections.map(async (collection) => {
      const collectionName = collection.id;
      
      // Get a sample of documents to determine schema
      const snapshot = await db.collection(collectionName).limit(5).get();
      
      // Extract schema from the first document
      let schema = {};
      let count = 0;
      
      if (!snapshot.empty) {
        const sampleDoc = snapshot.docs[0].data();
        
        // Create a schema from the document fields
        Object.keys(sampleDoc).forEach(field => {
          const value = sampleDoc[field];
          let type = typeof value;
          
          // Handle special Firestore types
          if (value && value.constructor) {
            if (value.constructor.name === 'Timestamp') {
              type = 'timestamp';
            } else if (Array.isArray(value)) {
              type = 'array';
            } else if (value.constructor.name === 'Object') {
              type = 'object';
            } else if (value.constructor.name === 'GeoPoint') {
              type = 'geopoint';
            } else if (value.constructor.name === 'DocumentReference') {
              type = 'reference';
            }
          }
          
          schema[field] = { type };
        });
      }
      
      // Count documents in the collection
      try {
        const countSnapshot = await db.collection(collectionName).count().get();
        count = countSnapshot.data().count;
      } catch (err) {
        console.error(`Error counting documents for ${collectionName}:`, err);
      }
      
      return {
        name: collectionName,
        schema,
        count
      };
    }));
    
    return {
      collections: collectionData
    };
  } catch (error) {
    console.error('Error fetching Firestore collections:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch Firestore collections'
    });
  }
});
