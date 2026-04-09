import { defineEventHandler, getQuery, createError } from 'h3';
import yahooFinance from 'yahoo-finance2';

// Define interfaces for Yahoo Finance API responses
interface YahooQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  currency?: string;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
}

interface YahooSummaryDetail {
  regularMarketPrice?: { raw?: number };
  regularMarketChange?: { raw?: number };
  regularMarketChangePercent?: { raw?: number };
  volume?: { raw?: number };
  fiftyTwoWeekHigh?: { raw?: number };
  fiftyTwoWeekLow?: { raw?: number };
  marketCap?: { raw?: number };
  dayHigh?: { raw?: number };
  dayLow?: { raw?: number };
  open?: { raw?: number };
  previousClose?: { raw?: number };
  averageVolume?: { raw?: number };
  averageDailyVolume10Day?: { raw?: number };
  beta?: { raw?: number };
  trailingPE?: { raw?: number };
  trailingEps?: { raw?: number };
  epsTrailingTwelveMonths?: { raw?: number };
}

interface YahooAssetProfile {
  industry?: string;
  sector?: string;
  website?: string;
  fullTimeEmployees?: number | string;
  longBusinessSummary?: string;
  country?: string;
  state?: string;
  city?: string;
  address1?: string;
  phone?: string;
}

interface YahooFinancialData {
  recommendationKey?: string;
}

interface YahooQuoteSummary {
  price?: Record<string, any>;
  summaryDetail?: YahooSummaryDetail;
  assetProfile?: YahooAssetProfile;
  financialData?: YahooFinancialData;
}

// Define interfaces for our response objects
interface StockData {
  symbol: string;
  meta: {
    companyName: string;
  };
  lastPrice?: number;
  change?: number;
  pChange?: number;
  totalTradedVolume?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
}

