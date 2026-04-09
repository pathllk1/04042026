import { defineEventHandler, createError } from 'h3';
import { CNNote } from '../../../models/CNNote';
import { Folio } from '../../../models/Folio';
import { verifyToken } from '../../../utils/auth';

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

    // Get CN Note ID from URL
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'CN Note ID is required'
      });
    }

    // Find the CN Note
    const cnNote = await CNNote.findOne({ _id: id, user: user._id });
    if (!cnNote) {
      throw createError({
        statusCode: 404,
        message: 'CN Note not found'
      });
    }

    // Delete associated Folio records
    await Folio.deleteMany({ cnNoteId: id, user: user._id });

    // Delete the CN Note
    await CNNote.findByIdAndDelete(id);

    return {
      status: 'success',
      message: 'CN Note and associated records deleted successfully'
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: `Error deleting CN Note: ${error.message}`
    });
  }
});
