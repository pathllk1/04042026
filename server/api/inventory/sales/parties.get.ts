import { defineEventHandler, createError } from 'h3';
import Party from '../../../models/inventory/Party';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  const parties = await Party.find({
    firm: user.firmId
  }).lean();

  return {
    success: true,
    data: parties.map((p: any) => ({
      ...p,
      id: p._id.toString()
    }))
  };
});
