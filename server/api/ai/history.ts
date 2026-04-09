// server/api/ai/history.ts
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import AIHistory from '../../models/AIHistory';
import { verifyToken } from '../../utils/auth';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  // Verify authentication for all requests
  const user = await verifyToken(event);

  // GET - Retrieve user's AI history
  if (event.node.req.method === 'GET') {
    const query = getQuery(event);
    const type = query.type as string;
    const parentId = query.parentId as string;

    let historyQuery: any = { userId: user._id };

    // Filter by type if provided
    if (type && ['letter', 'code', 'ask', 'chat'].includes(type)) {
      historyQuery.type = type;
    }

    // If parentId is provided, get replies for that specific entry
    // Otherwise, get only top-level entries (not replies)
    if (parentId) {
      historyQuery.parentId = new mongoose.Types.ObjectId(parentId);
    } else {
      historyQuery.isReply = { $ne: true }; // Only get non-replies
    }

    // Get history entries, sorted by most recent first
    const history = await AIHistory.find(historyQuery)
      .sort({ createdAt: -1 })
      .limit(50); // Limit to most recent 50 entries

    return { history };
  }

  // POST - Save a new AI interaction to history
  if (event.node.req.method === 'POST') {
    const { type, question, answer, metadata, parentId, isReply } = await readBody(event);

    // Validate required fields
    if (!type || !question || !answer) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields'
      });
    }

    // Validate type
    if (!['letter', 'code', 'ask', 'chat'].includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid type. Must be letter, code, ask, or chat'
      });
    }

    // If this is a reply, verify the parent exists and belongs to this user
    if (parentId) {
      const parentEntry = await AIHistory.findOne({
        _id: parentId,
        userId: user._id
      });

      if (!parentEntry) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Parent entry not found or not authorized'
        });
      }
    }

    // Create and save the history entry
    const historyEntry = new AIHistory({
      userId: user._id,
      type,
      question,
      answer,
      metadata,
      parentId: parentId ? new mongoose.Types.ObjectId(parentId) : undefined,
      isReply: !!isReply || !!parentId
    });

    await historyEntry.save();

    return {
      message: 'AI interaction saved to history',
      historyEntry
    };
  }

  // DELETE - Remove a history entry
  if (event.node.req.method === 'DELETE') {
    const { id } = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'History entry ID is required'
      });
    }

    // Only allow users to delete their own history entries
    const historyEntry = await AIHistory.findOne({ _id: id, userId: user._id });

    if (!historyEntry) {
      throw createError({
        statusCode: 404,
        statusMessage: 'History entry not found or not authorized'
      });
    }

    await AIHistory.deleteOne({ _id: id, userId: user._id });

    return { message: 'History entry deleted successfully' };
  }
});