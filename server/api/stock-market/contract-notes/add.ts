// server/api/stock-market/contract-notes/add.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { CNNote } from '../../../models/CNNote';
import { Folio } from '../../../models/Folio';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  console.log('[Contract Notes Add API] Starting handler');
  try {
    // Ensure user is authenticated
    const user = event.context.user;
    if (!user) {
      console.error('[Contract Notes Add API] Authentication error: User not authenticated');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }

    // Get the user ID from the authenticated user
    const userId = user._id.toString();
    console.log(`[Contract Notes Add API] Processing request for user ID: ${userId}`);

    // Read request body
    console.log('[Contract Notes Add API] Reading request body');
    const { formData, recordsData } = await readBody(event);
    console.log(`[Contract Notes Add API] Received form data and ${recordsData?.length || 0} records`);

    // Validate required fields
    if (!formData || !recordsData || recordsData.length === 0) {
      console.error('[Contract Notes Add API] Missing required data in request');
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Missing required data'
      });
    }

    // Validate CN Number
    if (!formData.cn_no || formData.cn_no.trim() === '') {
      console.error('[Contract Notes Add API] Missing CN Number');
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: CN Number is required'
      });
    }

    // Check if CN Number already exists for this user
    const existingCNNote = await CNNote.findOne({ cn_no: formData.cn_no, user: userId });
    if (existingCNNote) {
      console.error(`[Contract Notes Add API] CN Number ${formData.cn_no} already exists for user ${userId}`);
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict: CN Number already exists'
      });
    }

    // Start a transaction
    console.log('[Contract Notes Add API] Starting database transaction');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Prepare CN Note data
      const enrichedFormData = {
        ...formData,
        user: userId,
        cn_date: new Date(formData.cn_date)
      };

      // Create CN Note
      console.log('[Contract Notes Add API] Creating CN Note');
      const cnNote = await CNNote.create([enrichedFormData], { session })
        .then((docs) => {
          const doc = docs[0];
          console.log(`[Contract Notes Add API] CN Note created with ID: ${doc._id}`);
          return doc;
        });

      // Prepare Folio records
      const enrichedRecordsData = recordsData.map((record) => ({
        ...record,
        user: userId,
        cn_no: formData.cn_no,
        broker: formData.broker,
        type: formData.type,
        folio: formData.folio,
        pdate: new Date(formData.cn_date),
        cnNoteId: cnNote._id
      }));

      // Create Folio records
      console.log('[Contract Notes Add API] Creating Folio records');
      const folioRecords = await Folio.create(enrichedRecordsData, { session });
      console.log(`[Contract Notes Add API] Created ${folioRecords.length} Folio records`);

      // Update CN Note with Folio record IDs
      console.log('[Contract Notes Add API] Updating CN Note with Folio record IDs');
      await CNNote.findByIdAndUpdate(
        cnNote._id,
        { $push: { Folio_rec: { $each: folioRecords.map(record => record._id) } } },
        { session }
      );

      // Commit the transaction
      console.log('[Contract Notes Add API] Committing transaction');
      await session.commitTransaction();
      session.endSession();

      // Return success response
      console.log('[Contract Notes Add API] Successfully added contract note');
      return {
        success: true,
        message: 'Contract note added successfully',
        cnNote: {
          ...cnNote.toObject(),
          Folio_rec: folioRecords.map(record => record.toObject())
        }
      };
    } catch (transactionError) {
      // Abort the transaction on error
      console.error('[Contract Notes Add API] Transaction error:', transactionError);
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (err) {
    const error = err as Error;
    console.error(`[Contract Notes Add API] Error: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    
    // Return appropriate error response
    throw createError({
      statusCode: error.name === 'MongoServerError' && (error as any).code === 11000 ? 409 : 500,
      statusMessage: error.name === 'MongoServerError' && (error as any).code === 11000 
        ? 'Conflict: Duplicate CN Number' 
        : `Error adding contract note: ${error.message || 'Unknown error'}`
    });
  }
});
