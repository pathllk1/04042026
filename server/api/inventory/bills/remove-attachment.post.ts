// server/api/inventory/bills/remove-attachment.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Bills from '../../../models/inventory/Bills';
import { google } from 'googleapis';

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

    // Get the request body
    const body = await readBody(event);
    if (!body || !body.billId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request: Bill ID is required'
      });
    }

    // Verify bill exists and belongs to user's firm
    const bill = await Bills.findOne({
      _id: body.billId,
      firm: user.firmId,
      btype: { $in: ['PURCHASE', 'DEBIT NOTE'] } // Only allow for these types
    });

    if (!bill) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found: Bill not found or not authorized'
      });
    }

    // If bill has an attachment, delete it from Google Drive
    if (bill.attachmentFileId) {
      try {
        // Get Google Drive credentials from runtime config
        const config = useRuntimeConfig();
        const clientEmail = config.googleDriveEmail;
        const privateKey = config.googleDriveKey;

        if (clientEmail && privateKey) {
          // Initialize Google Drive API
          const auth = new google.auth.GoogleAuth({
            credentials: {
              client_email: clientEmail,
              private_key: privateKey
            },
            scopes: ['https://www.googleapis.com/auth/drive.file']
          });

          const drive = google.drive({ version: 'v3', auth });

          // Delete the file from Google Drive
          await drive.files.delete({
            fileId: bill.attachmentFileId
          });
          console.log('Attachment deleted from Google Drive');
        }
      } catch (deleteError) {
        console.error('Error deleting attachment from Google Drive:', deleteError);
        // Continue with database update even if Google Drive deletion fails
      }
    }

    // Update the bill to remove attachment information
    const updatedBill = await Bills.findByIdAndUpdate(
      body.billId,
      {
        $unset: {
          attachmentUrl: 1,
          attachmentFileId: 1
        }
      },
      { new: true }
    );

    return {
      success: true,
      message: 'Attachment removed successfully',
      billId: body.billId
    };

  } catch (error) {
    console.error('Remove attachment error:', error);
    
    // Handle specific error types
    if (error.statusCode) {
      throw error; // Re-throw HTTP errors
    }

    // Handle unexpected errors
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Failed to remove attachment'
    });
  }
});
