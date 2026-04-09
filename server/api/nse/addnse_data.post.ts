import CNNoteModel, { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';
import mongoose from 'mongoose';

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

    // Get request body
    const { formData, recordsData } = await readBody(event);

    // Start MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Add user and firmId to formData and create CNNote
      const enrichedFormData = {
        ...formData,
        user: user._id,
        firmId: formData.firmId || user.firmId || user._id // Use provided firmId or default to user's firmId or user._id
      };

      // Ensure cn_no is not null or empty
      if (!enrichedFormData.cn_no || enrichedFormData.cn_no.trim() === '') {
        throw createError({
          statusCode: 400,
          message: 'CN Number cannot be empty'
        });
      }

      // Check if a CN Note with the same cn_no already exists
      const existingCNNote = await CNNote.findOne({ cn_no: enrichedFormData.cn_no, user: user._id });
      if (existingCNNote) {
        throw createError({
          statusCode: 400,
          message: `A CN Note with CN Number ${enrichedFormData.cn_no} already exists`
        });
      }

      // Add user to each record
      const enrichedRecordsData = recordsData.map((record: any) => ({
        ...record,
        user: user._id
      }));

      // Create CN Note
      const cnNote = await CNNote.create([enrichedFormData], { session }).then((docs: any) => {
        const doc = docs[0];
        // Add CNNote _id to each record
        enrichedRecordsData.forEach((record: any) => {
          record.cnNoteId = doc._id;
        });
        return doc;
      });

      // Insert all records into Folio model
      const savedRecords = await Folio.insertMany(enrichedRecordsData, { session });

      // Extract IDs from saved records and update CNNote
      const savedRecordIds = savedRecords.map(record => record._id);
      await CNNote.findByIdAndUpdate(
        cnNote._id,
        { Folio_rec: savedRecordIds },
        { new: true, session }
      );

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      return {
        message: 'Data saved successfully',
        cnNote,
        recordsData: savedRecords
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error submitting NSE data:', error);
    throw createError({
      statusCode: 500,
      message: 'Error submitting NSE data'
    });
  }
});
