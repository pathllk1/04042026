import { defineEventHandler, createError, setHeader } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Check if user is authenticated and is an admin
    const user = event.context.user;
    if (!user || user.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Only admins can download auto backups'
      });
    }

    // Check if auto backup is ready
    const autoBackup = (global as any).autoBackupReady;
    
    if (!autoBackup) {
      return {
        success: false,
        message: 'No auto backup available for download',
        hasBackup: false
      };
    }
    
    // Set headers for file download
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', `attachment; filename="${autoBackup.filename}"`);
    setHeader(event, 'Content-Length', autoBackup.buffer.length);
    
    console.log(`[Auto Backup Download] Admin downloading: ${autoBackup.filename} (${autoBackup.count} records)`);
    
    // Clear the global backup after download
    (global as any).autoBackupReady = null;
    
    // Return the Excel buffer for download
    return autoBackup.buffer;
    
  } catch (error) {
    console.error('Auto backup download error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to download auto backup',
      data: error
    });
  }
});
