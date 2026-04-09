// server/api/firms/index.ts
import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import Firm from '../../models/Firm';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  // GET and POST are public methods, no authentication required
  // Verify authentication only for PUT and DELETE
  if (event.node.req.method === 'PUT' || event.node.req.method === 'DELETE') {
    try {
      const user = await verifyToken(event);

      // Only admins can update/delete firms
      if (user.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: Only admins can manage firms'
        });
      }
    } catch (error) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Authentication required for this operation'
      });
    }
  }

  // GET - List firms or search by name
  if (event.node.req.method === 'GET') {
    const query = getQuery(event);
    const searchTerm = query.search as string;

    let firmQuery = {};

    // If search term is provided, use it to filter firms
    if (searchTerm) {
      firmQuery = {
        name: { $regex: searchTerm, $options: 'i' } // Case-insensitive search
      };
    }

    const firms = await Firm.find(firmQuery).sort({ name: 1 }).limit(20);
    return firms;
  }

  // POST - Create a new firm
  if (event.node.req.method === 'POST') {
    const { name, code, description, status, address, contactPerson, contactNo, email, gstNo, businessType } = await readBody(event);

    if (!name || !code) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name and code are required'
      });
    }

    // Check if firm with same name or code already exists
    const existingFirm = await Firm.findOne({ $or: [{ name }, { code }] });
    if (existingFirm) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A firm with this name or code already exists'
      });
    }

    // Set status to 'pending' for public submissions
    const firmStatus = status || 'pending';

    const firm = new Firm({
      name,
      code,
      description,
      status: firmStatus,
      address,
      contactPerson,
      contactNo,
      email,
      gstNo,
      businessType
    });
    await firm.save();

    return {
      message: firmStatus === 'pending' ? 'Firm created and pending approval' : 'Firm created successfully',
      firm
    };
  }

  // PUT - Update a firm
  if (event.node.req.method === 'PUT') {
    const { id, name, code, description } = await readBody(event);

    if (!id || (!name && !code && !description)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID and at least one field to update are required'
      });
    }

    const firm = await Firm.findById(id);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    // Update fields if provided
    if (name) firm.name = name;
    if (code) firm.code = code;
    if (description !== undefined) firm.description = description;

    await firm.save();

    return { message: 'Firm updated successfully', firm };
  }

  // DELETE - Delete a firm
  if (event.node.req.method === 'DELETE') {
    const { id } = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      });
    }

    const result = await Firm.findByIdAndDelete(id);
    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    return { message: 'Firm deleted successfully' };
  }
});