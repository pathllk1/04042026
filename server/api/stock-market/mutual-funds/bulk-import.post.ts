import { defineEventHandler, readBody, createError } from 'h3';
import { MutualFund } from '../../../models/MutualFund';
import { calculateSchemeXIRR } from '../../../../utils/xirr';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  let session = null;

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

    if (!body.mutualFunds || !Array.isArray(body.mutualFunds)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request: mutualFunds array is required'
      });
    }

    const mutualFundsData = body.mutualFunds;

    if (mutualFundsData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No mutual fund data provided'
      });
    }

    console.log(`Starting bulk import of ${mutualFundsData.length} mutual funds for user ${userId}`);

    // Start a MongoDB session for transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Clear existing mutual fund data for this user before importing
    console.log(`Clearing existing mutual fund data for user ${userId}`);
    const deleteResult = await MutualFund.deleteMany({ user: userId }, { session });
    console.log(`Deleted ${deleteResult.deletedCount} existing mutual fund records`);

    // Validate and prepare data for insertion
    const validatedData: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < mutualFundsData.length; i++) {
      const fund = mutualFundsData[i];

      try {
        // Validate required fields
        const requiredFields = [
          'schemeName', 'schemeCode', 'fundHouse', 'category',
          'purchaseNAV', 'units', 'investmentAmount', 'purchaseDate',
          'folioNumber', 'broker'
        ];

        for (const field of requiredFields) {
          if (!fund[field] && fund[field] !== 0) {
            throw new Error(`Missing required field: ${field}`);
          }
        }

        // Validate data types
        if (isNaN(parseFloat(fund.purchaseNAV)) || parseFloat(fund.purchaseNAV) <= 0) {
          throw new Error('Purchase NAV must be a positive number');
        }

        // Allow negative values for units and investment amount (redemptions)
        if (isNaN(parseFloat(fund.units))) {
          throw new Error('Units must be a valid number');
        }

        if (isNaN(parseFloat(fund.investmentAmount))) {
          throw new Error('Investment amount must be a valid number');
        }

        // Detect transaction type
        const units = parseFloat(fund.units);
        const investmentAmount = parseFloat(fund.investmentAmount);
        const isRedemption = units < 0 || investmentAmount < 0;

        // Validate that both units and investment amount have the same sign for consistency
        if ((units > 0 && investmentAmount < 0) || (units < 0 && investmentAmount > 0)) {
          throw new Error('Units and investment amount must have the same sign (both positive for purchase, both negative for redemption)');
        }

        // Log transaction type for debugging
        if (isRedemption) {
          console.log(`Row ${i + 1}: Redemption transaction detected - Units: ${units}, Amount: ${investmentAmount}`);
        }

        // Parse and validate date
        let purchaseDate;
        try {
          // Handle various date formats
          let dateString = fund.purchaseDate;

          // If it's already a Date object, use it
          if (dateString instanceof Date) {
            purchaseDate = dateString;
          }
          // If it's a string that looks like a JS Date string (contains GMT)
          else if (typeof dateString === 'string' && dateString.includes('GMT')) {
            // Extract just the date part before GMT for better parsing
            const dateMatch = dateString.match(/^(.+?)\s+\d{2}:\d{2}:\d{2}\s+GMT/);
            if (dateMatch) {
              purchaseDate = new Date(dateMatch[1]);
            } else {
              purchaseDate = new Date(dateString);
            }
          }
          // Handle standard date formats (YYYY-MM-DD, MM/DD/YYYY, etc.)
          else {
            purchaseDate = new Date(dateString);
          }

          // Validate the parsed date
          if (isNaN(purchaseDate.getTime())) {
            throw new Error('Invalid purchase date');
          }

          // Ensure the date is not in the future
          if (purchaseDate > new Date()) {
            console.warn(`Purchase date ${purchaseDate} is in the future, using current date`);
            purchaseDate = new Date();
          }

        } catch (e) {
          throw new Error(`Invalid purchase date format: ${fund.purchaseDate}`);
        }

        // Calculate current value and profit/loss if not provided
        const currentNAV = fund.currentNAV || fund.purchaseNAV;
        const currentValue = fund.currentValue || (currentNAV * units);
        const profitLoss = fund.profitLoss || (currentValue - investmentAmount);

        // Handle profit/loss percentage calculation for redemptions
        let profitLossPercentage;
        if (fund.profitLossPercentage !== undefined) {
          profitLossPercentage = fund.profitLossPercentage;
        } else if (investmentAmount !== 0) {
          // For redemptions (negative values), calculate percentage based on absolute values
          profitLossPercentage = (profitLoss / Math.abs(investmentAmount)) * 100;
        } else {
          profitLossPercentage = 0;
        }

        // Prepare the mutual fund document
        const mutualFundDoc = {
          schemeName: fund.schemeName.toString().trim(),
          schemeCode: fund.schemeCode.toString().trim(),
          fundHouse: fund.fundHouse.toString().trim(),
          category: fund.category.toString().trim(),
          purchaseNAV: parseFloat(fund.purchaseNAV),
          units: units, // Use calculated variable
          investmentAmount: investmentAmount, // Use calculated variable
          purchaseDate: purchaseDate,
          folioNumber: fund.folioNumber.toString().trim(),
          currentNAV: parseFloat(currentNAV),
          currentValue: parseFloat(currentValue),
          profitLoss: parseFloat(profitLoss),
          profitLossPercentage: parseFloat(profitLossPercentage),
          sipFlag: Boolean(fund.sipFlag),
          sipAmount: parseFloat(fund.sipAmount) || 0,
          sipFrequency: fund.sipFrequency?.toString().trim() || '',
          sipDay: parseInt(fund.sipDay) || 0,
          lastNAVUpdate: fund.currentNAV ? new Date() : null,
          user: userId, // Set to current logged-in user
          broker: fund.broker.toString().trim(),
          expense: parseFloat(fund.expense) || 0,
          dividendOption: fund.dividendOption?.toString().trim() || 'Growth',
          prevDayNAV: parseFloat(fund.prevDayNAV) || 0,
          dayPL: parseFloat(fund.dayPL) || 0,
          dayPLPercentage: parseFloat(fund.dayPLPercentage) || 0
        };

        validatedData.push({
          ...mutualFundDoc,
          originalRowIndex: i + 1, // Track original row number
          originalData: {
            schemeName: fund.schemeName,
            schemeCode: fund.schemeCode,
            folioNumber: fund.folioNumber,
            transactionType: isRedemption ? 'Redemption' : 'Purchase' // Track transaction type
          }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
        errors.push({
          row: i + 1,
          schemeName: fund.schemeName || 'Unknown',
          schemeCode: fund.schemeCode || 'Unknown',
          folioNumber: fund.folioNumber || 'Unknown',
          error: errorMessage,
          originalData: fund
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      console.error(`Validation errors found in ${errors.length} rows:`, errors);

      // If all rows have errors, abort
      if (validatedData.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'All rows have validation errors',
          data: { errors }
        });
      }

      // If some rows are valid, log warnings but continue
      console.warn(`Proceeding with ${validatedData.length} valid rows, skipping ${errors.length} invalid rows`);
    }

    // Use insertMany with session for transaction and ordered: false to continue on errors
    let insertResult: any;
    const insertErrors: any[] = [];

    try {
      // Remove originalRowIndex and originalData before inserting to database
      const cleanedData = validatedData.map(({ originalRowIndex, originalData, ...cleanDoc }) => cleanDoc);

      insertResult = await MutualFund.insertMany(cleanedData, {
        session,
        ordered: false // Continue inserting even if some documents fail
      });

      console.log(`Successfully inserted ${insertResult.length} out of ${validatedData.length} validated records`);

    } catch (insertError: any) {
      // Handle bulk write errors
      if (insertError.writeErrors) {
        insertError.writeErrors.forEach((writeError: any) => {
          const failedIndex = writeError.index;
          const originalRecord = validatedData[failedIndex];

          insertErrors.push({
            row: originalRecord.originalRowIndex,
            schemeName: originalRecord.originalData.schemeName,
            schemeCode: originalRecord.originalData.schemeCode,
            folioNumber: originalRecord.originalData.folioNumber,
            error: `Database insertion failed: ${writeError.errmsg}`,
            errorCode: writeError.code
          });
        });

        // Get successfully inserted documents
        insertResult = insertError.result?.insertedDocs || [];
        console.log(`Partial success: ${insertResult.length} inserted, ${insertErrors.length} failed during database insertion`);
      } else {
        // Complete failure
        throw insertError;
      }
    }

    // Commit the transaction
    await session.commitTransaction();

    // Calculate XIRR for all unique schemes after successful import
    try {
      const uniqueSchemes = new Set();
      validatedData.forEach(item => {
        const key = `${item.schemeCode}_${item.schemeName}`;
        uniqueSchemes.add(key);
      });

      console.log(`Calculating XIRR for ${uniqueSchemes.size} unique schemes...`);

      for (const schemeKey of uniqueSchemes) {
        try {
          const schemeKeyStr = String(schemeKey);
          const [schemeCode, ...schemeNameParts] = schemeKeyStr.split('_');
          const schemeName = schemeNameParts.join('_');

          const schemeEntries = await MutualFund.find({
            user: userId,
            schemeCode: schemeCode,
            schemeName: schemeName
          }).lean();

          const xirr = calculateSchemeXIRR(schemeEntries as any);

          await MutualFund.updateMany(
            {
              user: userId,
              schemeCode: schemeCode,
              schemeName: schemeName
            },
            { xirr: xirr }
          );

          console.log(`Updated XIRR for scheme ${schemeName}: ${xirr}%`);
        } catch (xirrError) {
          console.error(`Error calculating XIRR for scheme ${schemeKey}:`, xirrError);
        }
      }
    } catch (xirrBatchError) {
      console.error('Error in batch XIRR calculation:', xirrBatchError);
      // Don't fail the entire import if XIRR calculation fails
    }

    const totalProcessed = mutualFundsData.length;
    const totalValidated = validatedData.length;
    const totalInserted = insertResult.length;
    const totalValidationErrors = errors.length;
    const totalInsertionErrors = insertErrors.length;
    const totalFailed = totalValidationErrors + totalInsertionErrors;

    // Count transaction types
    const purchaseCount = validatedData.filter(item => !item.originalData.transactionType || item.originalData.transactionType === 'Purchase').length;
    const redemptionCount = validatedData.filter(item => item.originalData.transactionType === 'Redemption').length;

    console.log(`Import Summary for user ${userId}:`);
    console.log(`- Total records processed: ${totalProcessed}`);
    console.log(`- Validation errors: ${totalValidationErrors}`);
    console.log(`- Successfully validated: ${totalValidated}`);
    console.log(`  - Purchases: ${purchaseCount}`);
    console.log(`  - Redemptions: ${redemptionCount}`);
    console.log(`- Database insertion errors: ${totalInsertionErrors}`);
    console.log(`- Successfully inserted: ${totalInserted}`);
    console.log(`- Total failed: ${totalFailed}`);

    // Combine all errors
    const allErrors = [...errors, ...insertErrors];

    return {
      success: true,
      message: `Import completed: ${totalInserted} records saved (${purchaseCount} purchases, ${redemptionCount} redemptions), ${totalFailed} failed`,
      summary: {
        totalProcessed,
        totalInserted,
        totalFailed,
        validationErrors: totalValidationErrors,
        insertionErrors: totalInsertionErrors,
        purchaseCount,
        redemptionCount
      },
      savedCount: totalInserted,
      failedCount: totalFailed,
      errors: allErrors.length > 0 ? allErrors : undefined,
      deletedExistingCount: deleteResult.deletedCount
    };

  } catch (err) {
    // Rollback transaction on error
    if (session) {
      await session.abortTransaction();
    }

    const error = err as any;
    console.error(`Error in bulk import: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');

    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Bulk import failed: ${error.message || 'Unknown error'}`,
      data: error.data || undefined
    });
  } finally {
    // End session
    if (session) {
      await session.endSession();
    }
  }
});
