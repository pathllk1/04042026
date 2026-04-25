import { defineEventHandler, createError, getQuery } from 'h3';
import Bills from '../../../models/inventory/Bills';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  const query = getQuery(event);
  const type = query.type as string || 'SALES';

  // Find the last bill of this type for this firm
  const lastBill = await Bills.findOne({
    firm: user.firmId,
    btype: type
  }).sort({ createdAt: -1 }).lean();

  let nextBillNumber = '1';

  if (lastBill && lastBill.bno) {
    // Try to extract numeric part
    const match = lastBill.bno.match(/(\d+)(?!.*\d)/);
    if (match) {
      const lastNum = parseInt(match[0]);
      const prefix = lastBill.bno.substring(0, match.index);
      nextBillNumber = prefix + (lastNum + 1).toString().padStart(match[0].length, '0');
    } else {
      nextBillNumber = lastBill.bno + '-1';
    }
  }

  return {
    success: true,
    nextBillNumber
  };
});
