import { MasterRoll } from '../../models/MasterRoll';
import { createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;
    const firmId = event.context.user?.firmId;
    
    console.log(`[MasterRoll] Fetching employees for userId: ${userId}, firmId: ${firmId}`);
    
    // Connect to database
    let query = {};
    if (firmId) {
      query = { firmId };
    } else {
      console.warn('[MasterRoll] No firmId found in user context, fetching all employees for debug');
    }

    const employees = await MasterRoll.find(query).sort({ employeeName: 1 })
    
    console.log(`[MasterRoll] Found ${employees.length} employees`);
    
    return {
      employees
    }
  } catch (error: any) {
    console.error('[MasterRoll] Error fetching employees:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
})