// List of major Indian stocks with their Yahoo Finance symbols
const INDIAN_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd.' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd.' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd.' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever Ltd.' },
  { symbol: 'SBIN.NS', name: 'State Bank of India' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance Ltd.' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Ltd.' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank Ltd.' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints Ltd.' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India Ltd.' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies Ltd.' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank Ltd.' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical Industries Ltd.' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd.' },
  { symbol: 'WIPRO.NS', name: 'Wipro Ltd.' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises Ltd.' },
  { symbol: 'BAJAJFINSV.NS', name: 'Bajaj Finserv Ltd.' },
  { symbol: 'TITAN.NS', name: 'Titan Company Ltd.' }
];

// List of major Indian indices with their Yahoo Finance symbols
const INDIAN_INDICES = [
  { symbol: '^NSEI', name: 'NIFTY 50' },
  { symbol: '^BSESN', name: 'SENSEX' },
  { symbol: '^NSEBANK', name: 'NIFTY BANK' },
  { symbol: '^CNXIT', name: 'NIFTY IT' },
  { symbol: '^CNXAUTO', name: 'NIFTY AUTO' },
  { symbol: '^CNXSC', name: 'NIFTY SMALLCAP 100' },
  { symbol: 'NIFTY_MIDCAP_100.NS', name: 'NIFTY MIDCAP 100' }
];

// This endpoint will provide real stock market data from Yahoo Finance
export default defineEventHandler(async (event) => {
  try {
    // Get query parameters
    const query = getQuery(event);
    const symbol = query.symbol as string;

    // If a specific symbol is requested, fetch details for that symbol
    if (symbol) {
      try {
        // Add .NS suffix if not already present (for NSE stocks)
        const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;

        // Fetch quote data
        const quote = await yahooFinance.quote(yahooSymbol) as YahooQuote;

        // Fetch additional information
        const quoteSummary = await yahooFinance.quoteSummary(yahooSymbol, {
          modules: ['price', 'summaryDetail', 'assetProfile', 'financialData']
        }) as YahooQuoteSummary;

        // Get additional data from summary modules
        const priceData = quoteSummary.price || {};
        const summaryData = quoteSummary.summaryDetail || {} as YahooSummaryDetail;
        const profileData = quoteSummary.assetProfile || {} as YahooAssetProfile;
        const financialData = quoteSummary.financialData || {} as YahooFinancialData;

        // Format the data in a more user-friendly structure
        return {
          quote: {
            info: {
              symbol: quote.symbol,
              companyName: quote.longName || quote.shortName || symbol,
              industry: profileData.industry || 'Financial Services',
              lastPrice: quote.regularMarketPrice || summaryData.regularMarketPrice?.raw,
              change: quote.regularMarketChange || summaryData.regularMarketChange?.raw || 0,
              pChange: quote.regularMarketChangePercent || summaryData.regularMarketChangePercent?.raw || 0,
              totalTradedVolume: quote.regularMarketVolume || summaryData.volume?.raw,
              yearHigh: quote.fiftyTwoWeekHigh || summaryData.fiftyTwoWeekHigh?.raw,
              yearLow: quote.fiftyTwoWeekLow || summaryData.fiftyTwoWeekLow?.raw,
              marketCap: quote.marketCap || summaryData.marketCap?.raw,
              currency: quote.currency || 'INR'
            }
          },
          tradeInfo: {
            totalTradedVolume: quote.regularMarketVolume || summaryData.volume?.raw,
            totalTradedValue: ((quote.regularMarketVolume || summaryData.volume?.raw) || 0) * (quote.regularMarketPrice || summaryData.regularMarketPrice?.raw || 0),
            totalMarketCap: quote.marketCap || summaryData.marketCap?.raw,
            dayHigh: quote.regularMarketDayHigh || summaryData.dayHigh?.raw,
            dayLow: quote.regularMarketDayLow || summaryData.dayLow?.raw,
            open: quote.regularMarketOpen || summaryData.open?.raw,
            previousClose: quote.regularMarketPreviousClose || summaryData.previousClose?.raw,
            averageVolume: summaryData.averageVolume?.raw || summaryData.averageDailyVolume10Day?.raw,
            beta: summaryData.beta?.raw,
            pe: summaryData.trailingPE?.raw || priceData.trailingPE?.raw,
            eps: summaryData.trailingEps?.raw || summaryData.epsTrailingTwelveMonths?.raw
          },
          companyInfo: {
            industry: profileData.industry || 'Financial Services',
            sector: profileData.sector || 'Financial',
            website: profileData.website || `https://www.google.com/search?q=${encodeURIComponent(symbol)}`,
            fullTimeEmployees: profileData.fullTimeEmployees || 'Not Available',
            businessSummary: profileData.longBusinessSummary || `${symbol} is a publicly traded company in India.`,
            country: profileData.country || 'India',
            state: profileData.state || 'Delhi',
            city: profileData.city || 'New Delhi',
            address: profileData.address1 || 'Not Available',
            phone: profileData.phone || 'Not Available',
            recommendationKey: financialData.recommendationKey || 'hold'
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error(`Error fetching details for ${symbol}:`, error);
        return {
          error: `Failed to fetch details for ${symbol}. Please check if the symbol is correct.`,
          timestamp: new Date().toISOString()
        };
      }
    }

    // For market overview, fetch data for all stocks and indices
    try {
      // Fetch quotes for all indices
      const indicesQuotes = await yahooFinance.quote(INDIAN_INDICES.map(index => index.symbol)) as YahooQuote[] | YahooQuote;

      // Format indices data
      const indices = Array.isArray(indicesQuotes)
        ? indicesQuotes.map((quote: YahooQuote) => ({
            indexName: INDIAN_INDICES.find(index => index.symbol === quote.symbol)?.name || quote.shortName,
            symbol: quote.symbol,
            last: quote.regularMarketPrice,
            percentChange: quote.regularMarketChangePercent,
            change: quote.regularMarketChange,
            open: quote.regularMarketOpen,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            previousClose: quote.regularMarketPreviousClose
          }))
        : []; // Handle case where only one index is returned

      // Fetch quotes for all stocks
      const stocksQuotes = await yahooFinance.quote(INDIAN_STOCKS.map(stock => stock.symbol)) as YahooQuote[] | YahooQuote;

      // Format stocks data
      const stocks: StockData[] = Array.isArray(stocksQuotes)
        ? stocksQuotes.map((quote: YahooQuote) => ({
            symbol: quote.symbol.replace('.NS', ''),
            meta: {
              companyName: INDIAN_STOCKS.find(stock => stock.symbol === quote.symbol)?.name || quote.longName || quote.shortName || quote.symbol
            },
            lastPrice: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            pChange: quote.regularMarketChangePercent,
            totalTradedVolume: quote.regularMarketVolume,
            open: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            previousClose: quote.regularMarketPreviousClose
          }))
        : [];

      // Sort by percent change to get gainers and losers
      const gainers = [...stocks]
        .filter(stock => stock.pChange !== undefined && stock.pChange > 0)
        .sort((a, b) => {
          const aPChange = a.pChange || 0;
          const bPChange = b.pChange || 0;
          return bPChange - aPChange;
        })
        .slice(0, 5);

      const losers = [...stocks]
        .filter(stock => stock.pChange !== undefined && stock.pChange < 0)
        .sort((a, b) => {
          const aPChange = a.pChange || 0;
          const bPChange = b.pChange || 0;
          return aPChange - bPChange;
        })
        .slice(0, 5);

      const result = {
        indices,
        nifty50: stocks,
        gainers,
        losers,
        timestamp: new Date().toISOString()
      };



      return result;
    } catch (error) {
      console.error('Error fetching market overview:', error);
      throw error; // Re-throw to be caught by the outer catch block
    }
  } catch (error) {
    console.error('Error fetching stock market data:', error);

    // Return error response - no fallback data
    throw createError({
      statusCode: 503,
      statusMessage: 'Stock market data service unavailable. Yahoo Finance API is not accessible.'
    });
  }
});


