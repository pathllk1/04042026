// Shared job management utility
// In production, replace with Redis or database storage

interface JobData {
  id: string
  type?: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  symbol?: string
  userId: string
  firmId?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  progress: number
  message?: string
  analysis?: any
  error?: string
  userRequest?: string
  additionalContext?: string
  estimatedDuration?: number
  documentData?: any
  files?: any
  summary?: any
  availableFormats?: any[]
}

// In-memory job storage (use Redis/Database in production)
const jobs = new Map<string, JobData>()

export class JobManager {
  static createJob(jobData: Partial<JobData>): JobData {
    const job: JobData = {
      id: jobData.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      userId: jobData.userId || '',
      createdAt: new Date(),
      progress: 0,
      ...jobData
    }

    jobs.set(job.id, job)
    console.log(`📋 Created job: ${job.id} for ${job.type || job.symbol || 'unknown'}`)
    return job
  }

  static getJob(jobId: string): JobData | undefined {
    return jobs.get(jobId)
  }

  static updateJob(jobId: string, updates: Partial<JobData>): JobData | null {
    const job = jobs.get(jobId)
    if (!job) return null

    const updatedJob = { ...job, ...updates }
    jobs.set(jobId, updatedJob)
    
    console.log(`📝 Updated job ${jobId}: ${updatedJob.status} (${updatedJob.progress}%)`)
    return updatedJob
  }

  static deleteJob(jobId: string): boolean {
    const deleted = jobs.delete(jobId)
    if (deleted) {
      console.log(`🗑️ Deleted job: ${jobId}`)
    }
    return deleted
  }

  static getAllJobs(): JobData[] {
    return Array.from(jobs.values())
  }

  static getJobsByUser(userId: string, firmId?: string): JobData[] {
    return Array.from(jobs.values()).filter(
      job => job.userId === userId && (!firmId || job.firmId === firmId)
    )
  }

  static cleanupOldJobs(): number {
    const now = new Date()
    const maxAge = 60 * 60 * 1000 // 1 hour
    let cleaned = 0

    for (const [jobId, job] of jobs.entries()) {
      const age = now.getTime() - job.createdAt.getTime()
      
      // Clean up old completed/failed jobs
      if (age > maxAge || 
          (job.status === 'completed' && age > 5 * 60 * 1000) || // 5 minutes for completed
          (job.status === 'failed' && age > 1 * 60 * 1000)) {     // 1 minute for failed
        jobs.delete(jobId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old jobs`)
    }
    
    return cleaned
  }

  static getStats() {
    const allJobs = Array.from(jobs.values())
    return {
      total: allJobs.length,
      queued: allJobs.filter(j => j.status === 'queued').length,
      processing: allJobs.filter(j => j.status === 'processing').length,
      completed: allJobs.filter(j => j.status === 'completed').length,
      failed: allJobs.filter(j => j.status === 'failed').length
    }
  }
}

// Auto-cleanup every 10 minutes
setInterval(() => {
  JobManager.cleanupOldJobs()
}, 10 * 60 * 1000)

export type { JobData }
