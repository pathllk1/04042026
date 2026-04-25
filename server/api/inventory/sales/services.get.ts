import { defineEventHandler, createError } from 'h3';
import StockReg from '../../../models/inventory/StockReg';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  // Get unique service items from history
  const services = await StockReg.find({
    firm: user.firmId,
    type: 'SALES',
    // Logic: items without stockId are likely services, or we can filter by some other flag
    // For now, let's just get items that were used in previous bills
  }).lean();

  // Filter for unique names and return a simple list
  const uniqueServices = Array.from(new Set(services.map((s: any) => s.item)))
    .map(name => {
      const original = services.find((s: any) => s.item === name);
      return {
        item: name,
        hsn: original.hsn,
        uom: original.uom,
        rate: original.rate,
        grate: original.grate
      };
    });

  return {
    success: true,
    data: uniqueServices
  };
});
