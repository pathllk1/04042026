import { jobStatuses } from '../../utils/sharedJobStatus'

export default defineEventHandler(async (event) => {
  // Verify authentication
  const { userId, user } = event.context
  if (!userId || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  try {
    const query = getQuery(event)
    const { jobId } = query

    if (!jobId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Job ID is required'
      })
    }

    console.log(`🔍 Checking EPF/ESIC verification job status: ${jobId} for user:`, userId)
    console.log(`📊 Total jobs in memory: ${jobStatuses.size}`)
    console.log(`📋 All job IDs: [${Array.from(jobStatuses.keys()).join(', ')}]`)

    // Get real job status from memory (in production, use Redis or database)
    const jobStatus = jobStatuses.get(String(jobId))

    if (!jobStatus) {
      console.log(`❌ Job ${jobId} not found in memory`)
      return {
        status: 'not_found',
        message: 'Job not found or expired',
        jobId
      }
    }

    console.log(`✅ Job ${jobId} found with status: ${jobStatus.status}`)

    // Verify the job belongs to the requesting user
    if (jobStatus.userId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied to this job'
      })
    }

    console.log(`📊 Job ${jobId} status: ${jobStatus.status}`)

    // Return the actual job status
    const response = {
      jobId,
      status: jobStatus.status,
      message: jobStatus.message,
      startTime: jobStatus.startTime
    }

    // Add additional fields based on status
    if (jobStatus.status === 'completed') {
      response.completedTime = jobStatus.completedTime
      response.rules = jobStatus.rules
    } else if (jobStatus.status === 'failed') {
      response.failedTime = jobStatus.failedTime
      response.error = jobStatus.error
    }

    return response
  } catch (error) {
    console.error('Error checking EPF/ESIC verification job status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to check EPF/ESIC verification job status: ${error.message}`
    })
  }
})