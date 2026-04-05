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
    const { wages } = await readBody(event)

    if (!wages || !Array.isArray(wages) || wages.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Invalid wages data'
      })
    }

    // Validate required fields before processing
    const invalidWages = wages.filter(wage => !wage.ledgerId || !wage._id || !wage.employeeName);

    if (invalidWages.length > 0) {
      // Log detailed information about the invalid wages for debugging
      console.error('Invalid wages detected:',
        invalidWages.map(wage => ({
          id: wage._id || 'missing',
          name: wage.employeeName || 'missing',
          ledgerId: wage.ledgerId || 'missing'
        }))
      );

      throw createError({
        statusCode: 400,
        message: `Missing required fields in ${invalidWages.length} wage records. Required: ledgerId, _id, employeeName`
      });
    }

    const response = await postWagesToLedgerMongo(wages, firmId.toString(), userId.toString())
    return { ...response }
  } catch (error: any) {
    console.error('Error adding wages to Firestore:', error)
    throw createError({
      statusCode: 500,
      message: error?.message || 'Error adding wages'
    })
  }
})
