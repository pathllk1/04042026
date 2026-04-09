import Document from '../../models/Document'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Get userId from the event context (set by auth middleware)
    const userId = event.context.userId;
    const firmId = event.context.user.firmId;


    // Handle different HTTP methods
    if (event.method === 'GET') {
      // Get query parameters
      const query = getQuery(event);
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const status = query.status; // 'all', 'active', 'expired', 'expiring-soon'
      const searchQuery = query.search || '';
      const sortBy = query.sortBy || 'updatedAt';
      const sortDirection = query.sortDirection || 'desc';

      // Base query to get documents for the user
      const matchQuery = { firmId };

      // Add search functionality if search query is provided
      if (searchQuery) {
        matchQuery.$or = [
          { name: { $regex: searchQuery, $options: 'i' } },
          { ref_no: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      // Filter by status if specified
      if (status && status !== 'all') {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        switch (status) {
          case 'active':
            matchQuery.expiryDate = { $gt: today };
            break;
          case 'expired':
            matchQuery.expiryDate = { $lte: today };
            break;
          case 'expiring-soon':
            matchQuery.expiryDate = { $gt: today, $lte: thirtyDaysFromNow };
            break;
          default:
            break;
        }
      }

      // Get total document count
      const totalDocuments = await Document.countDocuments(matchQuery);

      // Calculate total pages (minimum 1 page even if no documents)
      const totalPages = Math.max(1, Math.ceil(totalDocuments / limit));

      // Create sort object based on parameters
      const sortObject = {};
      // Map frontend sort fields to database fields if needed
      const sortField = sortBy === 'ref_no' ? 'ref_no' : sortBy;
      sortObject[sortField] = sortDirection === 'asc' ? 1 : -1;

      // Ensure the requested page is not beyond the available pages
      const safePage = Math.min(page, totalPages);

      // Calculate skip value for pagination using the safe page number
      const skip = (safePage - 1) * limit;

      // Ensure we don't skip beyond the total number of documents
      const safeSkip = Math.min(skip, Math.max(0, totalDocuments - 1));

      // Paginate and sort documents
      const documents = await Document.find(matchQuery)
        .sort(sortObject) // Sort by the specified field and direction
        .skip(safeSkip) // Skip documents for pagination with safety check
        .limit(limit); // Limit the number of results
      // Return paginated results with metadata
      return {
        documents,
        pagination: {
          total: totalDocuments,
          page: safePage, // Return the safe page number instead of the requested page
          limit,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPrevPage: safePage > 1,
          requestedPage: page // Include the originally requested page for debugging
        },
      };
    } else if (event.method === 'POST') {
      // Create a new document
      const body = await readBody(event);
      // Validate input
      if (!body.name || !body.expiryDate || !body.ref_no) {
        throw createError({
          statusCode: 400,
          message: 'Name, reference number, and expiry date are required',
        });
      }

      // Create and save a new document
      const document = new Document({
        ...body, // Spread operator to copy fields from body
        userId,  // Add userId from an external variable
        firmId,
      });

      const savedDocument = await document.save();
      return savedDocument;
    } else {
      throw createError({
        statusCode: 405,
        message: 'Method not allowed'
      })
    }
  } catch (error) {
    if (error.statusCode) {
      console.error('Error in documents API:', error)
      throw error
    }

    console.error('Error in documents API:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal server error'
    })
  }
})