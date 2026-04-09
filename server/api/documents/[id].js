import Document from '../../models/Document'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;

    // Get document ID from the URL
    const id = event.context.params.id;

    // Fetch the document from the database using Mongoose
    const document = await Document.findById(id);

    // Check if document exists
    if (!document) {
      throw createError({
        statusCode: 404,
        message: 'Document not found',
      });
    }

    // Check if the user owns the document
    // Convert both to string for proper comparison
    if (document.userId.toString() !== userId.toString()) {
      throw createError({
        statusCode: 403,
        message: 'Forbidden: You do not have permission to access this document',
      });
    }

    // Handle different HTTP methods
    if (event.method === 'GET') {
      // Return the document
      return document
    } else if (event.method === 'PUT') {
      // Update the document
      const body = await readBody(event)

      // Validate input
      if (!body.name || !body.expiryDate || !body.ref_no) {
        throw createError({
          statusCode: 400,
          message: 'Name, reference number, and expiry date are required'
        })
      }

      // Update document
      const updatedDocument = await Document.findByIdAndUpdate(
        id, // ID of the document to update
        {
          ...body, // Spread the updated fields from the request body
          userId, // Make sure userId is maintained
        },
        {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators on the updated data
        }
      );

      return updatedDocument
    } else if (event.method === 'DELETE') {
      // Delete the document
      const success = await Document.findByIdAndDelete(id);

      if (!success) {
        throw createError({
          statusCode: 500,
          message: 'Failed to delete document'
        })
      }

      return { success: true, message: 'Document deleted successfully' }
    } else {
      throw createError({
        statusCode: 405,
        message: 'Method not allowed'
      })
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('Error in documents API:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})