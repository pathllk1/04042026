import { JobManager } from '../../../utils/jobManager';

export default defineEventHandler(async (event) => {
  try {
    const jobId = getRouterParam(event, 'jobId');

    if (!jobId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Job ID is required'
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

    console.log(`Fetching job status for job ${jobId} by user ${userId}`);

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

    // Return job status with appropriate data based on status
    const response: any = {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      estimatedDuration: job.estimatedDuration
    };

    // Add completion data if job is completed
    if (job.status === 'completed') {
      response.completedAt = job.completedAt;
      response.summary = job.summary;
      
      // Include document metadata but not the actual file buffers
      if (job.documentData) {
        response.documentData = {
          documentType: job.documentData.documentType,
          title: job.documentData.title,
          metadata: job.documentData.metadata,
          exportRecommendations: job.documentData.exportRecommendations,
          suggestedImprovements: job.documentData.suggestedImprovements
        };
      }

      // Include file information but not the actual buffers
      if (job.files) {
        response.availableFormats = Object.keys(job.files).map(format => ({
          format: format,
          filename: job.files[format].filename,
          size: job.files[format].size,
          downloadUrl: `/api/ai/download-document/${jobId}/${format}`
        }));
      }
    }

    // Add error information if job failed
    if (job.status === 'failed') {
      response.error = job.error;
      response.completedAt = job.completedAt;
    }

    // Add processing information for ongoing jobs
    if (job.status === 'processing') {
      const elapsed = Date.now() - new Date(job.createdAt).getTime();
      const elapsedSeconds = Math.floor(elapsed / 1000);
      const estimatedRemaining = Math.max(0, (job.estimatedDuration || 60) - elapsedSeconds);
      
      response.elapsed = elapsedSeconds;
      response.estimatedRemaining = estimatedRemaining;
    }

    console.log(`Job ${jobId} status: ${job.status} (${job.progress}%)`);

    return response;

  } catch (error) {
    console.error('Failed to fetch job status:', error);
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch job status'
    });
  }
});
