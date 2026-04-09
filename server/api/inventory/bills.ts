// server/api/inventory/bills.ts
import { defineEventHandler, createError } from 'h3';
import Bills from '../../models/inventory/Bills';
import StockReg from '../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      console.error('Authentication error: User not authenticated or missing firm ID');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Get the firm ID from the authenticated user
    const firmId = user.firmId.toString();
    console.log(`Fetching bills for firm ID: ${firmId}`);

    try {
      // Fetch bills without populate first to see if that works
      const billsWithoutPopulate = await Bills.find({ firm: firmId })
        .sort({ bdate: -1 })
        .lean();

      console.log(`Found ${billsWithoutPopulate.length} bills without populate`);

      // Now try with populate - handle potential populate errors
      let bills;
      try {
        bills = await Bills.find({ firm: firmId })
          .populate({
            path: 'stockRegIds',
            model: StockReg,
            options: { lean: true }
          })
          .sort({ bdate: -1 })
          .lean();
      } catch (populateError) {
        console.error('Error during populate operation:', populateError);
        // Fall back to bills without populate if populate fails
        bills = billsWithoutPopulate;
      }

      console.log(`Successfully populated ${bills.length} bills`);

      // Transform the populated data structure with error handling
      const billsWithStockItems = bills.map(bill => {
        try {
          return {
            ...bill,
            stockItems: Array.isArray(bill.stockRegIds) ? bill.stockRegIds : []
          };
        } catch (error) {
          const mapError = error as Error;
          console.error(`Error mapping bill ${bill._id}: ${mapError.message || 'Unknown error'}`);
          // Return a safe version of the bill without stockItems
          return {
            ...bill,
            stockItems: []
          };
        }
      });

      console.log(`Successfully transformed ${billsWithStockItems.length} bills`);

      return {
        bills: billsWithStockItems
      };
    } catch (error) {
      const dbError = error as Error;
      console.error(`Database error: ${dbError.message || 'Unknown database error'}`);
      console.error(dbError.stack || 'No stack trace available');
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${dbError.message || 'Unknown database error'}`
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Unhandled error in bills.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching bills data: ${error.message || 'Unknown error'}`
    });
  }
});