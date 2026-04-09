// server/api/stock-market/mutual-funds/add.post.ts
import { defineEventHandler, readBody, createError } from 'h3';
import { MutualFund } from '../../../models/MutualFund';
import { calculateSchemeXIRR } from '../../../../utils/xirr';

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
    const requiredFields = [
      'schemeName', 'schemeCode', 'fundHouse', 'category',
      'purchaseNAV', 'units', 'investmentAmount', 'purchaseDate',
      'folioNumber', 'broker'
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        throw createError({
          statusCode: 400,
          statusMessage: `Missing required field: ${field}`
        });
      }
    }

    // Additional validation checks...

    // Calculate current value and profit/loss
    const currentNAV = body.currentNAV || body.purchaseNAV;
    const currentValue = currentNAV * body.units;
    const profitLoss = currentValue - body.investmentAmount;
    const profitLossPercentage = (profitLoss / body.investmentAmount) * 100;

    // If adding to existing SIP, maintain the same SIP flags and details
    if (body.isAddingToExisting && body.existingFundId) {
      console.log(`Adding to existing fund ${body.existingFundId} for user ${userId}`);

      // Find the existing fund to ensure it exists and belongs to this user
      const existingFund = await MutualFund.findOne({
        _id: body.existingFundId,
        user: userId
      });

      if (!existingFund) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Existing fund not found or you do not have permission to add to it'
        });
      }

      // Ensure SIP details are consistent
      body.sipFlag = existingFund.sipFlag;
      if (body.sipFlag) {
        body.sipAmount = existingFund.sipAmount;
        body.sipFrequency = existingFund.sipFrequency;
        body.sipDay = existingFund.sipDay;
      }

      // Ensure folioNumber is consistent if not specified
      if (!body.folioNumber && existingFund.folioNumber) {
        body.folioNumber = existingFund.folioNumber;
      }

      // Ensure other metadata is consistent
      if (!body.broker && existingFund.broker) {
        body.broker = existingFund.broker;
      }

      if (!body.schemeType && existingFund.schemeType) {
        body.schemeType = existingFund.schemeType;
      }

      if (!body.dividendOption && existingFund.dividendOption) {
        body.dividendOption = existingFund.dividendOption;
      }

      console.log(`Successfully validated existing fund. Adding new entry with ${body.units} units and ₹${body.investmentAmount}`);
    }

    // Create new mutual fund entry
    const mutualFund = new MutualFund({
      schemeName: body.schemeName,
      schemeCode: body.schemeCode,
      fundHouse: body.fundHouse,
      category: body.category,
      purchaseNAV: body.purchaseNAV,
      units: body.units,
      investmentAmount: body.investmentAmount,
      purchaseDate: new Date(body.purchaseDate),
      folioNumber: body.folioNumber,
      currentNAV: body.currentNAV || body.purchaseNAV,
      currentValue: currentValue || body.investmentAmount,
      profitLoss: profitLoss || 0,
      profitLossPercentage: profitLossPercentage || 0,
      sipFlag: body.sipFlag || false,
      sipAmount: body.sipAmount,
      sipFrequency: body.sipFrequency,
      sipDay: body.sipDay,
      lastNAVUpdate: body.currentNAV ? new Date() : null,
      user: userId,
      broker: body.broker,
      expense: body.expense || 0,
      dividendOption: body.dividendOption || 'Growth'
    });

    // Save to database
    await mutualFund.save();

    // Calculate and update XIRR for all entries of this scheme
    try {
      const schemeEntries = await MutualFund.find({
        user: userId,
        schemeCode: body.schemeCode,
        schemeName: body.schemeName
      }).lean();

      const xirr = calculateSchemeXIRR(schemeEntries);

      // Update XIRR for all entries of this scheme
      await MutualFund.updateMany(
        {
          user: userId,
          schemeCode: body.schemeCode,
          schemeName: body.schemeName
        },
        { xirr: xirr }
      );

      console.log(`Updated XIRR for scheme ${body.schemeName}: ${xirr}%`);
    } catch (xirrError) {
      console.error(`Error calculating XIRR for scheme ${body.schemeName}:`, xirrError);
      // Don't fail the entire operation if XIRR calculation fails
    }

    console.log(`Added new mutual fund for user ${userId}: ${body.schemeName}`);

    return {
      success: true,
      message: 'Mutual fund added successfully',
      mutualFund
    };

  } catch (err) {
    const error = err as Error;
    console.error(`Error adding mutual fund: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error adding mutual fund: ${error.message || 'Unknown error'}`
    });
  }
});
