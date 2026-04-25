import { defineEventHandler, createError } from 'h3';
import Firm from '../../../models/Firm';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Missing firm ID'
    });
  }

  const firm = await Firm.findById(user.firmId).lean();
  if (!firm) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Firm not found'
    });
  }

  const locations = [
    {
      gst_number: firm.gstNo,
      state: firm.state,
      state_code: firm.gstNo?.substring(0, 2),
      is_default: true,
      address: firm.address,
      city: firm.city,
      pincode: firm.pincode
    },
    ...(firm.additionalGSTs || []).map((l: any) => ({
      gst_number: l.gstNumber,
      state: l.state,
      state_code: l.stateCode?.toString().padStart(2, '0') || l.gstNumber?.substring(0, 2),
      is_default: l.isDefault || false,
      address: l.address,
      city: l.city,
      pincode: l.pincode
    }))
  ];

  return {
    success: true,
    data: {
      name: firm.name,
      locations
    }
  };
});
