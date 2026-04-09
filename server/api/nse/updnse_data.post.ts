import CNNoteModel, { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  const maxRetries = 3;
  let retryCount = 0;

  const executeTransaction = async () => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });

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

      // Add user to formData
      const enrichedFormData = {
        ...formData,
        user: user._id
      };

      // Ensure cn_no is not null or empty
      if (!enrichedFormData.cn_no || enrichedFormData.cn_no.trim() === '') {
        throw createError({
          statusCode: 400,
          message: 'CN Number cannot be empty'
        });
      }

      // Check if a CN Note with the same cn_no already exists (excluding the current one)
      const existingCNNote = await CNNote.findOne({
        cn_no: enrichedFormData.cn_no,
        user: user._id,
        _id: { $ne: enrichedFormData.id } // Exclude the current CN Note
      });

      if (existingCNNote) {
        throw createError({
          statusCode: 400,
          message: `Another CN Note with CN Number ${enrichedFormData.cn_no} already exists`
        });
      }

      // Add user to each record
      const enrichedRecordsData = recordsData.map((record: any) => ({
        ...record,
        user: user._id
      }));

      // Update the CN Note
      const cnNote = await CNNote.findByIdAndUpdate(
        enrichedFormData.id,
        enrichedFormData,
        { new: true, session }
      );

      if (!cnNote) {
        throw createError({
          statusCode: 404,
          message: 'CN Note not found'
        });
      }

      // Delete existing Folio records for this CN Note
      await Folio.deleteMany({ cnNoteId: cnNote._id }, { session });

      // Create new Folio records
      const savedRecords = await Folio.insertMany(
        enrichedRecordsData.map((record: any) => ({
          ...record,
          cnNoteId: cnNote._id
        })),
        { session }
      );

      // Update CN Note with new Folio record IDs
      const savedRecordIds = savedRecords.map(record => record._id);
      await CNNote.findByIdAndUpdate(
        cnNote._id,
        { Folio_rec: savedRecordIds },
        { new: true, session }
      );

      await session.commitTransaction();
      return { cnNote, savedRecords };
    } catch (error: any) {
      await session.abortTransaction();
      if (error.errorLabels?.includes('TransientTransactionError') && retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying transaction attempt ${retryCount}`);
        return executeTransaction();
      }
      throw error;
    } finally {
      await session.endSession();
    }
  };

  try {
    const result = await executeTransaction();
    return {
      message: 'Data updated successfully',
      cnNote: result.cnNote,
      recordsData: result.savedRecords
    };
  } catch (error: any) {
    console.error('Error updating NSE data:', error);
    throw createError({
      statusCode: 500,
      message: 'Error updating NSE data',
      data: error.message
    });
  }
});
