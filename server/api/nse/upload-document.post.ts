import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { verifyToken } from '../../utils/auth';
import { uploadToGoogleDrive } from '../../utils/googleDrive';
import mongoose from 'mongoose';
import NSEDocumentModel from '../../models/NSEDocument';
import CNNoteModel from '../../models/CNNote';

// Import the interface from the model
import { INSEDocument } from '../../models/NSEDocument';

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

    // Get runtime config to access environment variables
    const config = useRuntimeConfig();
    const folderId = config.googleDriveFolderId;
    const googleDriveEmail = config.googleDriveEmail;
    const googleDriveKey = config.googleDriveKey;

    // Read the uploaded file from multipart form data
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'No file uploaded'
      });
    }

    // Extract file and form fields
    const fileField = formData.find(field => field.name === 'file');
    const typeField = formData.find(field => field.name === 'type');
    const descriptionField = formData.find(field => field.name === 'description');
    const cnNoteIdField = formData.find(field => field.name === 'cnNoteId');

    if (!fileField || !fileField.data) {
      throw createError({
        statusCode: 400,
        message: 'No file found in the request'
      });
    }

    if (!typeField || !typeField.data || !descriptionField || !descriptionField.data) {
      throw createError({
        statusCode: 400,
        message: 'Missing required fields'
      });
    }

    // Convert fields to strings
    const type = Buffer.from(typeField.data).toString('utf-8');
    const description = Buffer.from(descriptionField.data).toString('utf-8');
    const cnNoteId = cnNoteIdField ? Buffer.from(cnNoteIdField.data).toString('utf-8') : undefined;

    // Convert fileField.data to a proper Node.js Buffer
    let fileBuffer: Buffer;
    if (Buffer.isBuffer(fileField.data)) {
      fileBuffer = fileField.data;
    } else {
      fileBuffer = Buffer.from(new Uint8Array(fileField.data as any));
    }

    // Get the filename and mime type
    const fileName = fileField.filename || `document_${Date.now()}`;
    const mimeType = fileField.type || 'application/octet-stream';

    // Get firmId from the user context
    const firmId = user.firmId?.toString() || 'default_firm';
    const userId = user._id.toString();

    // Upload the file to Google Drive with folder organization
    const uploadResult = await uploadToGoogleDrive(
      fileBuffer,
      fileName,
      mimeType,
      folderId,
      firmId,
      userId,
      googleDriveEmail as string,
      googleDriveKey as string
    );

    // Create a new document record in the database
    const document = new NSEDocumentModel({
      type,
      description,
      file: uploadResult.fileUrl,
      fileId: uploadResult.fileId,
      userId: user._id,
      cnNoteId: cnNoteId || undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await document.save();

    // If cnNoteId is provided, update the CN Note with the document reference
    if (cnNoteId) {
      await CNNoteModel.findByIdAndUpdate(
        cnNoteId,
        { $push: { documents: document._id } },
        { new: true }
      );
    }

    // Return the document data
    return {
      success: true,
      document: {
        id: document._id,
        type: document.type,
        description: document.description,
        file: document.file,
        fileId: document.fileId,
        createdAt: document.createdAt
      }
    };
  } catch (error: any) {
    console.error('Error uploading document:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error uploading document'
    });
  }
});
