// server/api/firms/signup.ts
import { defineEventHandler, readBody, createError } from 'h3';
import Firm from '../../models/Firm';

/**
 * Special endpoint for creating firms during signup
 * This endpoint doesn't require authentication
 */
export default defineEventHandler(async (event) => {

  try {
    // Only allow POST method
    if (event.node.req.method !== 'POST') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      });
    }

    // Get firm data from request body
    const firmData = await readBody(event);

    // Validate required fields
    if (!firmData.name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm name is required'
      });
    }

    // Generate a code from the name (first 3 characters + random 3 digits)
    if (!firmData.code) {
      firmData.code = `${firmData.name.substring(0, 3).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    }

    // Check if firm with same name already exists
    const existingFirm = await Firm.findOne({ name: firmData.name });
    if (existingFirm) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A firm with this name already exists'
      });
    }

    // Set status to pending by default
    firmData.status = 'pending';

    // Create the new firm
    const firm = new Firm(firmData);
    await firm.save();


    // Return success response
    return {
      statusCode: 201,
      statusMessage: 'Firm created successfully',
      firm
    };
  } catch (error: any) {
    console.error('Error creating firm during signup:', error);

    // Return error response
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    });
  }
});
