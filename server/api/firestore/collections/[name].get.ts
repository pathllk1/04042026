import { defineEventHandler, createError, getQuery } from 'h3';
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

    // Get collection name from the URL parameter
    const collectionName = event.context.params.name;
    
    // Get query parameters
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit) : 1000; // Default to 1000 records
    
    const db = getFirestore();
    
    // Check if the collection exists
    const collections = await db.listCollections();
    const collectionExists = collections.some(col => col.id === collectionName);
    
    if (!collectionExists) {
      throw createError({
        statusCode: 404,
        statusMessage: `Collection '${collectionName}' not found`
      });
    }
    
    // Get the collection reference
    const collectionRef = db.collection(collectionName);
    
    // Fetch documents with the specified limit
    const snapshot = await collectionRef.limit(limit).get();
    
    // Process documents
    const documents = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Convert Firestore Timestamps to ISO strings for easier handling in the frontend
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
    
    // Extract schema from the first document
    let schema = {};
    
    if (documents.length > 0) {
      const sampleDoc = documents[0];
      
      // Create a schema from the document fields
      Object.keys(sampleDoc).forEach(field => {
        const value = sampleDoc[field];
        let type = typeof value;
        
        // Handle special types
        if (value && typeof value === 'object') {
          if (value instanceof Date) {
            type = 'date';
          } else if (Array.isArray(value)) {
            type = 'array';
          }
        }
        
        schema[field] = { type };
      });
    }
    
    // Count total documents in the collection
    const countSnapshot = await collectionRef.count().get();
    const totalCount = countSnapshot.data().count;
    
    return {
      name: collectionName,
      schema,
      data: documents,
      total: totalCount
    };
  } catch (error) {
    console.error('Error fetching Firestore collection data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch Firestore collection data'
    });
  }
});
