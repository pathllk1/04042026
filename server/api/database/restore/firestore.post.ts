import { defineEventHandler, createError, readMultipartFormData } from 'h3';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can restore Firestore data'
      });
    }

    // Read the multipart form data (file upload)
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file uploaded'
      });
    }

    // Get the uploaded file
    const file = formData.find(part => part.name === 'file');
    if (!file || !file.filename) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file upload'
      });
    }

    // Check file type
    const fileExt = path.extname(file.filename).toLowerCase();
    if (fileExt !== '.json') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Only JSON files are supported for restore'
      });
    }

    // Get collection name from form data
    const collectionNamePart = formData.find(part => part.name === 'collectionName');
    if (!collectionNamePart) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Collection name is required'
      });
    }

    const collectionName = Buffer.from(collectionNamePart.data).toString('utf8');

    // Parse the JSON data
    let jsonData;
    try {
      jsonData = JSON.parse(Buffer.from(file.data).toString('utf8'));
    } catch (err) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid JSON file'
      });
    }

    // Validate that the data is an array
    if (!Array.isArray(jsonData)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'JSON file must contain an array of documents'
      });
    }

    // Get Firestore instance
    const db = getFirestore();
    
    // Get the collection reference
    const collectionRef = db.collection(collectionName);

    // Get restore mode from form data (replace or merge)
    const modePart = formData.find(part => part.name === 'mode');
    const mode = modePart ? Buffer.from(modePart.data).toString('utf8') : 'merge';

    // Process based on mode
    if (mode === 'replace') {
      // Clear the collection first
      const batch = db.batch();
      const snapshot = await collectionRef.get();
      
      // Delete all existing documents
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    }

    // Process documents in batches (Firestore has a limit of 500 operations per batch)
    const batchSize = 400;
    let operationCount = 0;
    let batch = db.batch();
    
    for (const doc of jsonData) {
      if (!doc.id) {
        continue; // Skip documents without ID
      }
      
      const docRef = collectionRef.doc(doc.id);
      
      // Remove the id field from the data
      const { id, ...data } = doc;
      
      // Convert ISO date strings back to Firestore timestamps
      const processedData = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
          try {
            // Try to convert ISO string to Firestore timestamp
            processedData[key] = new Date(value);
          } catch (e) {
            processedData[key] = value;
          }
        } else {
          processedData[key] = value;
        }
      });
      
      if (mode === 'merge') {
        batch.set(docRef, processedData, { merge: true });
      } else {
        batch.set(docRef, processedData);
      }
      
      operationCount++;
      
      // Commit when batch size is reached
      if (operationCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      collection: collectionName,
      mode,
      count: jsonData.length,
      message: `Successfully restored data to ${collectionName}`
    };
  } catch (error) {
    console.error('Firestore restore error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to restore Firestore data',
      data: error
    });
  }
});
