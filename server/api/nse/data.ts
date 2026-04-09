import { defineEventHandler, createError } from 'h3';
import { NSE } from '../../models/NSE';
import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Verify user authentication
    const user = await verifyToken(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Fetch NSE data with specific fields
    const nseData = await NSE.find({}, {
      SYMBOL: 1,
      SERIES: 1,
      DATE1: 1,
      PREV_CLOSE: 1,
      OPEN_PRICE: 1,
      HIGH_PRICE: 1,
      LOW_PRICE: 1,
      LAST_PRICE: 1,
      CLOSE_PRICE: 1,
      AVG_PRICE: 1,
      TTL_TRD_QNTY: 1,
      TURNOVER_LACS: 1,
      NO_OF_TRADES: 1,
      DELIV_QTY: 1,
      DELIV_PER: 1
    }).sort({ DATE1: -1 });

    // Fetch folio data for the user
    const folioData = await Folio.find({ user: user._id });

    // Calculate investment values
    const totalInvestment = folioData.reduce((sum, item) => sum + Number(item.namt || 0), 0);
    const currentValue = folioData.reduce((sum, item) => sum + Number(item.cval || 0), 0);
    const overallGain = currentValue - totalInvestment;

    // Calculate price changes for top gainers and losers
    const priceChanges = nseData.map(item => {
      const currentPrice = Number(item.CLOSE_PRICE);
      const prevClose = Number(item.PREV_CLOSE);
      const difference = currentPrice - prevClose;
      const percentageChange = (difference / prevClose) * 100;

      return {
        symbol: item.SYMBOL,
        currentPrice,
        prevClose,
        difference,
        percentageChange
      };
    });

    // Get top 5 gainers and losers
    const gainers = [...priceChanges]
      .filter(item => item.percentageChange > 0)
      .sort((a, b) => b.percentageChange - a.percentageChange)
      .slice(0, 5);

    const losers = [...priceChanges]
      .filter(item => item.percentageChange < 0)
      .sort((a, b) => a.percentageChange - b.percentageChange)
      .slice(0, 5);

    return {
      success: true,
      nseData,
      folioData,
      totalInvestment,
      currentValue,
      overallGain,
      gainers,
      losers
    };
  } catch (error) {
    console.error('Error fetching NSE data:', error);
    throw createError({
      statusCode: 500,
      message: `Error fetching NSE data: ${error.message}`
    });
  }
});