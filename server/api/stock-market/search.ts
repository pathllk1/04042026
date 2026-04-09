import { defineEventHandler, getQuery, createError } from 'h3';
import yahooFinance from 'yahoo-finance2';

export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event);
    const searchTerm = query.q as string;

    if (!searchTerm || searchTerm.length < 2) {
      throw createError({
        statusCode: 400,
        message: 'Search term must be at least 2 characters'
      });
    }

    try {
      // Search for stocks
      const searchResults = await yahooFinance.search(searchTerm);

      // Check if quotes property exists
      if (!searchResults.quotes || !Array.isArray(searchResults.quotes)) {
        return {
          results: [],
          count: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Filter for Indian stocks (NSE and BSE) but also include major global stocks
      const indianStocks = searchResults.quotes.filter((quote: any) =>
        (quote as any).exchange === 'NSI' || // NSE
        (quote as any).exchange === 'BSE' || // BSE
        (quote as any).symbol?.endsWith('.NS') ||
        (quote as any).symbol?.endsWith('.BO')
      );
      
      // If no Indian stocks found, include global stocks but limit them
      const globalStocks = indianStocks.length === 0 ? 
        searchResults.quotes.filter((quote: any) => 
          (quote as any).exchange && 
          !(quote as any).symbol?.includes('=') && // Exclude currency pairs
          (quote as any).quoteType === 'EQUITY' // Only equity stocks
        ).slice(0, 10) : [];
      
      const allStocks = [...indianStocks, ...globalStocks];
      
      console.log(`Found ${indianStocks.length} Indian stocks and ${globalStocks.length} global stocks for "${searchTerm}"`);

      // Format the results
      const formattedResults = allStocks.map((quote: any) => ({
        symbol: (quote as any).symbol?.replace('.NS', '').replace('.BO', '') || searchTerm.toUpperCase(),
        name: (quote as any).shortname || (quote as any).longname || (quote as any).displayName || `${searchTerm.toUpperCase()} Stock`,
        shortname: (quote as any).shortname,
        longname: (quote as any).longname,
        exchange: (quote as any).exchange || 'Unknown',
        type: (quote as any).quoteType || 'EQUITY',
        fullSymbol: (quote as any).symbol || `${searchTerm.toUpperCase()}.NS`,
        isGlobal: !indianStocks.includes(quote)
      }));

      // If no results found, try more comprehensive search
      if (formattedResults.length === 0) {
        console.log(`No initial results found for "${searchTerm}", trying fallback searches...`);
        
        // Try multiple variations
        const variations = [
          `${searchTerm.toUpperCase()}.NS`,
          `${searchTerm.toUpperCase()}.BO`,
          searchTerm.toUpperCase()
        ];
        
        for (const variation of variations) {
          try {
            console.log(`Trying quote lookup for: ${variation}`);
            const quote = await yahooFinance.quote(variation);
            
            if (quote && quote.symbol) {
              console.log(`Found quote for ${variation}:`, {
                symbol: quote.symbol,
                name: quote.longName || quote.shortName,
                price: quote.regularMarketPrice
              });
              
              formattedResults.push({
                symbol: quote.symbol.replace(/\.(NS|BO)$/i, ''),
                name: quote.longName || quote.shortName || quote.displayName || `${searchTerm.toUpperCase()} Stock`,
                shortname: quote.shortName,
                longname: quote.longName,
                exchange: quote.symbol.includes('.NS') ? 'NSE' : (quote.symbol.includes('.BO') ? 'BSE' : 'NSE'),
                type: 'EQUITY',
                fullSymbol: quote.symbol,
                isGlobal: false
              });
              break; // Found one, stop trying
            }
          } catch (err) {
            console.log(`No data found for variation: ${variation}`);
          }
        }
      }

      console.log(`Returning ${formattedResults.length} total results for "${searchTerm}"`);
      
      return {
        results: formattedResults,
        count: formattedResults.length,
        searchTerm,
        timestamp: new Date().toISOString()
      };
    } catch (searchError: any) {
      console.error('Error in Yahoo Finance search:', searchError);

      // Return empty results instead of throwing an error
      return {
        results: [],
        count: 0,
        error: (searchError as any)?.message || 'Search failed',
        timestamp: new Date().toISOString()
      };
    }
  } catch (error: any) {
    console.error('Error processing search request:', error);

    // Return empty results with error message
    return {
      results: [],
      count: 0,
      error: (error as any)?.message || 'An unknown error occurred',
      timestamp: new Date().toISOString()
    };
  }
});
