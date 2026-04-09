// server/api/firms/current.ts
import { defineEventHandler, createError } from 'h3';
import User from '../../models/User';
import Firm from '../../models/Firm';
import { verifyToken } from '../../utils/auth';
import { requireManagerOrAdmin } from '../../utils/roleCheck';

export default defineEventHandler(async (event) => {
  try {
    // Verify authentication and ensure user is a manager or admin
    const user = await requireManagerOrAdmin(event);

    // Get the user's firm ID
    const userRecord = await User.findById(user.id);
    if (!userRecord) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    const firmId = userRecord.firmId;
    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is not associated with any firm'
      });
    }

    // Find the firm
    const firm = await Firm.findById(firmId);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    return firm;
  } catch (error) {
    throw error;
  }
});