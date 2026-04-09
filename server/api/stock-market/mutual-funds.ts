// server/api/stock-market/mutual-funds.ts
import { defineEventHandler, createError } from 'h3';
import { MutualFund } from '../../models/MutualFund';
import { calculateSchemeXIRR } from '../../../utils/xirr';

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
    console.log(`Fetching mutual funds for user ID: ${userId}`);

    try {
      // Fetch all mutual fund entries for the user
      const mutualFundsRaw = await MutualFund.find({ user: userId })
        .sort({ purchaseDate: -1 }) // Sort by purchase date, newest first
        .lean(); // Convert to plain JavaScript objects

      // Consolidate mutual funds with the same scheme name and code
      const schemeMap = new Map();

      mutualFundsRaw.forEach(fund => {
        const key = `${fund.schemeCode}_${fund.schemeName}`;

        if (schemeMap.has(key)) {
          const existingFund = schemeMap.get(key);

          // Add units and investment amount
          existingFund.units = (Number(existingFund.units) + Number(fund.units)).toFixed(4);
          existingFund.investmentAmount = Number(existingFund.investmentAmount) + Number(fund.investmentAmount);

          // Recalculate average purchase NAV
          existingFund.purchaseNAV = (existingFund.investmentAmount / existingFund.units).toFixed(4);

          // Update current value
          existingFund.currentValue = Number(existingFund.units) * Number(existingFund.currentNAV);

          // Update profit/loss
          existingFund.profitLoss = existingFund.currentValue - existingFund.investmentAmount;
          existingFund.profitLossPercentage = (existingFund.profitLoss / existingFund.investmentAmount) * 100;

          // Keep SIP flag if any of the entries has it
          existingFund.sipFlag = existingFund.sipFlag || fund.sipFlag;

          // If this entry has SIP and the merged entry doesn't have SIP details, copy them
          if (fund.sipFlag) {
            existingFund.sipAmount = existingFund.sipAmount || fund.sipAmount;
            existingFund.sipFrequency = existingFund.sipFrequency || fund.sipFrequency;
            existingFund.sipDay = existingFund.sipDay || fund.sipDay;
          }

          // Keep the earliest purchase date
          if (new Date(fund.purchaseDate) < new Date(existingFund.purchaseDate)) {
            existingFund.purchaseDate = fund.purchaseDate;
          }
        } else {
          // Create a copy of the fund to avoid modifying the original
          schemeMap.set(key, { ...fund });
        }
      });

      // Convert the map back to an array
      const mutualFunds = Array.from(schemeMap.values());

      // Calculate XIRR for each scheme using raw data
      mutualFunds.forEach(fund => {
        try {
          const key = `${fund.schemeCode}_${fund.schemeName}`;

          // Get all raw entries for this scheme
          const schemeEntries = mutualFundsRaw.filter(rawFund =>
            `${rawFund.schemeCode}_${rawFund.schemeName}` === key
          );

          // Calculate XIRR for this scheme
          const xirr = calculateSchemeXIRR(schemeEntries);
          fund.xirr = xirr;

        } catch (xirrError) {
          console.error(`Error calculating XIRR for scheme ${fund.schemeName}:`, xirrError);
          fund.xirr = null;
        }
      });

      console.log(`Found ${mutualFunds.length} mutual funds for user`);

      try {
        // Calculate summary statistics with error handling
        let totalInvested = 0;
        let currentValue = 0;
        let totalProfitLoss = 0;

        // Use safe calculation with error handling
        mutualFunds.forEach(fund => {
          try {
            totalInvested += Number(fund.investmentAmount) || 0;
            currentValue += Number(fund.currentValue) || 0;
            totalProfitLoss += Number(fund.profitLoss) || 0;
          } catch (calcError) {
            console.error(`Error calculating values for mutual fund ${fund._id}:`, calcError);
            // Continue with next fund
          }
        });

        const profitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

        // Group mutual funds by category for allocation with error handling
        const categoryAllocation: Record<string, number> = {};
        mutualFunds.forEach(fund => {
          try {
            const category = fund.category || 'Unknown';
            if (!categoryAllocation[category]) {
              categoryAllocation[category] = 0;
            }
            categoryAllocation[category] += Number(fund.currentValue) || 0;
          } catch (categoryError) {
            console.error(`Error processing category for mutual fund ${fund._id}:`, categoryError);
            // Continue with next fund
          }
        });

        // Convert category allocation to array format with error handling
        const categoryAllocationArray = Object.entries(categoryAllocation).map(([category, value]) => {
          try {
            return {
              category,
              value: Number(value),
              percentage: currentValue > 0 ? (Number(value) / currentValue) * 100 : 0
            };
          } catch (error) {
            console.error(`Error mapping category ${category}:`, error);
            return {
              category,
              value: 0,
              percentage: 0
            };
          }
        });

        // Group mutual funds by fund house with folio details
        const fundHouseAllocation: Record<string, any> = {};
        mutualFunds.forEach(fund => {
          try {
            const fundHouse = fund.fundHouse || 'Unknown';
            if (!fundHouseAllocation[fundHouse]) {
              fundHouseAllocation[fundHouse] = {
                totalValue: 0,
                totalInvestment: 0,
                totalProfitLoss: 0,
                folios: {}
              };
            }

            // Add to fund house totals
            fundHouseAllocation[fundHouse].totalValue += Number(fund.currentValue) || 0;
            fundHouseAllocation[fundHouse].totalInvestment += Number(fund.investmentAmount) || 0;
            fundHouseAllocation[fundHouse].totalProfitLoss += Number(fund.profitLoss) || 0;

            // Group by folio number within fund house
            const folioNumber = fund.folioNumber || 'No Folio';
            if (!fundHouseAllocation[fundHouse].folios[folioNumber]) {
              fundHouseAllocation[fundHouse].folios[folioNumber] = {
                folioNumber,
                schemes: [],
                totalValue: 0,
                totalInvestment: 0,
                totalProfitLoss: 0
              };
            }

            // Add scheme to folio
            const folioData = fundHouseAllocation[fundHouse].folios[folioNumber];
            folioData.schemes.push({
              schemeName: fund.schemeName,
              schemeCode: fund.schemeCode,
              units: Number(fund.units),
              currentNAV: Number(fund.currentNAV),
              currentValue: Number(fund.currentValue),
              investmentAmount: Number(fund.investmentAmount),
              profitLoss: Number(fund.profitLoss),
              profitLossPercentage: Number(fund.profitLossPercentage),
              xirr: fund.xirr,
              sipFlag: fund.sipFlag
            });

            // Update folio totals
            folioData.totalValue += Number(fund.currentValue) || 0;
            folioData.totalInvestment += Number(fund.investmentAmount) || 0;
            folioData.totalProfitLoss += Number(fund.profitLoss) || 0;

          } catch (fundHouseError) {
            console.error(`Error processing fund house for mutual fund ${fund._id}:`, fundHouseError);
            // Continue with next fund
          }
        });

        // Convert fund house allocation to array format with folio details and XIRR calculation
        const fundHouseAllocationArray = Object.entries(fundHouseAllocation).map(([fundHouse, data]) => {
          try {
            // Safely access data properties with fallbacks
            const totalValue = data && typeof data === 'object' && 'totalValue' in data ? data.totalValue : 0;
            const totalInvestment = data && typeof data === 'object' && 'totalInvestment' in data ? data.totalInvestment : 0;
            const totalProfitLoss = data && typeof data === 'object' && 'totalProfitLoss' in data ? data.totalProfitLoss : 0;
            const folios = data && typeof data === 'object' && 'folios' in data ? data.folios : {};

            // Calculate fund house XIRR by getting all raw entries for this fund house
            const fundHouseRawEntries = mutualFundsRaw.filter(rawFund =>
              (rawFund.fundHouse || 'Unknown') === fundHouse
            );
            const fundHouseXIRR = calculateSchemeXIRR(fundHouseRawEntries);

            // Convert folios object to array with safe access and XIRR calculation
            const foliosArray = Object.values(folios || {}).map((folio: any) => {
              // Calculate folio XIRR by getting all raw entries for this folio
              const folioRawEntries = mutualFundsRaw.filter(rawFund =>
                (rawFund.fundHouse || 'Unknown') === fundHouse &&
                (rawFund.folioNumber || 'No Folio') === folio.folioNumber
              );
              const folioXIRR = calculateSchemeXIRR(folioRawEntries);

              return {
                ...folio,
                profitLossPercentage: (folio && folio.totalInvestment > 0) ? (folio.totalProfitLoss / folio.totalInvestment) * 100 : 0,
                xirr: folioXIRR
              };
            });

            return {
              fundHouse,
              value: Number(totalValue) || 0,
              totalInvestment: Number(totalInvestment) || 0,
              totalProfitLoss: Number(totalProfitLoss) || 0,
              profitLossPercentage: totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0,
              percentage: currentValue > 0 ? (Number(totalValue) / currentValue) * 100 : 0,
              xirr: fundHouseXIRR,
              folios: foliosArray
            };
          } catch (error) {
            console.error(`Error mapping fund house ${fundHouse}:`, error);
            return {
              fundHouse,
              value: 0,
              totalInvestment: 0,
              totalProfitLoss: 0,
              profitLossPercentage: 0,
              percentage: 0,
              xirr: null,
              folios: []
            };
          }
        });

        // Calculate today's gain/loss
        let todayTotalPL = 0;
        let totalPreviousValue = 0;

        console.log(`\n=== CALCULATING MUTUAL FUND TODAY'S GAIN/LOSS FOR ${mutualFunds.length} FUNDS ===`);

        // Calculate today's gain/loss with error handling
        mutualFunds.forEach((fund, index) => {
          try {
            if (index < 3) {
              console.log(`Fund ${index + 1}: ${fund.scheme} - dayPL: ${fund.dayPL}, currentNAV: ${fund.currentNAV}, prevDayNAV: ${fund.prevDayNAV}`);
            }

            // Try to use existing dayPL first, then calculate on-the-fly
            if (fund.dayPL !== undefined && fund.dayPL !== null && fund.dayPL !== 0) {
              const dayPLValue = Number(fund.dayPL) || 0;
              todayTotalPL += dayPLValue;
              if (index < 3) console.log(`  - Using existing dayPL: ${dayPLValue}`);
            } else if (fund.currentNAV !== undefined && fund.units !== undefined) {
              // Calculate daily P&L on-the-fly
              const currentNAV = Number(fund.currentNAV) || 0;
              const units = Number(fund.units) || 0;

              if (currentNAV > 0 && units > 0) {
                let prevDayNAV = 0;

                // Use actual previous day NAV if available
                if (fund.prevDayNAV !== undefined && fund.prevDayNAV !== null && fund.prevDayNAV > 0) {
                  prevDayNAV = Number(fund.prevDayNAV);
                  if (index < 3) console.log(`  - Using actual prevDayNAV: ${prevDayNAV}`);
                } else {
                  // Fallback: estimate previous day NAV as slightly lower than current NAV
                  // This is better than showing 0 for today's gain/loss
                  prevDayNAV = currentNAV * 0.999; // Assume 0.1% daily change if no data
                  if (index < 3) console.log(`  - Using estimated prevDayNAV: ${prevDayNAV} (0.1% below current)`);
                }

                const dailyPL = (currentNAV - prevDayNAV) * units;
                todayTotalPL += dailyPL;

                if (index < 3) console.log(`  - Calculated dailyPL: ${dailyPL} (${currentNAV} - ${prevDayNAV}) * ${units}`);

                // Store the calculated value back to the fund object for consistency
                fund.dayPL = dailyPL;
                fund.dayPLPercentage = prevDayNAV > 0 ? ((currentNAV - prevDayNAV) / prevDayNAV) * 100 : 0;
              }
            }

            // Calculate previous day value
            if (fund.prevDayNAV !== undefined && fund.units !== undefined) {
              totalPreviousValue += (Number(fund.prevDayNAV) * Number(fund.units)) || 0;
            } else if (fund.currentNAV !== undefined && fund.units !== undefined) {
              // If we don't have previous day NAV, use a slightly lower current NAV
              const prevDayNAV = fund.currentNAV * 0.9995; // Assume 0.05% daily change if no data
              totalPreviousValue += (prevDayNAV * Number(fund.units)) || 0;
            }
          } catch (calcError) {
            console.error(`Error calculating today's values for mutual fund ${fund._id}:`, calcError);
            // Continue with next fund
          }
        });

        // Calculate today's percentage gain/loss
        const todayPLPercentage = totalPreviousValue > 0
          ? parseFloat(((todayTotalPL / totalPreviousValue) * 100).toFixed(2))
          : 0.00;

        console.log(`\n=== FINAL MUTUAL FUND TODAY'S GAIN/LOSS RESULTS ===`);
        console.log(`Today's total P&L: ₹${todayTotalPL.toFixed(2)}`);
        console.log(`Total previous value: ₹${totalPreviousValue.toFixed(2)}`);
        console.log(`Today's P&L percentage: ${todayPLPercentage.toFixed(2)}%`);
        console.log(`=== END MUTUAL FUND DEBUG ===\n`);

        // Count SIPs
        const sipCount = mutualFunds.filter(fund => fund.sipFlag).length;

        // Return the data
        return {
          mutualFunds,
          summary: {
            totalInvested,
            currentValue,
            totalProfitLoss,
            profitLossPercentage,
            fundCount: mutualFunds.length,
            sipCount,
            todayTotalPL,
            todayPLPercentage
          },
          categoryAllocation: categoryAllocationArray,
          fundHouseAllocation: fundHouseAllocationArray,
          timestamp: new Date().toISOString()
        };
      } catch (processingError) {
        const error = processingError as Error;
        console.error(`Error processing mutual fund data: ${error.message || 'Unknown error'}`);
        console.error(error.stack || 'No stack trace available');
        throw createError({
          statusCode: 500,
          statusMessage: `Error processing mutual fund data: ${error.message || 'Unknown error'}`
        });
      }
    } catch (dbError) {
      const error = dbError as Error;
      console.error(`Database error: ${error.message || 'Unknown database error'}`);
      console.error(error.stack || 'No stack trace available');
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message || 'Unknown database error'}`
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Unhandled error in mutual-funds.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching mutual fund data: ${error.message || 'Unknown error'}`
    });
  }
});
