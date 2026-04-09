import { defineEventHandler, readBody, createError } from 'h3';
import { getRedisClient, getUserStockViewsKey, getStockViewKey } from '../../utils/redis';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { id } = body;
    
    if (!id) {
      return {
        error: 'View ID is required',
        success: false
      };
    }
    
    // Get user ID from authentication context
    const user = event.context.user;
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }
    const userId = user._id.toString();
    
    const redis = getRedisClient();
    const viewsKey = getUserStockViewsKey(userId);
    const viewKey = getStockViewKey(userId, id);
    
    // Remove the view from the user's set of views
    await redis.srem(viewsKey, id);
    
    // Delete the view data
    await redis.del(viewKey);
    
    return {
      success: true,
      message: 'View deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting stock view:', error);
    return {
      error: 'Failed to delete stock view',
      success: false
    };
  }
});
