// Shared job status storage for EPF/ESIC verification jobs
// This ensures both background job and status API use the same Map instance

export const jobStatuses = new Map<string, {
  status: 'processing' | 'completed' | 'failed' | 'not_found'
  userId: string
  startTime: string
  completedTime?: string
  failedTime?: string
  message: string
  rules?: any
  error?: {
    message: string
    code: string
    provider: string
  }
}>()
