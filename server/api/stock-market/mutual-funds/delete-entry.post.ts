import { defineEventHandler, readBody, createError } from 'h3';
import { MutualFund } from '../../../models/MutualFund';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const user = event.context.user;
    if (!user) {
      console.error('Authentication error: User not authenticated');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }

    // Get the user ID from the authenticated user
    const userId = user._id.toString();
    
    // Read request body
    const body = await readBody(event);
    
    // Validate required fields
    if (!body.entryId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: entryId'
      });
    }
    
    // Find and delete the mutual fund entry
    const result = await MutualFund.findOneAndDelete({ 
      _id: body.entryId,
      user: userId 
    });
    
    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mutual fund entry not found or you do not have permission to delete it'
      });
    }
    
    console.log(`Deleted mutual fund entry ${body.entryId} for user ${userId}`);
    
    return {
      success: true,
      message: 'Mutual fund entry deleted successfully'
    };
    
  } catch (err) {
    const error = err as Error;
    console.error(`Error deleting mutual fund entry: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error deleting mutual fund entry: ${error.message || 'Unknown error'}`
    });
  }
}); 