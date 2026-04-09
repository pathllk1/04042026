import { defineEventHandler, getQuery, createError } from 'h3';
import yahooFinance from 'yahoo-finance2';

export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event);
    const symbol = query.symbol as string;
    const period = query.period as string || '1y'; // Default to 1 year
    const interval = query.interval as string || '1d'; // Default to daily data
    
    if (!symbol) {
      throw createError({
        statusCode: 400,
        message: 'Symbol parameter is required'
      });
    }
    
    // Add .NS suffix if not already present (for NSE stocks)
    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
    
    // Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    // Valid intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
    
    // Fetch historical data
    const historicalData = await yahooFinance.historical(yahooSymbol, {
      period1: getStartDate(period),
      period2: new Date(),
      interval: interval
    });
    
    // Format the data for chart display
    const chartData = historicalData.map(item => ({
      date: item.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      adjClose: item.adjClose
    }));
    
    return {
      symbol: symbol,
      period: period,
      interval: interval,
      data: chartData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch historical data: ${error.message}`
    });
  }
});

// Helper function to calculate start date based on period
function getStartDate(period: string): Date {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case '1d':
      startDate.setDate(now.getDate() - 1);
      break;
    case '5d':
      startDate.setDate(now.getDate() - 5);
      break;
    case '1mo':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case '3mo':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case '6mo':
      startDate.setMonth(now.getMonth() - 6);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case '2y':
      startDate.setFullYear(now.getFullYear() - 2);
      break;
    case '5y':
      startDate.setFullYear(now.getFullYear() - 5);
      break;
    case '10y':
      startDate.setFullYear(now.getFullYear() - 10);
      break;
    case 'ytd':
      startDate.setMonth(0);
      startDate.setDate(1);
      break;
    case 'max':
      startDate.setFullYear(1970);
      break;
    default:
      startDate.setFullYear(now.getFullYear() - 1); // Default to 1 year
  }
  
  return startDate;
}
