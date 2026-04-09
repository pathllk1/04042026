import { defineEventHandler, readBody, createError } from 'h3';
import { v4 as uuidv4 } from 'uuid';
import { getRedisClient, getUserStockViewsKey, getStockViewKey } from '../../utils/redis';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { name, symbols = [] } = body;

    if (!name) {
      return {
        error: 'View name is required',
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

    // Get existing views to check if we've reached the limit
    const existingViews = await redis.smembers(viewsKey);
    if (existingViews && existingViews.length >= 10) {
      return {
        error: 'Maximum number of views (10) reached. Please delete a view before creating a new one.',
        success: false
      };
    }

    // Create a new view
    const viewId = uuidv4();
    const timestamp = new Date().toISOString();

    const viewKey = getStockViewKey(userId, viewId);

    // Ensure symbols is an array
    const symbolsArray = Array.isArray(symbols) ? symbols : [];

    // Store the view data with properly formatted JSON
    const symbolsJson = JSON.stringify(symbolsArray);

    await redis.hset(viewKey, {
      id: viewId,
      name,
      symbols: symbolsJson,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // Add the view ID to the user's set of views
    await redis.sadd(viewsKey, viewId);

    return {
      success: true,
      view: {
        id: viewId,
        name,
        symbols,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    };
  } catch (error) {
    console.error('Error creating stock view:', error);
    return {
      error: 'Failed to create stock view',
      success: false
    };
  }
});
