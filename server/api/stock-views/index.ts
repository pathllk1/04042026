import { defineEventHandler, getQuery, readBody, createError } from 'h3';
import { v4 as uuidv4 } from 'uuid';
import { getRedisClient, getUserStockViewsKey, getStockViewKey } from '../../utils/redis';

// Interface for stock view
interface StockView {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

// Get all stock views for a user
export default defineEventHandler(async (event) => {
  try {
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

    // Get all view IDs for the user
    const viewIds = await redis.smembers(viewsKey);

    // If no views exist, return an empty array
    if (!viewIds || viewIds.length === 0) {
      return { views: [] };
    }

    // Get all views data
    const views: StockView[] = [];
    for (const viewId of viewIds) {
      const viewKey = getStockViewKey(userId, viewId);
      const viewData = await redis.hgetall(viewKey);

      if (viewData && viewData.id) {
        // Parse symbols from JSON string
        let symbols = [];
        try {
          if (viewData.symbols) {
            // Handle the case where symbols is already an array (not a string)
            if (Array.isArray(viewData.symbols)) {
              symbols = viewData.symbols;
            } else if (viewData.symbols === '[]') {
              // Handle the case where it's stored as [] (empty array literal)
              symbols = [];
            } else if (typeof viewData.symbols === 'string') {
              // Try to parse as JSON
              try {
                symbols = JSON.parse(viewData.symbols);
              } catch (jsonError) {
                // If it fails, check if it's a string representation of an array with single quotes
                if (viewData.symbols.startsWith('[') && viewData.symbols.endsWith(']')) {
                  // Try to extract symbols from the string representation
                  const matches = viewData.symbols.match(/'([^']+)'/g);
                  if (matches) {
                    symbols = matches.map(m => m.replace(/'/g, ''));
                  }
                }
              }
            }
          }
        } catch (parseError) {
          // Continue with empty symbols array
        }

        views.push({
          id: viewData.id,
          name: viewData.name,
          symbols,
          createdAt: viewData.createdAt,
          updatedAt: viewData.updatedAt
        });
      }
    }

    // Sort views by creation date (newest first)
    views.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { views };
  } catch (error) {
    console.error('Error fetching stock views:', error);
    return {
      error: 'Failed to fetch stock views',
      views: []
    };
  }
});
