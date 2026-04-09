import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import { connectDB } from '../../utils/dbConnect';

// Get all registered models in Mongoose
export default defineEventHandler(async (event) => {
  try {
    // Ensure database is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, attempting to connect...');
      await connectDB();
    }

    // Check connection state after connection attempt
    if (mongoose.connection.readyState !== 1) {
      throw createError({
        statusCode: 503, // Service Unavailable
        statusMessage: 'Database connection unavailable. Please try again later.'
      });
    }
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can access model information'
      });
    }

    // Get all registered models
    const modelNames = mongoose.modelNames();

    // Create an array of model information
    const models = await Promise.all(
      modelNames.map(async (modelName) => {
        const model = mongoose.model(modelName);

        // Get the schema paths (fields)
        const schema = model.schema.paths;
        const schemaInfo = {};

        // Extract field information
        Object.keys(schema).forEach(fieldName => {
          const field = schema[fieldName];
          schemaInfo[fieldName] = {
            type: field.instance,
            required: field.isRequired || false,
            default: field.defaultValue,
            ref: field.options?.ref || null
          };
        });

        // Count documents in the collection
        let count = 0;
        try {
          // Set a timeout for the count operation to prevent long-running queries
          const countPromise = model.countDocuments();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Count operation timed out')), 5000);
          });

          count = await Promise.race([countPromise, timeoutPromise]);
        } catch (err) {
          console.error(`Error counting documents for ${modelName}:`, err);
          // Return -1 to indicate count error in the response
          count = -1;
        }

        return {
          name: modelName,
          schema: schemaInfo,
          count
        };
      })
    );

    return { models };
  } catch (error) {
    console.error('Error fetching model information:', error);

    // Provide more specific error messages based on the error type
    if (error.name === 'MongooseError' || error.name === 'MongoError') {
      throw createError({
        statusCode: 503, // Service Unavailable
        statusMessage: 'Database service unavailable. Please try again later.',
        data: {
          error: error.message,
          code: error.code || 'UNKNOWN',
          type: 'DATABASE_ERROR'
        }
      });
    } else if (error.statusCode) {
      // Pass through H3 errors
      throw error;
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch model information',
        data: {
          error: error.message,
          type: 'SERVER_ERROR'
        }
      });
    }
  }
});
