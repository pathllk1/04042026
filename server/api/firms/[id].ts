// server/api/firms/[id].ts
import { defineEventHandler, createError } from 'h3';
import Firm from '../../models/Firm';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Firm ID is required'
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
    
    return firm;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') {
      throw createError({ statusCode: 400, statusMessage: 'Invalid firm ID format' });
    }
    throw error;
  }
});