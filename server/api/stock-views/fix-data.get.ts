import { defineEventHandler, createError } from 'h3';
import { getRedisClient, getUserStockViewsKey, getStockViewKey } from '../../utils/redis';

// This is a temporary endpoint to fix corrupted data in Redis
export default defineEventHandler(async (event) => {
  try {
    console.log('Running fix-data endpoint to repair corrupted view data');

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
    console.log('Found view IDs:', viewIds);

    if (!viewIds || viewIds.length === 0) {
      return { message: 'No views found to fix' };
    }

    const results = [];

    // Fix each view
    for (const viewId of viewIds) {
      const viewKey = getStockViewKey(userId, viewId);
      const viewData = await redis.hgetall(viewKey);

      if (viewData && viewData.id) {
        // Check if symbols is a valid JSON string
        let symbols = [];
        let needsFix = false;

        try {
          // Try to parse the symbols
          if (viewData.symbols) {
            // Handle the case where symbols is already an array (not a string)
            if (Array.isArray(viewData.symbols)) {
              symbols = viewData.symbols;
              needsFix = true; // Need to fix because it should be a JSON string
            } else {
              symbols = JSON.parse(viewData.symbols);
            }
          }
        } catch (parseError) {
          needsFix = true;

          // Try to extract symbols from the invalid format
          if (typeof viewData.symbols === 'string') {
            // Handle the case where it's stored as [ 'SYMBOL' ]
            const matches = viewData.symbols.match(/'([^']+)'/g);
            if (matches) {
              symbols = matches.map(m => m.replace(/'/g, ''));
            }
            // Handle the case where it's stored as [] (empty array literal)
            else if (viewData.symbols === '[]') {
              symbols = [];
            }
          }
        }

        if (needsFix) {
          // Update the view with properly formatted JSON
          const properJson = JSON.stringify(symbols);
          await redis.hset(viewKey, { symbols: properJson });

          results.push({
            viewId,
            name: viewData.name,
            fixed: true,
            oldSymbols: viewData.symbols,
            newSymbols: properJson
          });
        } else {
          results.push({
            viewId,
            name: viewData.name,
            fixed: false,
            symbols: viewData.symbols
          });
        }
      }
    }

    return {
      message: 'Data fix completed',
      results
    };
  } catch (error) {
    console.error('Error fixing stock view data:', error);
    return {
      error: 'Failed to fix stock view data',
      message: error.message
    };
  }
});
