// server/api/inventory/credit-note.ts
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
    // Get all credit note bills for the user's firm
    const creditNoteBills = await Bills.find({ 
      firm: firmId,
      btype: 'CREDIT NOTE'
    }).sort({ bdate: -1 });

    // Get related stock registrations and parties
    const billIds = creditNoteBills.map(bill => bill._id);
    
    const stockItems = await StockReg.find({
      firm: firmId,
      billId: { $in: billIds },
      type: 'CREDIT NOTE'
    });

    // Get unique party IDs from credit note bills
    const partyIds = [...new Set(creditNoteBills.map(bill => bill.partyId))];
    const parties = await Party.find({
      firm: firmId,
      _id: { $in: partyIds }
    });

    return {
      creditNoteBills,
      stockItems,
      parties
    };
  } catch (error: any) {
    console.error('Error fetching credit note data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching credit note data: ${error.message}`
    });
  }
});