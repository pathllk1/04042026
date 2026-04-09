import { defineEventHandler, readBody, createError } from 'h3';
import { getRedisClient, getStockViewKey } from '../../utils/redis';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { id, name, symbols, action, symbol } = body;

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
    const viewKey = getStockViewKey(userId, id);

    // Get the current view data
    const viewData = await redis.hgetall(viewKey);

    if (!viewData || !viewData.id) {
      return {
        error: 'View not found',
        success: false
      };
    }

    // Parse the current symbols
    let currentSymbols = [];
    try {
      if (viewData.symbols) {
        if (Array.isArray(viewData.symbols)) {
          // If it's already an array, use it directly
          currentSymbols = viewData.symbols;
          console.log('Symbols is already an array:', currentSymbols);
        } else if (typeof viewData.symbols === 'string') {
          try {
            // Try to parse as JSON
            currentSymbols = JSON.parse(viewData.symbols);
            console.log('Parsed symbols from JSON:', currentSymbols);

            // Ensure it's an array
            if (!Array.isArray(currentSymbols)) {
              console.error('Parsed symbols is not an array:', currentSymbols);
              currentSymbols = [];
            }
          } catch (jsonError) {
            console.error('Failed to parse symbols JSON:', jsonError);
            // Try to extract from string representation
            if (viewData.symbols.startsWith('[') && viewData.symbols.endsWith(']')) {
              const matches = viewData.symbols.match(/'([^']+)'/g);
              if (matches) {
                currentSymbols = matches.map(m => m.replace(/'/g, ''));
                console.log('Extracted symbols from string representation:', currentSymbols);
              }
            }
          }
        } else {
          console.error('Symbols is neither an array nor a string:', viewData.symbols);
        }
      }
    } catch (parseError) {
      console.error('Error parsing symbols:', parseError);
      // Continue with empty symbols array
    }

    // Ensure currentSymbols is an array
    if (!Array.isArray(currentSymbols)) {
      console.error('currentSymbols is not an array after parsing, resetting to empty array');
      currentSymbols = [];
    }

    // Handle different update actions
    console.log('Update action:', { action, symbol, currentSymbols });

    if (action === 'add' && symbol) {
      // Add a symbol if it doesn't already exist
      console.log('Before adding symbol:', { currentSymbols, symbol });
      if (!currentSymbols.includes(symbol)) {
        currentSymbols.push(symbol);
        console.log('After adding symbol:', currentSymbols);
      } else {
        console.log('Symbol already exists in view');
      }
    } else if (action === 'remove' && symbol) {
      // Remove a symbol
      console.log('Before removing symbol:', { currentSymbols, symbol });
      currentSymbols = currentSymbols.filter((s: string) => s !== symbol);
      console.log('After removing symbol:', currentSymbols);
    } else if (symbols) {
      // Replace all symbols
      console.log('Replacing all symbols:', { oldSymbols: currentSymbols, newSymbols: symbols });
      currentSymbols = symbols;
    }

    // Update the view data
    const updateData: Record<string, string> = {
      updatedAt: new Date().toISOString(),
      symbols: JSON.stringify(currentSymbols) // Ensure proper JSON format
    };

    // Update name if provided
    if (name) {
      updateData.name = name;
    }

    // Update the view in Redis
    await redis.hset(viewKey, updateData);

    // Return the updated view
    // Ensure symbols is an array before returning
    if (!Array.isArray(currentSymbols)) {
      console.error('currentSymbols is still not an array before returning, resetting to empty array');
      currentSymbols = [];
    }

    const updatedView = {
      ...viewData,
      ...updateData,
      symbols: currentSymbols
    };

    console.log('Returning updated view:', {
      id: updatedView.id,
      name: updatedView.name,
      symbolsCount: currentSymbols.length,
      symbols: currentSymbols,
      symbolsType: typeof currentSymbols,
      symbolsIsArray: Array.isArray(currentSymbols)
    });

    return {
      success: true,
      view: updatedView
    };
  } catch (error) {
    console.error('Error updating stock view:', error);
    return {
      error: 'Failed to update stock view',
      success: false
    };
  }
});
