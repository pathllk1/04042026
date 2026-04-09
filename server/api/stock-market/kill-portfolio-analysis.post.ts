import { JobManager } from '../../utils/jobManager'

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
    console.log(`🛑 Killing all portfolio analysis jobs for user: ${userId}`)

    // Get all jobs for this user
    const allJobs = JobManager.getAllJobs()
    let killedCount = 0

    // Kill all portfolio-performance-history jobs for this user
    for (const [jobId, job] of allJobs.entries()) {
      if (job.type === 'portfolio-performance-history' && 
          job.userId === userId && 
          (job.status === 'processing' || job.status === 'queued')) {
        
        JobManager.updateJob(jobId, {
          status: 'failed',
          progress: 0,
          error: 'Job killed by user',
          failedAt: new Date(),
          message: 'Job was manually terminated'
        })
        
        killedCount++
        console.log(`🛑 Killed job: ${jobId}`)
      }
    }

    return {
      success: true,
      message: `Killed ${killedCount} portfolio analysis jobs`,
      killedJobs: killedCount
    }

  } catch (error: any) {
    console.error('Error killing portfolio analysis jobs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to kill jobs: ${error?.message || 'Unknown error'}`
    })
  }
})
