import { ref, computed } from 'vue'
import useApiWithAuth from '~/composables/auth/useApiWithAuth'

export const useBulkEdit = () => {
  // State management
  const isProcessing = ref(false)
  const currentChunk = ref(0)
  const totalChunks = ref(0)
  const processedRecords = ref(0)
  const totalRecords = ref(0)
  const failedRecords = ref(0)
  const currentStatus = ref('')
  const processingSessionId = ref(null)
  const canCancel = ref(false)
  const errors = ref([])

  // Computed properties
  const overallProgress = computed(() => {
    if (totalRecords.value === 0) return 0
    return (processedRecords.value / totalRecords.value) * 100
  })

  const chunkProgress = computed(() => {
    if (totalChunks.value === 0) return 0
    return (currentChunk.value / totalChunks.value) * 100
  })

  // API instance
  const api = useApiWithAuth()

  // Reset state
  const resetState = () => {
    isProcessing.value = false
    currentChunk.value = 0
    totalChunks.value = 0
    processedRecords.value = 0
    totalRecords.value = 0
    failedRecords.value = 0
    currentStatus.value = ''
    processingSessionId.value = null
    canCancel.value = false
    errors.value = []
  }

  // Preview changes
  const previewChanges = async (payload) => {
    try {
      const response = await api.post('/api/master-roll/bulk-edit/preview', payload)
      return response
    } catch (error) {
      console.error('Preview failed:', error)
      throw error
    }
  }

  // Validate changes
  const validateChanges = async (payload) => {
    try {
      const response = await api.post('/api/master-roll/bulk-edit/validate', payload)
      return response
    } catch (error) {
      console.error('Validation failed:', error)
      throw error
    }
  }

  // Execute bulk changes
  const executeChanges = async (payload) => {
    resetState()
    
    try {
      isProcessing.value = true
      canCancel.value = true
      totalRecords.value = payload.employeeIds.length
      currentStatus.value = 'Initializing bulk edit operation...'

      // Determine if chunking is needed
      const chunkSize = 50
      const needsChunking = payload.employeeIds.length > chunkSize

      if (needsChunking) {
        totalChunks.value = Math.ceil(payload.employeeIds.length / chunkSize)
        currentStatus.value = `Processing ${totalRecords.value} records in ${totalChunks.value} chunks...`
        
        await processInChunks(payload, chunkSize)
      } else {
        totalChunks.value = 1
        currentStatus.value = `Processing ${totalRecords.value} records in single batch...`
        
        await processSingleBatch(payload)
      }

      // Final status
      if (failedRecords.value === 0) {
        currentStatus.value = `✅ Successfully updated ${processedRecords.value} records`
      } else {
        currentStatus.value = `⚠️ Completed with ${failedRecords.value} failures out of ${totalRecords.value} records`
      }

    } catch (error) {
      currentStatus.value = `❌ Bulk edit operation failed: ${error.message}`
      throw error
    } finally {
      canCancel.value = false
      // Keep isProcessing true for a moment to show final status
      setTimeout(() => {
        isProcessing.value = false
      }, 2000)
    }
  }

  // Process in chunks
  const processInChunks = async (payload, chunkSize) => {
    const employeeIds = payload.employeeIds
    const chunks = []
    
    // Split employee IDs into chunks
    for (let i = 0; i < employeeIds.length; i += chunkSize) {
      chunks.push(employeeIds.slice(i, i + chunkSize))
    }

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      if (!canCancel.value) break // Check if cancelled

      currentChunk.value = i + 1
      currentStatus.value = `Processing chunk ${currentChunk.value} of ${totalChunks.value}...`

      const chunkPayload = {
        ...payload,
        employeeIds: chunks[i]
      }

      try {
        const response = await api.post('/api/master-roll/bulk-edit/execute', chunkPayload)
        
        // Update progress
        processedRecords.value += response.successCount || chunks[i].length
        if (response.failedCount) {
          failedRecords.value += response.failedCount
          errors.value.push(...(response.errors || []))
        }

        currentStatus.value = `Completed chunk ${currentChunk.value} of ${totalChunks.value}`
        
        // Small delay between chunks to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Chunk ${i + 1} failed:`, error)
        failedRecords.value += chunks[i].length
        errors.value.push({
          chunk: i + 1,
          error: error.message,
          employeeIds: chunks[i]
        })
      }
    }
  }

  // Process single batch
  const processSingleBatch = async (payload) => {
    currentChunk.value = 1
    currentStatus.value = 'Processing all records...'

    try {
      const response = await api.post('/api/master-roll/bulk-edit/execute', payload)
      
      processedRecords.value = response.successCount || payload.employeeIds.length
      if (response.failedCount) {
        failedRecords.value = response.failedCount
        errors.value = response.errors || []
      }

    } catch (error) {
      console.error('Single batch processing failed:', error)
      failedRecords.value = payload.employeeIds.length
      errors.value.push({
        error: error.message,
        employeeIds: payload.employeeIds
      })
      throw error
    }
  }

  // Cancel processing
  const cancelProcessing = () => {
    if (canCancel.value) {
      canCancel.value = false
      currentStatus.value = 'Cancelling operation...'
      
      // Note: In a real implementation, you might want to call an API endpoint
      // to cancel any ongoing server-side processing
      
      setTimeout(() => {
        currentStatus.value = `❌ Operation cancelled. ${processedRecords.value} records were processed before cancellation.`
        isProcessing.value = false
      }, 1000)
    }
  }

  // Get processing status (for potential polling)
  const getProcessingStatus = async (sessionId) => {
    try {
      const response = await api.get(`/api/master-roll/bulk-edit/progress/${sessionId}`)
      return response
    } catch (error) {
      console.error('Failed to get processing status:', error)
      throw error
    }
  }

  return {
    // State
    isProcessing,
    currentChunk,
    totalChunks,
    processedRecords,
    totalRecords,
    failedRecords,
    currentStatus,
    canCancel,
    errors,
    
    // Computed
    overallProgress,
    chunkProgress,
    
    // Methods
    previewChanges,
    validateChanges,
    executeChanges,
    cancelProcessing,
    getProcessingStatus,
    resetState
  }
}
