// server/api/inventory/bills/[id].ts
import { defineEventHandler, createError } from 'h3';
import Bills from '../../../models/inventory/Bills';
import StockReg from '../../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated and has a firmId
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
    });
  }

  // Get the bill ID from the URL
  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bill ID is required'
    });
  }

  try {
    // Fetch the bill with populated stockRegIds
    const bill = await Bills.findById(id)
      .populate('stockRegIds')
      .lean();

    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bill not found'
      });
    }

    // Check if the bill belongs to the user's firm
    if (bill.firm.toString() !== user.firmId.toString()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: You do not have permission to access this bill'
      });
    }

    // Transform the populated data structure
    const billWithStockItems = {
      ...bill,
      stockItems: bill.stockRegIds || []
    };

    return billWithStockItems;
  } catch (error) {
    console.error('Error fetching bill data:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: `Error fetching bill data: ${error.message}`
    });
  }
});
