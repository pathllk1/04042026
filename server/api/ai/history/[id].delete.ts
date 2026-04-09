// server/api/ai/history/[id].delete.ts
import { defineEventHandler, createError } from 'h3';
import AIHistory from '../../../models/AIHistory';
import { verifyToken } from '../../../utils/auth';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication
    const user = await verifyToken(event);
    
    // Get the ID from the URL parameter
    const id = event.context.params?.id;
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'History entry ID is required'
      });
    }
    
    // Validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid history entry ID format'
      });
    }

    // Only allow users to delete their own history entries
    const historyEntry = await AIHistory.findOne({ 
      _id: id, 
      userId: user._id 
    });

    if (!historyEntry) {
      throw createError({
        statusCode: 404,
        statusMessage: 'History entry not found or not authorized'
      });
    }

    // Delete the history entry
    await AIHistory.deleteOne({ _id: id, userId: user._id });

    // Return success response
    return { 
      success: true,
      message: 'History entry deleted successfully' 
    };
  } catch (error: any) {
    console.error('Error deleting history entry:', error);
    
    // Return appropriate error
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to delete history entry',
      cause: error
    });
  }
});
