import { defineEventHandler, getQuery, createError } from 'h3'
import yahooFinance from 'yahoo-finance2'

/**
 * Yahoo Finance Proxy API
 * 
 * This endpoint serves as a proxy for Yahoo Finance API calls to avoid CORS issues
 * when fetching data from the client side. It supports both historical data and quotes.
 * 
 * Query parameters:
 * - type: 'historical' or 'quote' (required)
 * - symbol: Stock symbol (required)
 * - period1: Start date for historical data (optional, ISO string)
 * - period2: End date for historical data (optional, ISO string)
 * - interval: Data interval (optional, default: '1d')
 * - days: Number of calendar days to fetch (optional, default: 600)
 */
export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event)
    const type = query.type as string
    const symbol = query.symbol as string
    
    if (!symbol) {
      throw createError({
        statusCode: 400,
        message: 'Symbol parameter is required'
      })
    }
    
    if (!type || (type !== 'historical' && type !== 'quote')) {
      throw createError({
        statusCode: 400,
        message: 'Type parameter is required and must be either "historical" or "quote"'
      })
    }
    
    // Add .NS suffix if not already present (for NSE stocks)
    const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
    
    // Handle different request types
    if (type === 'historical') {
      const interval = query.interval as string || '1d'
      const days = parseInt(query.days as string || '600')
      
      // Check if specific dates are provided
      let period1, period2
      
      if (query.period1) {
        period1 = new Date(query.period1 as string)
      } else {
        period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
      
      if (query.period2) {
        period2 = new Date(query.period2 as string)
      } else {
        period2 = new Date()
      }
      
      // Fetch historical data
      const historicalData = await yahooFinance.historical(yahooSymbol, {
        period1,
        period2,
        interval
      })
      
      // Format the data for chart display
      const chartData = historicalData.map(item => ({
        date: item.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        adjClose: item.adjClose
      }))
      
      return {
        success: true,
        symbol,
        yahooSymbol,
        interval,
        dataPoints: chartData.length,
        data: chartData,
        timestamp: new Date().toISOString()
      }
    } else if (type === 'quote') {
      // Fetch quote data
      const quote = await yahooFinance.quote(yahooSymbol)
      
      return {
        success: true,
        symbol,
        yahooSymbol,
        quote,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Error in Yahoo Finance proxy:', error)
    throw createError({
      statusCode: 500,
      message: `Failed to fetch data from Yahoo Finance: ${error.message}`
    })
  }
})
