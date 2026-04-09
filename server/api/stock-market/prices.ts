// server/api/stock-market/prices.ts
import { defineEventHandler, createError, getQuery } from 'h3';
import { Folio } from '../../models/Folio';

// Interface for price data
interface PriceData {
  currentPrice: number | null;
  previousClose: number | null;
}

// Function to fetch stock prices from Yahoo Finance
async function fetchYahooFinancePrice(symbol: string): Promise<PriceData> {
  try {
    // Add .NS suffix for Indian stocks on Yahoo Finance
    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;

    // Fetch data from Yahoo Finance API
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d`);

    if (!response.ok) {
      console.error(`Yahoo Finance API error for ${yahooSymbol}: ${response.statusText}`);
      return { currentPrice: null, previousClose: null };
    }

    const data = await response.json();

    // Extract the current price and previous close from the response
    if (data &&
        data.chart &&
        data.chart.result &&
        data.chart.result[0] &&
        data.chart.result[0].meta) {

      const meta = data.chart.result[0].meta;
      const currentPrice = meta.regularMarketPrice || null;
      const previousClose = meta.previousClose || meta.chartPreviousClose || null;

      return {
        currentPrice,
        previousClose
      };
    }

    console.error(`Could not find price data for ${yahooSymbol} in Yahoo Finance response`);
    return { currentPrice: null, previousClose: null };
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
    return { currentPrice: null, previousClose: null };
  }
}

// Function to update stock prices in the database
async function updateStockPricesInDatabase(updates: Array<{
  id: string,
  cprice: number,
  cval: number,
  pl: number,
  prevDayPrice: number,
  dayPL: number,
  dayPLPercentage: number
}>) {
  try {
    // Process updates in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Create an array of update operations
      const updateOperations = batch.map(update => {
        return {
          updateOne: {
            filter: { _id: update.id },
            update: {
              $set: {
                cprice: update.cprice,
                cval: update.cval,
                pl: update.pl,
                prevDayPrice: update.prevDayPrice,
                dayPL: update.dayPL,
                dayPLPercentage: update.dayPLPercentage,
                updatedAt: new Date()
              }
            }
          }
        };
      });

      // Execute the batch update
      if (updateOperations.length > 0) {
        await Folio.bulkWrite(updateOperations);
      }
    }

    return { success: true, updatedCount: updates.length };
  } catch (error) {
    console.error('Error updating stock prices in database:', error);
    throw error;
  }
}

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
    console.log(`Fetching current stock prices for user ID: ${userId}`);

    try {
      // Get query parameters
      const query = getQuery(event);
      const updateDatabase = query.updateDatabase === 'true';

      // Fetch all folio entries for the user
      const investments = await Folio.find({ user: userId }).lean();
      console.log(`Found ${investments.length} investments for user`);

      // Extract unique symbols
      const uniqueSymbols = [...new Set(investments.map(inv => inv.symbol))];
      console.log(`Processing ${uniqueSymbols.length} unique symbols`);

      // Fetch current prices for all symbols
      const priceUpdates: Record<string, number> = {};
      const failedSymbols: string[] = [];

      // Process symbols in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
        const symbolBatch = uniqueSymbols.slice(i, i + batchSize);

        // Fetch prices in parallel for the batch
        const priceFetchPromises = symbolBatch.map(async (symbol) => {
          const priceData = await fetchYahooFinancePrice(symbol);
          return { symbol, priceData };
        });

        const results = await Promise.all(priceFetchPromises);

        // Process results
        results.forEach(({ symbol, priceData }) => {
          if (priceData.currentPrice !== null) {
            priceUpdates[symbol] = {
              currentPrice: priceData.currentPrice,
              previousClose: priceData.previousClose
            };
          } else {
            failedSymbols.push(symbol);
          }
        });

        // Add a small delay between batches to avoid rate limiting
        if (i + batchSize < uniqueSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Successfully fetched prices for ${Object.keys(priceUpdates).length} symbols`);
      if (failedSymbols.length > 0) {
        console.warn(`Failed to fetch prices for ${failedSymbols.length} symbols:`, failedSymbols);
      }

      // Calculate updated values for each investment
      const investmentUpdates = investments.map(inv => {
        const priceData = priceUpdates[inv.symbol] || { currentPrice: inv.cprice || 0, previousClose: inv.prevDayPrice || inv.cprice || 0 };
        const currentPrice = priceData.currentPrice;
        const previousClose = priceData.previousClose || currentPrice; // Fallback to current price if no previous close

        const currentValue = currentPrice * inv.qnty;
        const profitLoss = currentValue - inv.namt;

        // Calculate daily gain/loss
        const dayPL = (currentPrice - previousClose) * inv.qnty;
        const dayPLPercentage = previousClose > 0 ? (dayPL / (previousClose * inv.qnty)) * 100 : 0.00;

        return {
          id: inv._id.toString(),
          symbol: inv.symbol,
          oldPrice: inv.cprice || 0,
          newPrice: currentPrice,
          cprice: currentPrice,
          cval: currentValue,
          pl: profitLoss,
          prevDayPrice: previousClose,
          dayPL: parseFloat(dayPL.toFixed(2)),
          dayPLPercentage: parseFloat(dayPLPercentage.toFixed(2)),
          changed: inv.cprice !== currentPrice || inv.prevDayPrice !== previousClose
        };
      });

      // Filter to only include investments with changed prices
      const changedInvestments = investmentUpdates.filter(inv => inv.changed);
      console.log(`${changedInvestments.length} investments have updated prices`);

      // Calculate total daily gain/loss
      let todayTotalPL = 0;
      let totalCurrentValue = 0;
      let totalPreviousValue = 0;

      investmentUpdates.forEach(inv => {
        todayTotalPL += inv.dayPL;
        totalCurrentValue += inv.cval;
        totalPreviousValue += (inv.prevDayPrice * inv.qnty);
      });

      // Calculate daily gain/loss percentage
      let todayPLPercentage = 0.00;
      if (totalPreviousValue > 0) {
        const rawPercentage = (todayTotalPL / totalPreviousValue) * 100;
        // Log the raw percentage for debugging
        console.log(`Raw percentage calculation: ${todayTotalPL} / ${totalPreviousValue} * 100 = ${rawPercentage}`);

        // Force a non-zero value for testing (even if very small)
        // This ensures we can see if the update mechanism is working
        if (Math.abs(rawPercentage) < 0.01 && rawPercentage !== 0) {
          // If the percentage is very small but not zero, preserve its sign
          todayPLPercentage = rawPercentage > 0 ? 0.01 : -0.01;
          console.log(`Very small percentage detected, setting to ${todayPLPercentage} for visibility`);
        } else {
          // Ensure we have at least 2 decimal places
          todayPLPercentage = parseFloat(rawPercentage.toFixed(2));
        }

        // Log the final percentage
        console.log(`Final percentage after formatting: ${todayPLPercentage}`);
      } else {
        console.log('Warning: totalPreviousValue is zero or negative, cannot calculate percentage');
      }

      // Update the database if requested
      let dbUpdateResult = null;
      if (updateDatabase && changedInvestments.length > 0) {
        try {
          dbUpdateResult = await updateStockPricesInDatabase(changedInvestments);
          console.log(`Updated ${dbUpdateResult.updatedCount} investments in the database`);
        } catch (dbError) {
          console.error('Failed to update database:', dbError);
          dbUpdateResult = { success: false, error: 'Failed to update database' };
        }
      }

      return {
        priceUpdates,
        failedSymbols,
        investmentUpdates,
        changedCount: changedInvestments.length,
        dbUpdateResult,
        summary: {
          todayTotalPL: parseFloat(todayTotalPL.toFixed(2)),
          todayPLPercentage: parseFloat(todayPLPercentage.toFixed(2)),
          totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
          totalPreviousValue: parseFloat(totalPreviousValue.toFixed(2))
        },
        timestamp: new Date().toISOString()
      };
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
    console.error(`Unhandled error in prices.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching stock prices: ${error.message || 'Unknown error'}`
    });
  }
});
