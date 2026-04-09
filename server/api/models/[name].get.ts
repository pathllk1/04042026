import { defineEventHandler, createError, getQuery } from 'h3';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can access model data'
      });
    }

    // Get model name from the URL parameter
    const modelName = event.context.params.name;

    // Check if the model exists
    if (!mongoose.modelNames().includes(modelName)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Model '${modelName}' not found`
      });
    }

    // Get the model
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

    // Get query parameters
    const query = getQuery(event);
    const limit = query.limit ? parseInt(query.limit) : 1000; // Default to 1000 records, but allow override

    // Fetch documents with the specified limit
    const documents = await model.find().limit(limit).lean();

    return {
      name: modelName,
      schema: schemaInfo,
      data: documents,
      total: await model.countDocuments()
    };
  } catch (error) {
    console.error(`Error fetching data for model:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch model data'
    });
  }
});
