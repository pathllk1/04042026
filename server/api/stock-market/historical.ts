// server/api/stock-market/historical.ts
import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event);
    const symbol = (query.symbol as string) || '^NSEI'; // Default to NIFTY 50 index
    const interval = (query.interval as string) || '1mo'; // Default to monthly data

    console.log(`Fetching historical data for symbol: ${symbol} with interval: ${interval}`);

    // Calculate date range based on interval
    const endDate = new Date();
    const startDate = new Date();

    // Determine appropriate time range based on interval
    if (interval === '1d') {
      // For daily data, go back 3 months to ensure we have enough data
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (interval === '1wk') {
      // For weekly data, go back 1 year
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      // For monthly data, go back 2 years to ensure we have enough data
      startDate.setFullYear(startDate.getFullYear() - 2);
    }

    // Convert dates to Unix timestamps (seconds)
    const period1 = Math.floor(startDate.getTime() / 1000);
    const period2 = Math.floor(endDate.getTime() / 1000);

    // Construct Yahoo Finance API URL
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}&events=history`;

    console.log(`Requesting data from: ${url}`);

    // Fetch data from Yahoo Finance with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check if we have valid data
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Yahoo Finance API returned empty or invalid data');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    if (!timestamps || !quotes || timestamps.length === 0) {
      throw new Error('Yahoo Finance API returned empty timestamps or quotes');
    }

    // Process the data into a more usable format
    const prices = timestamps.map((timestamp: number, index: number) => {
      return {
        date: new Date(timestamp * 1000).toISOString(),
        open: quotes.open[index],
        high: quotes.high[index],
        low: quotes.low[index],
        close: quotes.close[index],
        volume: quotes.volume[index]
      };
    }).filter((item: any) => item.close !== null); // Filter out any null values

    console.log(`Successfully processed ${prices.length} data points for ${symbol}`);

    return {
      success: true,
      symbol,
      interval,
      prices,
      source: 'yahoo'
    };
  } catch (error: any) {
    console.error('Error in historical data endpoint:', error);

    // Return error response
    return {
      success: false,
      error: error.message || 'Failed to fetch historical data',
      symbol: (getQuery(event).symbol as string) || '^NSEI',
      interval: (getQuery(event).interval as string) || '1mo'
    };
  }
});
