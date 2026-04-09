// server/api/stock-market/mutual-funds/update-nav-batch.post.ts
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
    if (!body.updates || !Array.isArray(body.updates) || body.updates.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: updates must be a non-empty array'
      });
    }

    const results = [];
    const errors = [];

    console.log(`Processing ${body.updates.length} NAV updates for user ${userId}`);

    // Process each update with bulk operations
    for (const update of body.updates) {
      try {
        if (!update.schemeCode || !update.currentNAV) {
          errors.push({
            schemeCode: update.schemeCode || 'unknown',
            error: 'Missing required fields: schemeCode and currentNAV are required'
          });
          continue;
        }

        console.log(`Updating NAV for scheme ${update.schemeCode}: ₹${update.currentNAV}`);

        // Find all mutual funds with this scheme code for the user
        const mutualFunds = await MutualFund.find({
          schemeCode: update.schemeCode,
          user: userId
        });

        if (mutualFunds.length === 0) {
          errors.push({
            schemeCode: update.schemeCode,
            error: 'No mutual funds found with this scheme code'
          });
          continue;
        }

        // Prepare bulk operations for this scheme
        const bulkOps = [];

        for (const fund of mutualFunds) {
          // Store previous NAV for day P/L calculation
          const prevNAV = fund.currentNAV || fund.purchaseNAV;

          // Calculate new values
          const currentValue = update.currentNAV * fund.units;
          const profitLoss = currentValue - fund.investmentAmount;
          const profitLossPercentage = fund.investmentAmount !== 0 ? (profitLoss / fund.investmentAmount) * 100 : 0;

          // Calculate day's P/L
          const dayPL = (update.currentNAV - prevNAV) * fund.units;
          const dayPLPercentage = prevNAV !== 0 ? ((update.currentNAV - prevNAV) / prevNAV) * 100 : 0;

          bulkOps.push({
            updateOne: {
              filter: { _id: fund._id },
              update: {
                $set: {
                  prevDayNAV: prevNAV,
                  currentNAV: update.currentNAV,
                  currentValue: currentValue,
                  profitLoss: profitLoss,
                  profitLossPercentage: profitLossPercentage,
                  dayPL: dayPL,
                  dayPLPercentage: dayPLPercentage,
                  lastNAVUpdate: new Date()
                }
              }
            }
          });
        }

        // Execute bulk operation for this scheme
        if (bulkOps.length > 0) {
          const bulkResult = await MutualFund.bulkWrite(bulkOps);
          console.log(`Bulk updated ${bulkResult.modifiedCount} records for scheme ${update.schemeCode}`);

          results.push({
            schemeCode: update.schemeCode,
            updatedCount: bulkResult.modifiedCount,
            success: true
          });
        }

      } catch (err) {
        console.error(`Error updating NAV for scheme ${update.schemeCode}:`, err);
        errors.push({
          schemeCode: update.schemeCode,
          error: err.message || 'Unknown error'
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      message: `Updated NAVs for ${results.length} scheme(s), with ${errors.length} error(s)`
    };

  } catch (err) {
    const error = err as Error;
    console.error(`Error in batch updating mutual fund NAVs: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error in batch updating mutual fund NAVs: ${error.message || 'Unknown error'}`
    });
  }
});
