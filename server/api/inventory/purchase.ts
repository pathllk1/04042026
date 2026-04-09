// server/api/inventory/purchase.ts
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
    // Get all purchase bills for the user's firm
    const purchaseBills = await Bills.find({ 
      firm: firmId,
      btype: 'PURCHASE'
    }).sort({ bdate: -1 });

    // Get related stock registrations and parties
    const billIds = purchaseBills.map(bill => bill._id);
    
    const stockItems = await StockReg.find({
      firm: firmId,
      billId: { $in: billIds },
      type: 'PURCHASE'
    });

    // Get unique party IDs from purchase bills
    const partyIds = [...new Set(purchaseBills.map(bill => bill.partyId))];
    const parties = await Party.find({
      firm: firmId,
      _id: { $in: partyIds }
    });

    return {
      purchaseBills,
      stockItems,
      parties
    };
  } catch (error: any) {
    console.error('Error fetching purchase data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching purchase data: ${error.message}`
    });
  }
});