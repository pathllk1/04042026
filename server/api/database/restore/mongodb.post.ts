import { defineEventHandler, createError, readMultipartFormData } from 'h3';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { Readable } from 'stream';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can restore database'
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

    // Get model name from form data
    const modelNamePart = formData.find(part => part.name === 'modelName');
    if (!modelNamePart) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Model name is required'
      });
    }

    const modelName = Buffer.from(modelNamePart.data).toString('utf8');

    // Optional flag to map Firestore 'id' field to Mongo '_id'
    const mapIdPart = formData.find(part => part.name === 'mapId');
    const mapId = mapIdPart ? Buffer.from(mapIdPart.data).toString('utf8') === 'true' : false;

    // Check if model exists
    if (!mongoose.modelNames().includes(modelName)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Model '${modelName}' not found`
      });
    }

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

    // Get the model
    const model = mongoose.model(modelName);

    // Get restore mode from form data (replace or merge)
    const modePart = formData.find(part => part.name === 'mode');
    const mode = modePart ? Buffer.from(modePart.data).toString('utf8') : 'merge';

    let result;

    // Optionally map 'id' to '_id' for each document
    let dataToImport: any[] = jsonData;
    if (mapId) {
      dataToImport = jsonData.map((doc: any) => {
        if (doc && doc.id && !doc._id) {
          const { id, ...rest } = doc;
          return { _id: id, ...rest };
        }
        return doc;
      });
    }

    // Model-specific transforms
    const adminUser: any = (event as any).context.user || {};
    if (modelName === 'SubsTxnMongo') {
      dataToImport = dataToImport.map((doc: any) => {
        const transformed = { ...doc };
        // Firestore field 'subId' -> Mongo expected 'subsModelId'
        if (!transformed.subsModelId && transformed.subId) {
          transformed.subsModelId = transformed.subId;
        }
        // Fill userId from createdBy or admin performing restore
        if (!transformed.userId) {
          if (transformed.createdBy) transformed.userId = transformed.createdBy;
          else if (adminUser?._id) transformed.userId = String(adminUser._id);
          else if (adminUser?.id) transformed.userId = String(adminUser.id);
        }
        // Map category -> type if needed
        if (!transformed.type && transformed.category) {
          const cat = String(transformed.category).toLowerCase();
          if (cat === 'payment' || cat === 'receipt') transformed.type = cat;
        }
        return transformed;
      });
    }

    // Process based on mode
    if (mode === 'replace') {
      // Clear the collection first
      await model.deleteMany({});
      
      // Insert all documents
      result = await model.insertMany(dataToImport);
    } else {
      // Merge mode - update existing documents and insert new ones
      const operations = [];
      
      for (const doc of dataToImport) {
        if (doc._id) {
          // If document has _id, use upsert
          operations.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: doc },
              upsert: true
            }
          });
        } else {
          // If no _id, just insert
          operations.push({
            insertOne: {
              document: doc
            }
          });
        }
      }
      
      if (operations.length > 0) {
        result = await model.bulkWrite(operations);
      }
    }

    return {
      success: true,
      model: modelName,
      mode,
      count: Array.isArray(result) ? result.length : (result?.upsertedCount + result?.modifiedCount + result?.insertedCount || dataToImport.length),
      message: `Successfully restored data to ${modelName}`
    };
  } catch (error) {
    console.error('Database restore error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to restore database',
      data: error
    });
  }
});
