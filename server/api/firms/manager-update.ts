// server/api/firms/manager-update.ts
import { defineEventHandler, readBody, createError } from 'h3';
import Firm from '../../models/Firm';
import User from '../../models/User';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  // Verify authentication and ensure user is a manager
  const user = await verifyToken(event);
  
  if (user.role !== 'manager') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only managers can update their firm details'
    });
  }

  // Get the manager's firm ID
  const userRecord = await User.findById(user.id);
  if (!userRecord) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    });
  }

  const firmId = userRecord.firmId;
  if (!firmId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User is not associated with any firm'
    });
  }

  // Get the firm data from request body
  const {
    name,
    code,
    description,
    address,
    state,
    contactPerson,
    contactNo,
    email,
    gstNo,
    businessType,
    hasMultipleGSTs,
    additionalGSTs
  } = await readBody(event);

  // Find the firm
  const firm = await Firm.findById(firmId);
  if (!firm) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Firm not found'
    });
  }

  // Update firm fields if provided
  if (name) firm.name = name;
  if (code) firm.code = code;
  if (description !== undefined) firm.description = description;
  if (address) firm.address = address;
  if (state) firm.state = state;
  if (contactPerson) firm.contactPerson = contactPerson;
  if (contactNo) firm.contactNo = contactNo;
  if (email) firm.email = email;
  if (gstNo) firm.gstNo = gstNo;
  if (businessType) firm.businessType = businessType;

  // Update multi-GST fields if provided
  if (hasMultipleGSTs !== undefined) firm.hasMultipleGSTs = hasMultipleGSTs;
  if (additionalGSTs !== undefined) {
    // Validate additionalGSTs structure if provided
    if (Array.isArray(additionalGSTs)) {
      firm.additionalGSTs = additionalGSTs;
    }
  }
  
  // Save the updated firm
  await firm.save();
  
  return { 
    message: 'Firm updated successfully', 
    firm 
  };
});