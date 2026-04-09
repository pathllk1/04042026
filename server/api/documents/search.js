import Document from '../../models/Document'

export default defineEventHandler(async (event) => {
  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;

    // Only allow GET requests
    if (event.method !== 'GET') {
      throw createError({
        statusCode: 405,
        message: 'Method not allowed'
      })
    }

    // Get query parameters
    const query = getQuery(event)
    const searchTerm = query.term || ''
    const field = query.field || 'name' // Default search field is name

    // Initialize documents database


    // Get all documents for the user
    const allDocuments = await Document.find()
    let userDocuments = allDocuments.filter(doc => doc.userId === userId)

    // Filter documents by search term
    if (searchTerm) {
      userDocuments = userDocuments.filter(doc => {
        // Case insensitive search
        const fieldValue = doc[field]?.toString().toLowerCase() || ''
        return fieldValue.includes(searchTerm.toLowerCase())
      })
    }

    // Sort documents by updated date (newest first)
    userDocuments.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

    return {
      documents: userDocuments,
      count: userDocuments.length
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('Error in documents search API:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})