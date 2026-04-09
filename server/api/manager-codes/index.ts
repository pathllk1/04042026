// server/api/manager-codes/index.ts
import { defineEventHandler, readBody, createError } from 'h3';
import ManagerCode from '../../models/ManagerCode';
import { verifyToken } from '../../utils/auth';
import { nanoid } from 'nanoid';

export default defineEventHandler(async (event) => {
  // Verify admin authentication for all requests
  const user = await verifyToken(event);
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only admins can manage manager codes'
    });
  }

  // GET - List all manager codes
  if (event.node.req.method === 'GET') {
    const codes = await ManagerCode.find()
      .sort({ createdAt: -1 })
      .select('code used usedAt usedBy createdAt');
    return { codes };
  }

  // POST - Generate new manager codes
  if (event.node.req.method === 'POST') {
    const body = await readBody(event) || {};
    const count = parseInt(body.count?.toString() || '1');
    
    // Validate count is a positive number
    if (isNaN(count) || count < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Count must be a positive number'
      });
    }
    
    // Limit the number of codes that can be generated at once
    if (count > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Count must be between 1 and 100'
      });
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = new ManagerCode({
        code: nanoid(10), // Generate a unique 10-character code
        createdBy: user._id
      });
      await code.save();
      codes.push(code);
    }

    return { 
      message: `Successfully generated ${count} manager code(s)`,
      codes 
    };
  }

  // DELETE - Delete unused manager codes
  if (event.node.req.method === 'DELETE') {
    const { codes } = await readBody(event);
    
    if (!Array.isArray(codes) || codes.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please provide an array of code IDs to delete'
      });
    }

    // Only allow deletion of unused codes
    const result = await ManagerCode.deleteMany({
      _id: { $in: codes },
      used: false
    });

    return { 
      message: `Successfully deleted ${result.deletedCount} unused manager code(s)`,
      deletedCount: result.deletedCount
    };
  }
});