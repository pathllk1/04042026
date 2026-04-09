// server/api/inventory/purchase/[id].ts
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
    // Find the bill by ID
    const bill = await Bills.findById(id);
    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Purchase bill not found'
      });
    }

    // Verify that this is a purchase bill
    if (bill.btype !== 'PURCHASE') {
      throw createError({
        statusCode: 400,
        statusMessage: 'This is not a purchase bill'
      });
    }

    // Get stock items associated with this bill
    const stockItems = await StockReg.find({ billId: id });

    // Return the bill and stock items
    return {
      bill,
      stockItems
    };
  } catch (error) {
    console.error('Error fetching purchase bill:', error);

    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch purchase bill: ${error.message}`
    });
  }
});
