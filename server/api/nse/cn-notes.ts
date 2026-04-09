import { defineEventHandler, createError, readBody, H3Event } from 'h3';
import { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';
import mongoose from 'mongoose';
import { verifyToken } from '../../utils/auth';

// Main handler that routes to the appropriate method handler
export default defineEventHandler(async (event: H3Event) => {
  console.log(`[CN-Notes API] Received ${event.method} request`);

  // Route the request based on HTTP method
  switch (event.method) {
    case 'GET':
      console.log('[CN-Notes API] Routing to GET handler');
      return handleGet(event);
    case 'POST':
      console.log('[CN-Notes API] Routing to POST handler');
      return handlePost(event);
    case 'PUT':
      console.log('[CN-Notes API] Routing to PUT handler');
      return handlePut(event);
    default:
      console.error(`[CN-Notes API] Method not allowed: ${event.method}`);
      return createError({
        statusCode: 405,
        message: `Method ${event.method} not allowed`
      });
  }
});

// GET handler
async function handleGet(event: H3Event) {
  console.log('[CN-Notes API] GET: Starting handler');
  try {
    // Verify user authentication
    console.log('[CN-Notes API] GET: Verifying user token');
    const user = await verifyToken(event);
    if (!user) {
      console.error('[CN-Notes API] GET: Unauthorized access attempt');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    console.log(`[CN-Notes API] GET: Fetching notes for user ${user._id}`);

    let cnNotes;
    try {
      // Try with explicit model reference in populate
      cnNotes = await CNNote.find({ user: user._id }).sort({ createdAt: -1 }).populate({
        path: 'Folio_rec',
        model: Folio
      });
      console.log(`[CN-Notes API] GET: Successfully retrieved ${cnNotes.length} notes with populated Folio records`);
    } catch (error) {
      const populateError = error as Error;
      console.error(`[CN-Notes API] GET: Error during populate operation: ${populateError.message}`, populateError);
      // Fall back to notes without populate if populate fails
      cnNotes = await CNNote.find({ user: user._id }).sort({ createdAt: -1 });
      console.log(`[CN-Notes API] GET: Retrieved ${cnNotes.length} notes without populated Folio records`);
    }

    return {
      status: 'success',
      data: cnNotes
    };
  } catch (error: any) {
    console.error(`[CN-Notes API] GET: Error in handler: ${error.message}`, error);
    throw createError({
      statusCode: 500,
      message: `Error fetching CN Notes: ${error.message}`
    });
  }
}

// POST handler
async function handlePost(event: H3Event) {
  console.log('[CN-Notes API] POST: Starting handler');
  try {
    console.log('[CN-Notes API] POST: Reading request body');
    const { formData, recordsData } = await readBody(event);
    console.log(`[CN-Notes API] POST: Received form data and ${recordsData?.length || 0} records`);

    const userId = event.context.auth?.user?.id;
    console.log(`[CN-Notes API] POST: User ID from context: ${userId || 'not found'}`);

    if (!userId) {
      console.error('[CN-Notes API] POST: Unauthorized access attempt - no user ID');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Add user to formData
    console.log('[CN-Notes API] POST: Enriching form data with user ID');
    const enrichedFormData = {
      ...formData,
      user: userId
    };

    // Add user to each record
    console.log('[CN-Notes API] POST: Enriching records data with user ID');
    const enrichedRecordsData = recordsData.map((record: any) => ({
      ...record,
      user: userId
    }));

    // Create CN Note and associated Folio records in a transaction
    console.log('[CN-Notes API] POST: Starting database transaction');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log('[CN-Notes API] POST: Creating CN Note');
      const cnNote = await CNNote.create([enrichedFormData], { session })
        .then((docs: any) => {
          const doc = docs[0];
          console.log(`[CN-Notes API] POST: CN Note created with ID: ${doc._id}`);
          // Add CNNote _id to each record
          enrichedRecordsData.forEach((record: any) => {
            record.cnNoteId = doc._id;
          });
          return doc;
        });

      // Insert all records into FolioModel
      console.log('[CN-Notes API] POST: Creating Folio records');
      const savedRecords = await Folio.insertMany(enrichedRecordsData, { session });
      console.log(`[CN-Notes API] POST: Created ${savedRecords.length} Folio records`);

      // Extract IDs from saved records and update CNNote
      const savedRecordIds = savedRecords.map(record => record["_id"]);
      console.log('[CN-Notes API] POST: Updating CN Note with Folio record IDs');

      try {
        await CNNote.findByIdAndUpdate(
          cnNote._id,
          { Folio_rec: savedRecordIds },
          { new: true, session }
        );
        console.log('[CN-Notes API] POST: Successfully updated CN Note with Folio record IDs');
      } catch (error) {
        const updateError = error as Error;
        console.error(`[CN-Notes API] POST: Error updating CN Note with Folio record IDs: ${updateError.message}`, updateError);
        throw updateError;
      }

      console.log('[CN-Notes API] POST: Committing transaction');
      await session.commitTransaction();
      console.log('[CN-Notes API] POST: Transaction committed successfully');

      return {
        status: 'success',
        data: {
          cnNote,
          folioRecords: savedRecords
        }
      };
    } catch (error) {
      console.error('[CN-Notes API] POST: Error in transaction, aborting', error);
      await session.abortTransaction();
      throw error;
    } finally {
      console.log('[CN-Notes API] POST: Ending database session');
      session.endSession();
    }
  } catch (error: any) {
    console.error(`[CN-Notes API] POST: Error in handler: ${error.message}`, error);
    throw createError({
      statusCode: 500,
      message: `Error creating CN Note: ${error.message}`
    });
  }
}

// PUT handler
async function handlePut(event: H3Event) {
  console.log('[CN-Notes API] PUT: Starting handler');
  try {
    console.log('[CN-Notes API] PUT: Reading request body');
    const { formData, recordsData } = await readBody(event);
    console.log(`[CN-Notes API] PUT: Received form data for ID ${formData?.id} and ${recordsData?.length || 0} records`);

    const userId = event.context.auth?.user?.id;
    console.log(`[CN-Notes API] PUT: User ID from context: ${userId || 'not found'}`);

    if (!userId) {
      console.error('[CN-Notes API] PUT: Unauthorized access attempt - no user ID');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    if (!formData.id) {
      console.error('[CN-Notes API] PUT: Missing CN Note ID in request');
      throw createError({
        statusCode: 400,
        message: 'CN Note ID is required'
      });
    }

    console.log('[CN-Notes API] PUT: Starting database transaction');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update CN Note
      console.log(`[CN-Notes API] PUT: Updating CN Note with ID: ${formData.id}`);
      const cnNote = await CNNote.findByIdAndUpdate(
        formData.id,
        { ...formData, user: userId },
        { new: true, session }
      );

      if (!cnNote) {
        console.error(`[CN-Notes API] PUT: CN Note with ID ${formData.id} not found`);
        throw createError({
          statusCode: 404,
          message: 'CN Note not found'
        });
      }
      console.log(`[CN-Notes API] PUT: CN Note updated successfully`);

      // Delete existing Folio records
      console.log(`[CN-Notes API] PUT: Deleting existing Folio records for CN Note ID: ${cnNote._id}`);
      const deleteResult = await Folio.deleteMany({ cnNoteId: cnNote._id }, { session });
      console.log(`[CN-Notes API] PUT: Deleted ${deleteResult.deletedCount} Folio records`);

      // Create new Folio records
      console.log('[CN-Notes API] PUT: Creating new Folio records');
      const savedRecords = await Folio.insertMany(
        recordsData.map((record: any) => ({
          ...record,
          user: userId,
          cnNoteId: cnNote._id
        })),
        { session }
      );
      console.log(`[CN-Notes API] PUT: Created ${savedRecords.length} new Folio records`);

      // Update CN Note with new Folio record IDs
      console.log('[CN-Notes API] PUT: Updating CN Note with new Folio record IDs');
      const savedRecordIds = savedRecords.map(record => record['_id']);

      try {
        await CNNote.findByIdAndUpdate(
          cnNote._id,
          { Folio_rec: savedRecordIds },
          { new: true, session }
        );
        console.log('[CN-Notes API] PUT: Successfully updated CN Note with new Folio record IDs');
      } catch (error) {
        const updateError = error as Error;
        console.error(`[CN-Notes API] PUT: Error updating CN Note with Folio record IDs: ${updateError.message}`, updateError);
        throw updateError;
      }

      console.log('[CN-Notes API] PUT: Committing transaction');
      await session.commitTransaction();
      console.log('[CN-Notes API] PUT: Transaction committed successfully');

      return {
        status: 'success',
        data: {
          cnNote,
          folioRecords: savedRecords
        }
      };
    } catch (error) {
      console.error('[CN-Notes API] PUT: Error in transaction, aborting', error);
      await session.abortTransaction();
      throw error;
    } finally {
      console.log('[CN-Notes API] PUT: Ending database session');
      session.endSession();
    }
  } catch (error: any) {
    console.error(`[CN-Notes API] PUT: Error in handler: ${error.message}`, error);
    throw createError({
      statusCode: 500,
      message: `Error updating CN Note: ${error.message}`
    });
  }
}