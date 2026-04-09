// server/api/inventory/bills/upload-attachment.post.ts
import { defineEventHandler, createError, readMultipartFormData } from 'h3';
import Bills from '../../../models/inventory/Bills';
import { google } from 'googleapis';
import { Readable } from 'stream';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated and has a firmId
    const user = event.context.user;
    if (!user || !user.firmId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
      });
    }

    // Parse multipart form data
    const formData = await readMultipartFormData(event);
    if (!formData) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: No form data provided'
      });
    }

    // Extract billId and file from form data
    let billId: string | undefined;
    let file: any = null;

    for (const field of formData) {
      if (field.name === 'billId') {
        billId = field.data.toString();
      } else if (field.name === 'file') {
        file = field;
      }
    }

    // Validate required fields
    if (!billId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Bill ID is required'
      });
    }

    if (!file) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: File is required'
      });
    }

    // Validate file type (PDF only)
    if (!file.filename?.toLowerCase().endsWith('.pdf')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Only PDF files are allowed'
      });
    }

    // Validate file size (200KB = 204800 bytes)
    if (file.data.length > 204800) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: File size exceeds maximum limit of 200KB'
      });
    }

    // Verify bill exists and belongs to user's firm
    const bill = await Bills.findOne({
      _id: billId,
      firm: user.firmId,
      btype: { $in: ['PURCHASE', 'DEBIT NOTE'] } // Only allow for these types
    });

    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found: Bill not found or not authorized'
      });
    }

    // Get Google Drive credentials from runtime config
    const config = useRuntimeConfig();
    const clientEmail = config.googleDriveEmail;
    const privateKey = config.googleDriveKey;
    const parentFolderId = config.googleDriveFolder;

    if (!clientEmail || !privateKey || !parentFolderId) {
      console.error('Missing Google Drive credentials:', {
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey,
        hasParentFolderId: !!parentFolderId
      });
      throw createError({
        statusCode: 500,
        statusMessage: 'Server configuration error - Google Drive credentials not set'
      });
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    // If bill already has an attachment, delete the old one from Google Drive
    if (bill.attachmentFileId) {
      try {
        await drive.files.delete({
          fileId: bill.attachmentFileId
        });
        console.log('Old attachment deleted from Google Drive');
      } catch (deleteError) {
        console.error('Error deleting old attachment:', deleteError);
        // Continue with upload even if deletion fails
      }
    }

    // STEP 1: Check if firm folder exists or create one
    let firmFolderId;
    const firmFolderResponse = await drive.files.list({
      q: `name='${user.firmId}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    if (firmFolderResponse.data.files && firmFolderResponse.data.files.length > 0) {
      firmFolderId = firmFolderResponse.data.files[0].id;
    } else {
      // Create firm folder
      const firmFolderMetadata = {
        name: user.firmId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };
      const firmFolderCreateResponse = await drive.files.create({
        requestBody: firmFolderMetadata,
        fields: 'id'
      });
      firmFolderId = firmFolderCreateResponse.data.id;
    }

    // STEP 2: Check if user folder exists within firm folder or create one
    let userFolderId;
    const userFolderResponse = await drive.files.list({
      q: `name='${user._id}' and mimeType='application/vnd.google-apps.folder' and '${firmFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    if (userFolderResponse.data.files && userFolderResponse.data.files.length > 0) {
      userFolderId = userFolderResponse.data.files[0].id;
    } else {
      // Create user folder within firm folder
      const userFolderMetadata = {
        name: user._id,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [firmFolderId]
      };
      const userFolderCreateResponse = await drive.files.create({
        requestBody: userFolderMetadata,
        fields: 'id'
      });
      userFolderId = userFolderCreateResponse.data.id;
    }

    // STEP 3: Upload file to Google Drive
    const fileName = file.filename || `bill_attachment_${Date.now()}.pdf`;
    const mimeType = 'application/pdf';

    // Convert Buffer to Readable Stream
    const bufferStream = new Readable();
    bufferStream.push(file.data);
    bufferStream.push(null); // Mark the end of the stream

    const fileMetadata = {
      name: fileName,
      parents: [userFolderId] // Upload to user folder inside firm folder
    };

    const media = {
      mimeType: mimeType,
      body: bufferStream
    };

    const uploadResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    if (!uploadResponse.data || !uploadResponse.data.id) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to upload file to Google Drive'
      });
    }

    // Update file permissions to make it publicly accessible
    await drive.permissions.create({
      fileId: uploadResponse.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Extract file URL and ID from upload response
    const fileUrl = uploadResponse.data.webViewLink || '';
    const fileId = uploadResponse.data.id || '';

    // Update the bill with attachment information
    const updatedBill = await Bills.findByIdAndUpdate(
      billId,
      {
        attachmentUrl: fileUrl,
        attachmentFileId: fileId
      },
      { new: true }
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      attachment: {
        url: fileUrl,
        fileId: fileId,
        filename: file.filename,
        size: file.data.length
      },
      billId: billId
    };

  } catch (error) {
    console.error('File upload error:', error);
    
    // Handle specific error types
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: File upload failed'
    });
  }
});
