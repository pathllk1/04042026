import { defineEventHandler, createError } from 'h3';
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
    console.log(`Fetching raw mutual funds for user ID: ${userId}`);

    try {
      // Fetch all mutual fund entries for the user without consolidation
      const mutualFundsRaw = await MutualFund.find({ user: userId })
        .sort({ purchaseDate: -1 }) // Sort by purchase date, newest first
        .lean(); // Convert to plain JavaScript objects
      
      console.log(`Found ${mutualFundsRaw.length} raw mutual fund entries for user`);
      
      return mutualFundsRaw;
      
    } catch (dbError) {
      const error = dbError as Error;
      console.error(`Database error: ${error.message || 'Unknown database error'}`);
      console.error(error.stack || 'No stack trace available');
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message || 'Unknown database error'}`
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Unhandled error in mutual-funds/raw.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching raw mutual fund data: ${error.message || 'Unknown error'}`
    });
  }
}); 