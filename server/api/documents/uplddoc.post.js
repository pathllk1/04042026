import { google } from 'googleapis';
import { createError, readMultipartFormData } from 'h3';
import { Readable } from 'stream';

export default defineEventHandler(async (event) => {
    try {
        // Get userId from the event context (set by auth middleware)
        const userId = event.context.userId;
        const firmId = event.context.user.firmId;
        if (!userId) {
            throw createError({
                statusCode: 401,
                message: 'Unauthorized - User not authenticated'
            });
        }

        // Get Google Drive credentials from runtime config
        const config = useRuntimeConfig();
        const clientEmail = config.googleDriveEmail;
        const privateKey = config.googleDriveKey;
        const parentFolderId = config.googleDriveFolder;

        if (!clientEmail || !privateKey || !parentFolderId) {
            throw createError({
                statusCode: 500,
                message: 'Server configuration error - Google Drive credentials not set'
            });
        }

        // Check if formData is already available in the context (set by CSRF middleware)
        let formData = event.context.formData;

        // If not, read it directly
        if (!formData) {
            formData = await readMultipartFormData(event);
        }

        if (!formData || formData.length === 0) {
            throw createError({
                statusCode: 400,
                message: 'No file uploaded'
            });
        }

        // Find the file field (should be named 'file')
        const file = formData.find(field => field.name === 'file');

        if (!file || !file.data) {
            throw createError({
                statusCode: 400,
                message: 'Invalid file data'
            });
        }

        const fileName = file.filename || `upload_${Date.now()}`;
        const mimeType = file.type || 'application/octet-stream';
        const fileData = file.data;

        // Initialize Google Drive API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey
            },
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });

        const drive = google.drive({ version: 'v3', auth });

        // STEP 1: Check if firm folder exists or create one
        let firmFolderId;
        const firmFolderResponse = await drive.files.list({
            q: `name='${firmId}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)'
        });

        if (firmFolderResponse.data.files.length === 0) {
            // Create firm folder if it doesn't exist
            const firmFolderMetadata = {
                name: firmId,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId]
            };

            const firmFolder = await drive.files.create({
                requestBody: firmFolderMetadata,
                fields: 'id, name'
            });

            firmFolderId = firmFolder.data.id;
        } else {
            firmFolderId = firmFolderResponse.data.files[0].id;
        }

        // STEP 2: Check if user folder exists inside firm folder or create one
        let userFolderId;
        const userFolderResponse = await drive.files.list({
            q: `name='${userId}' and mimeType='application/vnd.google-apps.folder' and '${firmFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)'
        });

        if (userFolderResponse.data.files.length === 0) {
            // Create user folder inside firm folder if it doesn't exist
            const userFolderMetadata = {
                name: userId,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [firmFolderId]
            };

            const userFolder = await drive.files.create({
                requestBody: userFolderMetadata,
                fields: 'id, name'
            });

            userFolderId = userFolder.data.id;
        } else {
            userFolderId = userFolderResponse.data.files[0].id;
        }

        // Convert Buffer to Readable Stream
        const bufferStream = new Readable();
        bufferStream.push(fileData);
        bufferStream.push(null); // Mark the end of the stream

        // STEP 3: Upload file to Google Drive in the user's folder (within firm folder)
        const fileMetadata = {
            name: fileName,
            parents: [userFolderId] // Upload to user folder inside firm folder
        };

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink'
        });

        if (!response.data || !response.data.id) {
            throw createError({
                statusCode: 500,
                message: 'Failed to upload file to Google Drive'
            });
        }

        // Update file permissions to make it publicly accessible
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        // Return the response object
        return {
            statusCode: 200,
            message: 'File uploaded successfully',
            fileName: response.data.webViewLink,
            fileId: response.data.id,
            downloadLink: response.data.webContentLink
        };
    } catch (error) {
        console.error('Upload error:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            message: error.message || 'Error uploading file to Google Drive'
        });
    }
});
