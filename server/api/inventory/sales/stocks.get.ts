import { defineEventHandler, createError } from 'h3';
import Stocks from '../../../models/inventory/Stocks';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  const stocks = await Stocks.find({
    firm: user.firmId
  }).lean();

  return {
    success: true,
    data: stocks.map((s: any) => ({
      ...s,
      id: s._id.toString()
    }))
  };
});
