import { defineEventHandler, createError } from 'h3';
import Firm from '../../../models/Firm';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    return {
      success: true,
      data: { gst_enabled: true }
    };
  }

  const firm = await Firm.findById(user.firmId).lean();
  
  return {
    success: true,
    data: {
      gst_enabled: !!(firm && firm.gstNo && firm.gstNo !== 'UNREGISTERED')
    }
  };
});
