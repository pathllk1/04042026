// server/api/stock-market/contract-note-update.ts
import { defineEventHandler, createError, readBody } from 'h3';
import { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const user = event.context.user;
    if (!user) {
      console.error('Authentication error: User not authenticated');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }

    // Get the user ID from the authenticated user
    const userId = user._id.toString();
    
    // Get the contract note data from the request body
    const contractNoteData = await readBody(event);
    
    // Ensure the contract note exists and belongs to the user
    const contractNoteId = contractNoteData._id;
    if (!contractNoteId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Contract note ID is required'
      });
    }
    
    try {
      // Find the contract note
      const existingNote = await CNNote.findOne({ 
        _id: contractNoteId,
        user: userId
      });
      
      if (!existingNote) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Not Found: Contract note not found or does not belong to the user'
        });
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Update the contract note
        const updatedNote = await CNNote.findByIdAndUpdate(
          contractNoteId,
          {
            cn_no: contractNoteData.cn_no,
            cn_date: contractNoteData.cn_date,
            broker: contractNoteData.broker,
            type: contractNoteData.type,
            folio: contractNoteData.folio,
            oth_chg: contractNoteData.oth_chg,
            famt: contractNoteData.famt,
            updatedAt: new Date()
          },
          { new: true, session }
        );
        
        // Handle securities (Folio records)
        if (contractNoteData.Folio_rec && Array.isArray(contractNoteData.Folio_rec)) {
          // Get existing Folio records for this contract note
          const existingFolioRecords = await Folio.find({ cn_no: contractNoteData.cn_no, user: userId });
          
          // Create a map of existing records by ID
          const existingFolioMap = new Map();
          existingFolioRecords.forEach(record => {
            existingFolioMap.set(record._id.toString(), record);
          });
          
          // Process each Folio record in the request
          for (const folioData of contractNoteData.Folio_rec) {
            if (folioData._id && existingFolioMap.has(folioData._id)) {
              // Update existing record
              await Folio.findByIdAndUpdate(
                folioData._id,
                {
                  symbol: folioData.symbol,
                  price: folioData.price,
                  qnty: folioData.qnty,
                  amt: folioData.amt,
                  brokerage: folioData.brokerage,
                  broker: contractNoteData.broker,
                  pdate: contractNoteData.cn_date,
                  namt: folioData.namt,
                  folio: contractNoteData.folio,
                  type: contractNoteData.type,
                  sector: folioData.sector,
                  updatedAt: new Date()
                },
                { session }
              );
              
              // Remove from map to track which ones were processed
              existingFolioMap.delete(folioData._id);
            } else {
              // Create new record
              await Folio.create([{
                cn_no: contractNoteData.cn_no,
                symbol: folioData.symbol,
                price: folioData.price,
                qnty: folioData.qnty,
                amt: folioData.amt,
                brokerage: folioData.brokerage,
                broker: contractNoteData.broker,
                pdate: contractNoteData.cn_date,
                namt: folioData.namt,
                folio: contractNoteData.folio,
                type: contractNoteData.type,
                sector: folioData.sector,
                user: userId,
                rid: contractNoteId
              }], { session });
            }
          }
          
          // Delete any records that were not in the request
          const recordsToDelete = Array.from(existingFolioMap.keys());
          if (recordsToDelete.length > 0) {
            await Folio.deleteMany({ _id: { $in: recordsToDelete } }, { session });
          }
        }
        
        // Commit the transaction
        await session.commitTransaction();
        
        // Fetch the updated contract note with populated Folio records
        const updatedContractNote = await CNNote.findById(contractNoteId)
          .populate({
            path: 'Folio_rec',
            model: Folio,
            options: { lean: true }
          })
          .lean();
        
        return {
          success: true,
          contractNote: updatedContractNote,
          message: 'Contract note updated successfully'
        };
      } catch (transactionError) {
        // Abort the transaction on error
        await session.abortTransaction();
        throw transactionError;
      } finally {
        // End the session
        session.endSession();
      }
    } catch (dbError) {
      const error = dbError as Error;
      console.error(`Database error: ${error.message || 'Unknown database error'}`);
      console.error(error.stack || 'No stack trace available');
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message || 'Unknown database error'}`
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Unhandled error in contract-note-update.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error updating contract note: ${error.message || 'Unknown error'}`
    });
  }
});
