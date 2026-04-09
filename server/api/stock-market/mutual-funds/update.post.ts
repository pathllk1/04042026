// server/api/stock-market/mutual-funds/update.post.ts
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
    if (!body._id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: _id'
      });
    }
    
    // Find the mutual fund
    const mutualFund = await MutualFund.findOne({ 
      _id: body._id,
      user: userId 
    });
    
    if (!mutualFund) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mutual fund not found or you do not have permission to update it'
      });
    }
    
    // Update fields
    const updateFields = [
      'schemeName', 'schemeCode', 'fundHouse', 'category', 
      'purchaseNAV', 'units', 'investmentAmount', 'purchaseDate', 
      'folioNumber', 'currentNAV', 'broker', 'expense', 'dividendOption',
      'sipFlag', 'sipAmount', 'sipFrequency', 'sipDay'
    ];
    
    updateFields.forEach(field => {
      if (body[field] !== undefined) {
        mutualFund[field] = body[field];
      }
    });
    
    // Calculate current value and profit/loss
    if (mutualFund.currentNAV && mutualFund.units) {
      mutualFund.currentValue = mutualFund.currentNAV * mutualFund.units;
      mutualFund.profitLoss = mutualFund.currentValue - mutualFund.investmentAmount;
      mutualFund.profitLossPercentage = (mutualFund.profitLoss / mutualFund.investmentAmount) * 100;
      mutualFund.lastNAVUpdate = new Date();
    }
    
    // Save changes
    await mutualFund.save();
    
    console.log(`Updated mutual fund ${mutualFund._id} for user ${userId}`);
    
    return {
      success: true,
      message: 'Mutual fund updated successfully',
      mutualFund
    };
    
  } catch (err) {
    const error = err as Error;
    console.error(`Error updating mutual fund: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error updating mutual fund: ${error.message || 'Unknown error'}`
    });
  }
});
