import { defineEventHandler, getQuery, createError } from 'h3';
import { verifyToken } from '../../../utils/auth';
import mongoose from 'mongoose';
import NSEDocumentModel from '../../../models/NSEDocument';

export default defineEventHandler(async (event) => {
  try {
    // Verify user authentication
    const user = await verifyToken(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get query parameters
    const query = getQuery(event);
    const cnNoteId = query.cnNoteId as string;

    // Build query object
    const queryObj: any = { userId: user._id };
    if (cnNoteId) {
      queryObj.cnNoteId = cnNoteId;
    }

    // Find documents
    const documents = await NSEDocumentModel.find(queryObj).sort({ createdAt: -1 });

    return documents.map(doc => ({
      id: doc._id,
      type: doc.type,
      description: doc.description,
      file: doc.file,
      fileId: doc.fileId,
      cnNoteId: doc.cnNoteId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error fetching documents'
    });
  }
});
