import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { uploadToGoogleDrive } from '../../utils/googleDrive';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Get runtime config to access environment variables
    const config = useRuntimeConfig();
    const folderId = config.googleDriveFolderId;

    // Verify authentication token
    const user = await verifyToken(event);
    if (!user || !user._id) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get userId from the authenticated user
    const userId = user._id;

    // Read the uploaded file from multipart form data
    console.log('Reading multipart form data...');
    const formData = await readMultipartFormData(event);
    console.log('FormData received:', formData ? formData.length : 'none');

    if (!formData || formData.length === 0) {
      console.error('No form data received');
      throw createError({
        statusCode: 400,
        message: 'No file uploaded'
      });
    }

    // Log all form fields for debugging
    formData.forEach((field, index) => {
      console.log(`Field ${index}:`, {
        name: field.name,
        filename: field.filename,
        type: field.type,
        data: field.data ? 'Data present' : 'No data'
      });
    });

    const fileField = formData.find(field => field.name === 'file');
    if (!fileField || !fileField.data) {
      console.error('No file field found in the request');
      throw createError({
        statusCode: 400,
        message: 'No file found in the request'
      });
    }

    // Convert fileField.data to a proper Node.js Buffer
    let fileBuffer: Buffer;
    if (Buffer.isBuffer(fileField.data)) {
      // If it's already a Buffer, use it directly
      fileBuffer = fileField.data;
    } else {
      // Otherwise, convert it
      fileBuffer = Buffer.from(new Uint8Array(fileField.data as any));
    }

    // Get the filename and mime type
    const fileName = fileField.filename || `document_${Date.now()}`;
    const mimeType = fileField.type || 'application/octet-stream';

    // Get Google Drive credentials from runtime config
    const googleDriveEmail = config.googleDriveEmail;
    const googleDriveKey = config.googleDriveKey;

    console.log('Google Drive config:', {
      email: googleDriveEmail ? 'Present' : 'Missing',
      key: googleDriveKey ? 'Present' : 'Missing',
      folderId: folderId || 'Not provided'
    });

    // Get firmId from the user context
    const firmId = user.firmId?.toString() || 'default_firm';

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

    // Return the file URL and fileId
    return {
      fileUrl: uploadResult.fileUrl,
      fileId: uploadResult.fileId,
      fileName
    };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error uploading file'
    });
  }
});
