// server/api/inventory/party-gst.post.ts
import { defineEventHandler, createError, readBody } from 'h3';
import Party from '../../models/inventory/Party';

// Helper function to validate GST number format
function isValidGSTFormat(gstNumber: string): boolean {
  if (gstNumber === 'UNREGISTERED') return true;
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstNumber);
}

// Helper function to extract state code from GST number
function extractStateCodeFromGST(gstNumber: string): number {
  if (gstNumber === 'UNREGISTERED') return 0;
  return parseInt(gstNumber.substring(0, 2));
}

// Helper function to get state name from code
function getStateNameFromCode(code: number): string {
  const stateMap: { [key: number]: string } = {
    1: 'Jammu & Kashmir', 2: 'Himachal Pradesh', 3: 'Punjab',
    4: 'Chandigarh', 5: 'Uttarakhand', 6: 'Haryana',
    7: 'Delhi', 8: 'Rajasthan', 9: 'Uttar Pradesh',
    10: 'Bihar', 11: 'Sikkim', 12: 'Arunachal Pradesh',
    13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram',
    16: 'Tripura', 17: 'Meghalaya', 18: 'Assam',
    19: 'West Bengal', 20: 'Jharkhand', 21: 'Odisha',
    22: 'Chhattisgarh', 23: 'Madhya Pradesh', 24: 'Gujarat',
    25: 'Daman & Diu', 26: 'Dadra & Nagar Haveli', 27: 'Maharashtra',
    28: 'Andhra Pradesh', 29: 'Karnataka', 30: 'Goa',
    31: 'Lakshadweep', 32: 'Kerala', 33: 'Tamil Nadu',
    34: 'Puducherry', 35: 'Andaman & Nicobar Islands', 36: 'Telangana',
    37: 'Andhra Pradesh', 38: 'Ladakh'
  };
  return stateMap[code] || 'Unknown';
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
    });
  }

  const body = await readBody(event);

  try {
    // Validate required fields
    if (!body.partyId || !body.gstNumber || !body.locationName || !body.city || !body.pincode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Party ID, GST number, location name, city, and pincode are required'
      });
    }

    // Validate GST number format
    if (!isValidGSTFormat(body.gstNumber.toUpperCase())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid GST number format'
      });
    }

    const gstNumber = body.gstNumber.toUpperCase();
    const stateCode = extractStateCodeFromGST(gstNumber);
    const stateName = body.state || getStateNameFromCode(stateCode);

    // Get the party and verify it belongs to the user's firm
    const party = await Party.findOne({
      _id: body.partyId,
      firm: user.firmId.toString()
    });

    if (!party) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Party not found or does not belong to your firm'
      });
    }

    // Check if GST number already exists (in primary or additional GSTs)
    if (party.gstin === gstNumber) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This GST number is already the primary GST for this party'
      });
    }

    const existingGST = party.additionalGSTs?.find(gst => gst.gstNumber === gstNumber);
    if (existingGST) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This GST number already exists for this party'
      });
    }

    // Create new GST registration
    const newGST = {
      gstNumber,
      state: stateName,
      stateCode,
      locationName: body.locationName,
      address: body.address || '',
      city: body.city,
      pincode: body.pincode,
      contactPerson: body.contactPerson || '',
      contactNumber: body.contactNumber || '',
      isActive: body.isActive !== false,
      isDefault: body.isDefault || false,
      registrationType: gstNumber === 'UNREGISTERED' ? 'unregistered' : (body.registrationType || 'regular'),
      validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
      validTo: body.validTo ? new Date(body.validTo) : undefined,
      lastUsedDate: undefined,
      transactionCount: 0
    };

    // If this is set as default, unset other defaults
    if (newGST.isDefault) {
      party.additionalGSTs?.forEach(gst => {
        gst.isDefault = false;
      });
    }

    // Add the new GST to the party
    if (!party.additionalGSTs) {
      party.additionalGSTs = [];
    }
    party.additionalGSTs.push(newGST);
    party.hasMultipleGSTs = true;

    await party.save();

    return {
      success: true,
      message: 'Party GST registration added successfully',
      data: {
        partyId: party._id,
        partyName: party.supply,
        gstNumber: newGST.gstNumber,
        state: newGST.state,
        locationName: newGST.locationName
      }
    };

  } catch (error: any) {
    console.error('Error adding party GST:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add party GST registration: ${error.message}`
    });
  }
});
