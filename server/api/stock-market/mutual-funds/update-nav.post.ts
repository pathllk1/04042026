// server/api/stock-market/mutual-funds/update-nav.post.ts
import { defineEventHandler, readBody, createError } from 'h3';
import { MutualFund } from '../../../models/MutualFund';

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
    
    // Read request body
    const body = await readBody(event);
    
    // Validate required fields
    if (!body.mutualFundId || !body.currentNAV) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: mutualFundId and currentNAV are required'
      });
    }
    
    // Find the mutual fund
    const mutualFund = await MutualFund.findOne({ 
      _id: body.mutualFundId,
      user: userId 
    });
    
    if (!mutualFund) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mutual fund not found'
      });
    }
    
    // Store previous NAV for day P/L calculation
    const prevNAV = mutualFund.currentNAV || mutualFund.purchaseNAV;
    
    // Update NAV and calculate new values
    mutualFund.prevDayNAV = prevNAV;
    mutualFund.currentNAV = body.currentNAV;
    mutualFund.currentValue = body.currentNAV * mutualFund.units;
    mutualFund.profitLoss = mutualFund.currentValue - mutualFund.investmentAmount;
    mutualFund.profitLossPercentage = (mutualFund.profitLoss / mutualFund.investmentAmount) * 100;
    
    // Calculate day's P/L
    mutualFund.dayPL = (body.currentNAV - prevNAV) * mutualFund.units;
    mutualFund.dayPLPercentage = ((body.currentNAV - prevNAV) / prevNAV) * 100;
    
    // Update last NAV update timestamp
    mutualFund.lastNAVUpdate = new Date();
    
    // Save changes
    await mutualFund.save();
    
    console.log(`Updated NAV for mutual fund ${mutualFund.schemeName} (${mutualFund._id}): ${prevNAV} -> ${body.currentNAV}`);
    
    return {
      success: true,
      message: 'Mutual fund NAV updated successfully',
      mutualFund
    };
    
  } catch (err) {
    const error = err as Error;
    console.error(`Error updating mutual fund NAV: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error updating mutual fund NAV: ${error.message || 'Unknown error'}`
    });
  }
});
