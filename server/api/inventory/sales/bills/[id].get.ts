import { defineEventHandler, createError } from 'h3';
import Bills from '../../../../models/inventory/Bills';
import StockReg from '../../../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bill ID is required'
    });
  }

  const bill = await Bills.findOne({
    _id: id,
    firm: user.firmId
  }).populate({
    path: 'stockRegIds',
    model: StockReg
  }).lean();

  if (!bill) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Bill not found'
    });
  }

  return {
    success: true,
    data: {
      ...bill,
      items: bill.stockRegIds
    }
  };
});
