import { defineEventHandler, getQuery } from 'h3';
import { verifyToken } from '../../utils/auth';
import { Wage } from '../../models/Wage'

export default defineEventHandler(async (event) => {
  try {
    // Verify token
    await verifyToken(event);
    const firmId = event.context.user.firmId


    // Get query parameters
    const { startDate, endDate } = getQuery(event);

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    // Find all wages paid within the date range
    const paidWages = await Wage.find({
      paid_date: {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string)
      }, firmId: firmId
    }).select('masterRollId');

    return paidWages;
  } catch (error) {
    throw error;
  }
});