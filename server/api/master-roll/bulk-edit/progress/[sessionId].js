import { createError } from 'h3'

// In-memory storage for progress tracking (in production, use Redis or database)
const progressStore = new Map()

export default defineEventHandler(async (event) => {
  try {
    const sessionId = getRouterParam(event, 'sessionId')
    
    if (!sessionId) {
      throw createError({
        statusCode: 400,
        message: 'Session ID is required'
      })
    }

    // Get userId and firmId from the event context (set by auth middleware)
    const userId = event.context.userId
    const firmId = event.context.user.firmId

    // Check if this is a GET request (get progress) or POST request (update progress)
    const method = getMethod(event)

    if (method === 'GET') {
      // Return current progress
      const progress = progressStore.get(sessionId)
      
      if (!progress) {
        throw createError({
          statusCode: 404,
          message: 'Progress session not found'
        })
      }

      // Verify ownership
      if (progress.userId !== userId || progress.firmId !== firmId) {
        throw createError({
          statusCode: 403,
          message: 'Access denied to this progress session'
        })
      }

      return {
        success: true,
        sessionId,
        progress: {
          ...progress,
          // Calculate derived values
          overallProgress: progress.totalRecords > 0 ? (progress.processedRecords / progress.totalRecords) * 100 : 0,
          chunkProgress: progress.totalChunks > 0 ? (progress.currentChunk / progress.totalChunks) * 100 : 0,
          estimatedTimeRemaining: calculateEstimatedTime(progress)
        }
      }

    } else if (method === 'POST') {
      // Update progress (called by the processing system)
      const body = await readBody(event)
      const {
        currentChunk,
        totalChunks,
        processedRecords,
        totalRecords,
        failedRecords,
        currentStatus,
        isComplete,
        errors
      } = body

      // Get existing progress or create new
      let progress = progressStore.get(sessionId) || {
        sessionId,
        userId,
        firmId,
        startTime: new Date(),
        currentChunk: 0,
        totalChunks: 0,
        processedRecords: 0,
        totalRecords: 0,
        failedRecords: 0,
        currentStatus: 'Initializing...',
        isComplete: false,
        errors: []
      }

      // Update progress
      if (currentChunk !== undefined) progress.currentChunk = currentChunk
      if (totalChunks !== undefined) progress.totalChunks = totalChunks
      if (processedRecords !== undefined) progress.processedRecords = processedRecords
      if (totalRecords !== undefined) progress.totalRecords = totalRecords
      if (failedRecords !== undefined) progress.failedRecords = failedRecords
      if (currentStatus !== undefined) progress.currentStatus = currentStatus
      if (isComplete !== undefined) progress.isComplete = isComplete
      if (errors !== undefined) progress.errors = [...(progress.errors || []), ...errors]

      progress.lastUpdated = new Date()

      // Store updated progress
      progressStore.set(sessionId, progress)

      // Clean up completed sessions after 1 hour
      if (isComplete) {
        setTimeout(() => {
          progressStore.delete(sessionId)
        }, 60 * 60 * 1000) // 1 hour
      }

      return {
        success: true,
        sessionId,
        updated: true
      }

    } else if (method === 'DELETE') {
      // Cancel/delete progress session
      const progress = progressStore.get(sessionId)
      
      if (!progress) {
        throw createError({
          statusCode: 404,
          message: 'Progress session not found'
        })
      }

      // Verify ownership
      if (progress.userId !== userId || progress.firmId !== firmId) {
        throw createError({
          statusCode: 403,
          message: 'Access denied to this progress session'
        })
      }

      // Mark as cancelled
      progress.isComplete = true
      progress.currentStatus = 'Cancelled by user'
      progress.lastUpdated = new Date()
      progressStore.set(sessionId, progress)

      // Clean up after 5 minutes
      setTimeout(() => {
        progressStore.delete(sessionId)
      }, 5 * 60 * 1000) // 5 minutes

      return {
        success: true,
        sessionId,
        cancelled: true
      }

    } else {
      throw createError({
        statusCode: 405,
        message: 'Method not allowed'
      })
    }

  } catch (error) {
    console.error('Progress tracking error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Error handling progress request'
    })
  }
})

// Helper function to calculate estimated time remaining
function calculateEstimatedTime(progress) {
  if (!progress.startTime || progress.processedRecords === 0 || progress.totalRecords === 0) {
    return null
  }

  const elapsedTime = Date.now() - new Date(progress.startTime).getTime()
  const recordsPerMs = progress.processedRecords / elapsedTime
  const remainingRecords = progress.totalRecords - progress.processedRecords
  const estimatedRemainingMs = remainingRecords / recordsPerMs

  return {
    estimatedRemainingSeconds: Math.ceil(estimatedRemainingMs / 1000),
    estimatedCompletionTime: new Date(Date.now() + estimatedRemainingMs).toISOString()
  }
}

// Utility function to create a new progress session
export function createProgressSession(userId, firmId, totalRecords, totalChunks = 1) {
  const sessionId = `bulk-edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  const progress = {
    sessionId,
    userId,
    firmId,
    startTime: new Date(),
    currentChunk: 0,
    totalChunks,
    processedRecords: 0,
    totalRecords,
    failedRecords: 0,
    currentStatus: 'Initializing...',
    isComplete: false,
    errors: [],
    lastUpdated: new Date()
  }

  progressStore.set(sessionId, progress)
  
  return sessionId
}

// Utility function to update progress
export function updateProgress(sessionId, updates) {
  const progress = progressStore.get(sessionId)
  if (progress) {
    Object.assign(progress, updates, { lastUpdated: new Date() })
    progressStore.set(sessionId, progress)
  }
}
