// server/api/inventory/sales.ts
import { defineEventHandler, createError } from 'h3';
import Bills from '../../models/inventory/Bills';
import StockReg from '../../models/inventory/StockReg';
import Party from '../../models/inventory/Party';

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated and has a firmId
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
    });
  }

  // Get the firm ID from the authenticated user
  const firmId = user.firmId.toString();

  try {
    // Get all sales bills for the user's firm
    const salesBills = await Bills.find({
      firm: firmId,
      btype: 'SALES'
    }).sort({ bdate: -1 });

    // Get related stock registrations and parties
    const billIds = salesBills.map(bill => bill._id);

    const stockItems = await StockReg.find({
      firm: firmId,
      billId: { $in: billIds },
      type: 'SALES'
    });

    // Get unique party IDs from sales bills
    const partyIds = [...new Set(salesBills.map(bill => bill.partyId))];
    const parties = await Party.find({
      firm: firmId,
      _id: { $in: partyIds }
    });

    return {
      salesBills,
      stockItems,
      parties
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching sales data: ${error.message}`
    });
  }
});