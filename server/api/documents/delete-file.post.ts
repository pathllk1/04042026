import { defineEventHandler, readBody, createError } from 'h3';
import { deleteFileFromGoogleDrive } from '../../utils/googleDrive';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Get runtime config to access environment variables
    const config = useRuntimeConfig();
    
    // Verify authentication token
    const user = await verifyToken(event);
    if (!user || !user._id) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    
    // Get the fileId from the request body
    const body = await readBody(event);
    const { fileId } = body;
    
    if (!fileId) {
      throw createError({
        statusCode: 400,
        message: 'File ID is required'
      });
    }
    
    // Get Google Drive credentials from runtime config
    const googleDriveEmail = config.googleDriveEmail;
    const googleDriveKey = config.googleDriveKey;
    
    console.log('Attempting to delete file with ID:', fileId);
    
    // Delete the file from Google Drive
    const success = await deleteFileFromGoogleDrive(
      fileId,
      googleDriveEmail as string,
      googleDriveKey as string
    );
    
    if (!success) {
      throw createError({
        statusCode: 500,
        message: 'Failed to delete file from Google Drive'
      });
    }
    
    return {
      statusCode: 200,
      message: 'File deleted successfully'
    };
  } catch (error: any) {
    console.error('Error deleting file:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error deleting file'
    });
  }
});
