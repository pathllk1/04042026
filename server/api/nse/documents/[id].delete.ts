import { defineEventHandler, createError } from 'h3';
import { verifyToken } from '../../../utils/auth';
import { deleteFileFromGoogleDrive } from '../../../utils/googleDrive';
import mongoose from 'mongoose';
import NSEDocumentModel from '../../../models/NSEDocument';
import CNNoteModel from '../../../models/CNNote';

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

    // Get document ID from URL
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'Document ID is required'
      });
    }

    // Get runtime config to access environment variables
    const config = useRuntimeConfig();
    const googleDriveEmail = config.googleDriveEmail;
    const googleDriveKey = config.googleDriveKey;

    // Find the document
    const document = await NSEDocumentModel.findById(id);

    if (!document) {
      throw createError({
        statusCode: 404,
        message: 'Document not found'
      });
    }

    // Check if the user owns the document
    if (document.userId.toString() !== user._id.toString()) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to delete this document'
      });
    }

    // Delete the file from Google Drive
    if (document.fileId) {
      await deleteFileFromGoogleDrive(
        document.fileId,
        googleDriveEmail as string,
        googleDriveKey as string
      );
    }

    // If the document is associated with a CN Note, remove the reference
    if (document.cnNoteId) {
      await CNNoteModel.findByIdAndUpdate(
        document.cnNoteId,
        { $pull: { documents: document._id } }
      );
    }

    // Delete the document from the database
    await NSEDocumentModel.findByIdAndDelete(id);

    return {
      success: true,
      message: 'Document deleted successfully'
    };
  } catch (error: any) {
    console.error('Error deleting document:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error deleting document'
    });
  }
});
