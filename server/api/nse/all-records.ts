import { defineEventHandler, createError } from 'h3';
import { NSE } from '../../models/NSE';

export default defineEventHandler(async (event) => {
  try {
    const nseRecords = await NSE.find().sort({ createdAt: -1 });
    return nseRecords;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Error retrieving NSE records',
      cause: error
    });
  }
});