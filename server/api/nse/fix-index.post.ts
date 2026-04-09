import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import { verifyToken } from '../../utils/auth';
import { CNNote } from '../../models/CNNote';

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

    // Try to fix the database using Mongoose models first
    let droppedIndexes = [];
    let createdIndexes = [];
    let updateResult = { modifiedCount: 0 };
    let removeResult = { modifiedCount: 0 };

    try {
      // Get all CN Notes
      const cnNotes = await CNNote.find({ user: user._id });
      console.log(`Found ${cnNotes.length} CN Notes for user ${user._id}`);

      // Check for any CN Notes with null cn_no
      const nullCnNotes = cnNotes.filter(note => !note.cn_no);
      if (nullCnNotes.length > 0) {
        console.log(`Found ${nullCnNotes.length} CN Notes with null cn_no`);

        // Update each CN Note with a unique cn_no
        for (const note of nullCnNotes) {
          note.cn_no = `CN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await note.save();
          updateResult.modifiedCount++;
        }
      }

      // Try to access the database directly if possible
      if (mongoose.connection.readyState === 1) { // 1 = connected
        const db = mongoose.connection.db;
        const collection = db.collection('cnnotes');

        // Get all indexes
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        // Find and drop the problematic indexes
        for (const index of indexes) {
          if (index.name === 'cnNumber_1') {
            console.log('Found problematic index: cnNumber_1');
            await collection.dropIndex('cnNumber_1');
            droppedIndexes.push('cnNumber_1');
            console.log('Successfully dropped the cnNumber_1 index');
          }

          if (index.name === 'firmId_1_cnNumber_1') {
            console.log('Found problematic index: firmId_1_cnNumber_1');
            await collection.dropIndex('firmId_1_cnNumber_1');
            droppedIndexes.push('firmId_1_cnNumber_1');
            console.log('Successfully dropped the firmId_1_cnNumber_1 index');
          }
        }

        // Update all documents to ensure they have a cn_no field and firmId
        const dbUpdateResult = await collection.updateMany(
          {},
          [
            {
              $set: {
                // If cn_no doesn't exist, use cnNumber, otherwise keep cn_no
                cn_no: { $ifNull: ["$cn_no", { $ifNull: ["$cnNumber", `CN-${Date.now()}-${Math.floor(Math.random() * 1000)}`] }] },
                // Set firmId to user's firmId or a default value
                firmId: { $ifNull: ["$firmId", user.firmId || user._id] }
              }
            }
          ]
        );

        updateResult.modifiedCount += dbUpdateResult.modifiedCount;
        console.log(`Updated ${dbUpdateResult.modifiedCount} documents`);

        // Remove problematic fields from all documents
        const dbRemoveResult = await collection.updateMany(
          { $or: [{ cnNumber: { $exists: true } }, { firmId: null }] },
          { $unset: { cnNumber: "" } }
        );

        // Update null firmId values
        const firmIdUpdateResult = await collection.updateMany(
          { firmId: null },
          { $set: { firmId: user.firmId || user._id } }
        );

        console.log(`Updated ${firmIdUpdateResult.modifiedCount} documents with null firmId`);

        removeResult.modifiedCount += dbRemoveResult.modifiedCount;
        console.log(`Removed cnNumber field from ${dbRemoveResult.modifiedCount} documents`);
      } else {
        console.log('MongoDB connection not available for direct access');
      }
    } catch (dbError) {
      console.error('Error accessing database directly:', dbError);
      console.log('Continuing with model-based fixes...');
    }

    // Create the correct compound index using the model
    try {
      // This will ensure the index is created if it doesn't exist
      await CNNote.createIndexes();
      createdIndexes.push('cn_no_1_user_1');
      console.log('Created/verified compound index on cn_no and user');
    } catch (indexError) {
      console.error('Error creating indexes:', indexError);
    }

    // Get current indexes for the response
    let updatedIndexes = [];
    try {
      if (mongoose.connection.readyState === 1) {
        const db = mongoose.connection.db;
        const collection = db.collection('cnnotes');
        updatedIndexes = await collection.indexes();
        console.log('Updated indexes:', JSON.stringify(updatedIndexes, null, 2));
      }
    } catch (error) {
      console.error('Error getting updated indexes:', error);
    }

    return {
      status: 'success',
      message: 'Database indexes fixed successfully',
      droppedIndexes,
      createdIndexes,
      currentIndexes: updatedIndexes,
      updatedDocuments: updateResult?.modifiedCount || 0,
      removedFields: removeResult?.modifiedCount || 0
    };
  } catch (error: any) {
    console.error('Error fixing indexes:', error);
    throw createError({
      statusCode: 500,
      message: `Error fixing database indexes: ${error.message}`
    });
  }
});
