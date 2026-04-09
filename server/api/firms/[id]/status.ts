// server/api/firms/[id]/status.ts
import { defineEventHandler, readBody, createError } from 'h3';
import Firm from '../../../models/Firm';
import { verifyToken } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  // Verify authentication
  const user = await verifyToken(event);
  
  // Only admins can change firm status
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only admins can change firm status'
    });
  }

  const id = event.context.params?.id;
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Firm ID is required'
    });
  }

  // Get the new status from request body
  const { status } = await readBody(event);

  // Validate status value
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid status. Must be pending, approved, or rejected'
    });
  }

  try {
    const firm = await Firm.findById(id);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    // Update firm status
    firm.status = status;
    await firm.save();

    return { 
      message: `Firm ${status} successfully`, 
      firm 
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid firm ID format' });
    }
    throw error;
  }
});