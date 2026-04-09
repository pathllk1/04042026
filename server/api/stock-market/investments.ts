// server/api/stock-market/investments.ts
import { defineEventHandler, createError } from 'h3';
import { Folio } from '../../models/Folio';

export default defineEventHandler(async (event) => {
  console.log('=== INVESTMENTS API CALLED ===');
  try {
    // Ensure user is authenticated
    const user = event.context.user;
    console.log('User from context:', user ? 'User found' : 'No user');
    if (!user) {
      console.error('Authentication error: User not authenticated');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }

    // Get the user ID from the authenticated user
    const userId = user._id.toString();
    console.log(`Fetching investments for user ID: ${userId}`);

    try {
      // Fetch all folio entries for the user
      const investments = await Folio.find({ user: userId })
        .sort({ pdate: -1 }) // Sort by purchase date, newest first
        .lean(); // Convert to plain JavaScript objects

      console.log(`Found ${investments.length} investments for user`);

      try {
        // Calculate summary statistics with error handling
        let totalInvested = 0;
        let currentValue = 0;
        let totalProfitLoss = 0;

        // Use safe calculation with error handling
        investments.forEach(inv => {
          try {
            totalInvested += Number(inv.namt) || 0;
            currentValue += Number(inv.cval) || 0;
            totalProfitLoss += Number(inv.pl) || 0;
          } catch (calcError) {
            console.error(`Error calculating values for investment ${inv._id}:`, calcError);
            // Continue with next investment
          }
        });

        const profitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

        // Group investments by sector for sector allocation with error handling
        const sectorAllocation: Record<string, number> = {};
        investments.forEach(inv => {
          try {
            const sector = inv.sector || 'Unknown';
            if (!sectorAllocation[sector]) {
              sectorAllocation[sector] = 0;
            }
            sectorAllocation[sector] += Number(inv.cval) || 0;
          } catch (sectorError) {
            console.error(`Error processing sector for investment ${inv._id}:`, sectorError);
            // Continue with next investment
          }
        });

        // Convert sector allocation to array format with error handling
        const sectorAllocationArray = Object.entries(sectorAllocation).map(([sector, value]) => {
          try {
            return {
              sector,
              value: Number(value),
              percentage: currentValue > 0 ? (Number(value) / currentValue) * 100 : 0
            };
          } catch (error) {
            console.error(`Error mapping sector ${sector}:`, error);
            return {
              sector,
              value: 0,
              percentage: 0
            };
          }
        });

        // Group investments by broker with error handling
        const brokerAllocation: Record<string, number> = {};
        investments.forEach(inv => {
          try {
            const broker = inv.broker || 'Unknown';
            if (!brokerAllocation[broker]) {
              brokerAllocation[broker] = 0;
            }
            brokerAllocation[broker] += Number(inv.cval) || 0;
          } catch (brokerError) {
            console.error(`Error processing broker for investment ${inv._id}:`, brokerError);
            // Continue with next investment
          }
        });

        // Convert broker allocation to array format with error handling
        const brokerAllocationArray = Object.entries(brokerAllocation).map(([broker, value]) => {
          try {
            return {
              broker,
              value: Number(value),
              percentage: currentValue > 0 ? (Number(value) / currentValue) * 100 : 0
            };
          } catch (error) {
            console.error(`Error mapping broker ${broker}:`, error);
            return {
              broker,
              value: 0,
              percentage: 0
            };
          }
        });

        console.log(`Successfully processed investment data with ${sectorAllocationArray.length} sectors and ${brokerAllocationArray.length} brokers`);

        // Calculate today's gain/loss
        let todayTotalPL = 0;
        let totalPreviousValue = 0;
        let validDayPLCount = 0;
        let calculatedDayPLCount = 0;

        console.log(`\n=== CALCULATING TODAY'S GAIN/LOSS FOR ${investments.length} INVESTMENTS ===`);

        // Calculate today's gain/loss with error handling
        investments.forEach((inv, index) => {
          try {
            // Simplified logging for key investments
            if (index < 3) {
              console.log(`Investment ${index + 1}: ${inv.symbol} - dayPL: ${inv.dayPL}, cprice: ${inv.cprice}, prevDayPrice: ${inv.prevDayPrice}`);
            }

            // Try to use existing dayPL first
            if (inv.dayPL !== undefined && inv.dayPL !== null && inv.dayPL !== 0) {
              const dayPLValue = Number(inv.dayPL) || 0;
              todayTotalPL += dayPLValue;
              validDayPLCount++;
              if (index < 3) console.log(`  - Using existing dayPL: ${dayPLValue}`);
            }
            // If dayPL is not available or is 0, calculate it on-the-fly
            else if (inv.cprice !== undefined && inv.prevDayPrice !== undefined && inv.qnty !== undefined) {
              const currentPrice = Number(inv.cprice) || 0;
              const prevPrice = Number(inv.prevDayPrice) || 0;
              const quantity = Number(inv.qnty) || 0;

              if (currentPrice > 0 && prevPrice > 0 && quantity > 0) {
                const calculatedDayPL = (currentPrice - prevPrice) * quantity;
                todayTotalPL += calculatedDayPL;
                calculatedDayPLCount++;
                if (index < 3) console.log(`  - Calculated dayPL: ${calculatedDayPL} (${currentPrice} - ${prevPrice}) * ${quantity}`);
              }
            }

            // Calculate previous day value for percentage calculation
            if (inv.prevDayPrice !== undefined && inv.qnty !== undefined) {
              const prevValue = (Number(inv.prevDayPrice) * Number(inv.qnty)) || 0;
              totalPreviousValue += prevValue;
            } else if (inv.cprice !== undefined && inv.qnty !== undefined) {
              // Fallback: use current price as previous day value if prevDayPrice is not available
              const fallbackPrevValue = (Number(inv.cprice) * Number(inv.qnty)) || 0;
              totalPreviousValue += fallbackPrevValue;
            }
          } catch (calcError) {
            console.error(`Error calculating today's values for investment ${inv._id}:`, calcError);
            // Continue with next investment
          }
        });

        // Calculate today's percentage gain/loss
        const todayPLPercentage = totalPreviousValue > 0
          ? parseFloat(((todayTotalPL / totalPreviousValue) * 100).toFixed(2))
          : 0.00;

        console.log(`\n=== FINAL TODAY'S GAIN/LOSS RESULTS ===`);
        console.log(`Valid existing dayPL entries: ${validDayPLCount}/${investments.length}`);
        console.log(`Calculated dayPL entries: ${calculatedDayPLCount}/${investments.length}`);
        console.log(`Total processed: ${validDayPLCount + calculatedDayPLCount}/${investments.length}`);
        console.log(`Today's total P&L: ₹${todayTotalPL.toFixed(2)}`);
        console.log(`Total previous value: ₹${totalPreviousValue.toFixed(2)}`);
        console.log(`Today's P&L percentage: ${todayPLPercentage.toFixed(2)}%`);
        console.log(`=== END DEBUG ===\n`);

        // Return the data
        return {
          investments,
          summary: {
            totalInvested,
            currentValue,
            totalProfitLoss,
            profitLossPercentage,
            investmentCount: investments.length,
            todayTotalPL,
            todayPLPercentage
          },
          sectorAllocation: sectorAllocationArray,
          brokerAllocation: brokerAllocationArray,
          timestamp: new Date().toISOString()
        };
      } catch (processingError) {
        const error = processingError as Error;
        console.error(`Error processing investment data: ${error.message || 'Unknown error'}`);
        console.error(error.stack || 'No stack trace available');
        throw createError({
          statusCode: 500,
          statusMessage: `Error processing investment data: ${error.message || 'Unknown error'}`
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
    console.error(`Unhandled error in investments.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching investment data: ${error.message || 'Unknown error'}`
    });
  }
});
