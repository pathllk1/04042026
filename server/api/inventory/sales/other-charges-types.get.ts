import { defineEventHandler, createError } from 'h3';
import Bills from '../../../models/inventory/Bills';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  // Get all bills with other charges to extract unique types
  const bills = await Bills.find({
    firm: user.firmId,
    'oth_chg.0': { $exists: true }
  }).lean();

  const chargesMap = new Map();

  bills.forEach((bill: any) => {
    if (Array.isArray(bill.oth_chg)) {
      bill.oth_chg.forEach((c: any) => {
        const key = `${c.description}-${c.oth_hsn}`;
        if (!chargesMap.has(key)) {
          chargesMap.set(key, {
            name: c.description,
            type: 'Other', // We don't store type explicitly in bill, defaulting to Other
            hsnSac: c.oth_hsn,
            gstRate: c.oth_grate
          });
        }
      });
    }
  });

  return {
    success: true,
    data: Array.from(chargesMap.values())
  };
});
