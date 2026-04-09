import { defineEventHandler, getRouterParam, createError } from 'h3'
import { JobManager } from '../../../utils/jobManager'

export default defineEventHandler(async (event) => {
  // Get user context with normalization
  const userId = String(event.context.userId || event.context.user?.id || '')
  const firmId = String(event.context.user?.firmId || event.context.firmId || '')

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  try {
    const jobId = getRouterParam(event, 'jobId')

    if (!jobId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Job ID is required'
      })
    }

    // Get job from storage
    const job = JobManager.getJob(jobId)

    if (!job) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Job not found'
      })
    }

    // Verify job belongs to user with normalized comparison
    const jobUserId = String(job.userId || '')
    const jobFirmId = String(job.firmId || '')

    const userMatches = jobUserId === userId
    const firmMatches = jobFirmId === firmId

    // Require both user and firm to match for security
    if (!userMatches || !firmMatches) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }

    // Calculate elapsed time
    const now = new Date()
    const createdAt = new Date(job.createdAt)
    const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000)

    // Prepare response based on job status
    const response = {
      jobId: job.id,
      status: job.status,
      symbol: job.symbol,
      progress: job.progress || 0,
      message: job.message || getStatusMessage(job.status),
      elapsedTime: elapsedSeconds,
      createdAt: job.createdAt
    }

    // Add status-specific data
    switch (job.status) {
      case 'queued':
        response.estimatedTime = '30-45 seconds'
        break

      case 'processing':
        response.startedAt = job.startedAt
        response.estimatedRemaining = Math.max(0, 45 - elapsedSeconds)
        break

      case 'completed':
        response.analysis = job.analysis
        response.completedAt = job.completedAt
        response.totalTime = Math.floor((new Date(job.completedAt).getTime() - createdAt.getTime()) / 1000)
        
        // Clean up job after 5 minutes to prevent memory leaks
        setTimeout(() => {
          JobManager.deleteJob(jobId)
          console.log(`🧹 Cleaned up completed job: ${jobId}`)
        }, 5 * 60 * 1000)
        break

      case 'failed':
        response.error = job.error
        response.failedAt = job.failedAt
        
        // Clean up failed job after 1 minute
        setTimeout(() => {
          JobManager.deleteJob(jobId)
          console.log(`🧹 Cleaned up failed job: ${jobId}`)
        }, 60 * 1000)
        break
    }

    return {
      success: true,
      ...response
    }

  } catch (error) {
    console.error('Error checking job status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to check job status: ${error.message}`
    })
  }
})

// Helper function to get status messages
function getStatusMessage(status: string): string {
  switch (status) {
    case 'queued':
      return 'Analysis queued and waiting to start'
    case 'processing':
      return 'AI is analyzing the stock...'
    case 'completed':
      return 'Analysis completed successfully'
    case 'failed':
      return 'Analysis failed'
    default:
      return 'Unknown status'
  }
}
