import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Deletes a file from Google Drive by its ID
 * @param fileId - The ID of the file to delete
 * @param clientEmail - The Google Service Account email
 * @param privateKey - The Google Service Account private key
 * @returns A boolean indicating whether the deletion was successful
 */
export async function deleteFileFromGoogleDrive(
  fileId: string,
  clientEmail: string,
  privateKey: string
): Promise<boolean> {
  try {
    if (!fileId) {
      return false;
    }


    if (!privateKey || !clientEmail) {
      throw new Error('Google Drive credentials not provided');
    }

    // Create a JWT auth client
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth });

    // Delete the file
    await new Promise<void>((resolve, reject) => {
      drive.files.delete({
        fileId: fileId
      }, (err: any) => {
        if (err) {
          console.error('Error deleting file:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });

    return true;
  } catch (error) {
    console.error('Error deleting file from Google Drive:', error);
    // Don't throw the error, just return false to indicate failure
    return false;
  }
}

/**
 * Uploads a file to Google Drive with folder organization by firmId and userId
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param mimeType - The MIME type of the file
 * @param parentFolderId - The root Google Drive folder ID
 * @param firmId - The firm ID to use as the main folder name
 * @param userId - The user ID to use as the subfolder name
 * @param clientEmail - The Google Service Account email
 * @param privateKey - The Google Service Account private key
 * @returns Object containing the URL and ID of the uploaded file
 */
export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  firmId: string,
  userId: string,
  clientEmail: string,
  privateKey: string
): Promise<{ fileUrl: string; fileId: string }> {
  try {

    if (!privateKey || !clientEmail) {
      throw new Error('Google Drive credentials not provided');
    }

    // Create a JWT auth client
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    // Create Google Drive client
    const drive = google.drive({ version: 'v3', auth });

    // STEP 1: Check if firm folder exists or create one
    let firmFolderId: string;
    const firmFolderResponse = await drive.files.list({
      q: `name='${firmId}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    const firmFiles = firmFolderResponse.data.files || [];
    if (firmFiles.length === 0) {
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

      firmFolderId = firmFolder.data.id || '';
    } else {
      firmFolderId = firmFiles[0].id || '';
    }

    // STEP 2: Check if user folder exists inside firm folder or create one
    let userFolderId: string;
    const userFolderResponse = await drive.files.list({
      q: `name='${userId}' and mimeType='application/vnd.google-apps.folder' and '${firmFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    const userFiles = userFolderResponse.data.files || [];
    if (userFiles.length === 0) {
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

      userFolderId = userFolder.data.id || '';
    } else {
      userFolderId = userFiles[0].id || '';
    }

    // Create a readable stream from the buffer
    const fileStream = new Readable();
    fileStream.push(fileBuffer);
    fileStream.push(null); // Signal the end of the stream


    // Upload file to Google Drive in the user's folder
    const fileMetadata = {
      name: fileName,
      mimeType: mimeType,
      parents: [userFolderId] // Upload to user folder inside firm folder
    };

    const media = {
      mimeType: mimeType,
      body: fileStream
    };

    // Use a Promise to handle the file creation properly
    const response = await new Promise<any>((resolve, reject) => {
      drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink,webContentLink'
      }, (err, res) => {
        if (err) {
          console.error('Error creating file:', err);
          reject(err);
          return;
        }
        resolve(res);
      });
    });

    if (!response || !response.data || !response.data.id) {
      throw new Error('Failed to upload file to Google Drive');
    }

    const fileId = response.data.id;

    // Make the file publicly accessible
    await new Promise<void>((resolve, reject) => {
      drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      }, (err) => {
        if (err) {
          console.error('Error setting permissions:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });


    // Return both the web view link and file ID
    const webViewLink = response.data.webViewLink;
    return {
      fileUrl: webViewLink || '',
      fileId: fileId || ''
    };
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw error;
  }
}
