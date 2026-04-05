import { defineEventHandler, readBody, createError } from 'h3'
import { postWagesToLedgerMongo } from '../../utils/wagesLedgerMongo'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId
  const firmId = event.context.user?.firmId

  if (!userId || !firmId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized'
    })
  }

  try {
    const { wages, chunkSize = 10, chunkIndex = 0 } = await readBody(event)

    if (!wages || !Array.isArray(wages)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid wages data'
      })
    }

    // Validate required fields before processing
    const invalidWages = wages.filter(wage => !wage.ledgerId || !wage._id || !wage.employeeName)
    if (invalidWages.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Missing required fields in ${invalidWages.length} wage records. Required: ledgerId, _id, employeeName`
      })
    }

    // Process the current chunk
    const start = chunkIndex * chunkSize
    const chunk = wages.slice(start, start + chunkSize)
    const { results, successCount, failureCount } = await postWagesToLedgerMongo(chunk as any, firmId.toString(), userId.toString())
    const hasMoreChunks = (chunkIndex + 1) * chunkSize < wages.length
    
    return {
      success: true,
      processedCount: chunk.length,
      successCount,
      failureCount,
      chunkIndex,
      hasMoreChunks,
      totalChunks: Math.ceil(wages.length / chunkSize),
      results
    }
  } catch (error: any) {
    console.error('Error processing batch add to Firestore:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error processing batch add'
    })
  }
})
