import { defineEventHandler, readBody, createError } from 'h3'
import { deleteWageFromLedgerMongo } from '../../utils/wagesLedgerMongo'

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
    const { wageIds } = await readBody(event)

    if (!wageIds || !Array.isArray(wageIds) || wageIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Invalid wage IDs data'
      })
    }

    const results = [] as any[]
    for (const wageId of wageIds) {
      try {
        await deleteWageFromLedgerMongo({ _id: wageId } as any, firmId.toString(), userId.toString())
        results.push({ wageId, success: true })
      } catch (e: any) {
        results.push({ wageId, success: false, error: e?.message || 'Failed' })
      }
    }
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount
    return { success: true, successCount, failureCount, results }
  } catch (error) {
    console.error('Error deleting records from Firestore:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error deleting records from Firestore'
    })
  }
})
