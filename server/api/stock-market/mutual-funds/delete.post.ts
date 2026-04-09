// server/api/stock-market/mutual-funds/delete.post.ts
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
    if (!body.mutualFundId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: mutualFundId'
      });
    }
    
    // Find and delete the mutual fund
    const result = await MutualFund.deleteOne({ 
      _id: body.mutualFundId,
      user: userId 
    });
    
    if (result.deletedCount === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mutual fund not found or you do not have permission to delete it'
      });
    }
    
    console.log(`Deleted mutual fund ${body.mutualFundId} for user ${userId}`);
    
    return {
      success: true,
      message: 'Mutual fund deleted successfully'
    };
    
  } catch (err) {
    const error = err as Error;
    console.error(`Error deleting mutual fund: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error deleting mutual fund: ${error.message || 'Unknown error'}`
    });
  }
});
