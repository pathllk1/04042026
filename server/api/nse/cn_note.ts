import CNNoteModel, { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  console.log(`[CN_Note API] Received ${event.method} request`);
  try {
    // Verify user authentication
    console.log('[CN_Note API] Verifying user token');
    const user = await verifyToken(event);
    if (!user) {
      console.error('[CN_Note API] Unauthorized access attempt');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    console.log(`[CN_Note API] User authenticated: ${user._id}`);

    // Get all CN Notes for the user and populate Folio records
    console.log(`[CN_Note API] Fetching CN Notes for user: ${user._id}`);

    let cnNotes;
    try {
      // Try with explicit model reference in populate
      cnNotes = await CNNote.find({ user: user._id }).populate({
        path: 'Folio_rec',
        model: Folio
      });
      console.log(`[CN_Note API] Successfully retrieved ${cnNotes.length} CN Notes with populated Folio records`);
    } catch (error) {
      const populateError = error as Error;
      console.error(`[CN_Note API] Error during populate operation: ${populateError.message}`, populateError);
      // Fall back to notes without populate if populate fails
      cnNotes = await CNNote.find({ user: user._id });
      console.log(`[CN_Note API] Retrieved ${cnNotes.length} CN Notes without populated Folio records`);
    }

    return cnNotes;
  } catch (error: any) {
    console.error(`[CN_Note API] Error: ${error.message}`, error);
    throw createError({
      statusCode: 500,
      message: `Error fetching CN Notes: ${error.message}`
    });
  }
});
