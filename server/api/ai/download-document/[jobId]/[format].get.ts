import { JobManager } from '../../../../utils/jobManager';

export default defineEventHandler(async (event) => {
  try {
    const jobId = getRouterParam(event, 'jobId');
    const format = getRouterParam(event, 'format');

    if (!jobId || !format) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Job ID and format are required'
      });
    }

    // Validate format
    const validFormats = ['excel', 'word', 'pdf'];
    if (!validFormats.includes(format)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid format. Must be one of: ${validFormats.join(', ')}`
      });
    }

    // Get user information for security
    const userId = event.context.userId;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      });
    }

    console.log(`Download request for job ${jobId}, format ${format} by user ${userId}`);

    // Get job from JobManager
    const job = JobManager.getJob(jobId);

    if (!job) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Job not found'
      });
    }

    // Security check: ensure user can only access their own jobs
    if (job.userId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied to this job'
      });
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      throw createError({
        statusCode: 400,
        statusMessage: `Document is not ready. Current status: ${job.status}`
      });
    }

    // Check if files exist
    if (!job.files || !job.files[format]) {
      throw createError({
        statusCode: 404,
        statusMessage: `${format.toUpperCase()} file not found for this job`
      });
    }

    const fileData = job.files[format];
    
    if (!fileData.buffer) {
      throw createError({
        statusCode: 500,
        statusMessage: 'File buffer not available'
      });
    }

    console.log(`Serving ${format} file: ${fileData.filename} (${fileData.size} bytes)`);

    // Set appropriate headers for file download
    const headers: Record<string, string> = {
      'Content-Length': fileData.size.toString(),
      'Content-Disposition': `attachment; filename="${fileData.filename}"`
    };

    // Set content type based on format
    switch (format) {
      case 'excel':
        headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'word':
        headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'pdf':
        headers['Content-Type'] = 'application/pdf';
        break;
    }

    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      setHeader(event, key, value);
    });

    // Log download activity
    console.log(`File downloaded successfully: ${fileData.filename} by user ${userId}`);

    // Return the file buffer
    return fileData.buffer;

  } catch (error) {
    console.error('File download failed:', error);
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to download file'
    });
  }
});
