// server/api/inventory/index.ts
import { defineEventHandler, createError } from 'h3';
import Stocks from '../../models/inventory/Stocks';
import StockReg from '../../models/inventory/StockReg';
import Bills from '../../models/inventory/Bills';
import Party from '../../models/inventory/Party';
import Firm from '../../models/Firm';

// Helper functions for data extraction
function extractStateCodeFromGST(gstNumber: string): number | null {
  if (!gstNumber || gstNumber === 'UNREGISTERED' || gstNumber.length < 2) return null;
  const code = parseInt(gstNumber.substring(0, 2));
  return isNaN(code) ? null : code;
}

function extractCityFromAddress(address: string): string {
  if (!address) return '';
  const parts = address.split(',');
  return parts.length > 1 ? parts[parts.length - 2].trim() : '';
}

function extractPincodeFromAddress(address: string): string {
  if (!address) return '';
  const pincodeMatch = address.match(/\b\d{6}\b/);
  return pincodeMatch ? pincodeMatch[0] : '';
}

export default defineEventHandler(async (event) => {
  // Ensure user is authenticated and has a firmId
  const user = event.context.user;
  if (!user || !user.firmId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not authenticated or missing firm ID'
    });
  }

  // Get the firm ID from the authenticated user
  const firmId = user.firmId.toString();

  try {
    // Get all inventory data for the user's firm
    const stocks = await Stocks.find({ firm: firmId });
    const stockReg = await StockReg.find({ firm: firmId });
    const bills = await Bills.find({ firm: firmId });
    const parties = await Party.find({ firm: firmId });

    // Get firm details
    const firm = await Firm.findById(firmId);
    if (!firm) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Firm not found'
      });
    }

    // Debug: Log firm data structure (can be removed in production)
    console.log('🔍 Firm data structure:', {
      gstNo: firm.gstNo,
      state: firm.state,
      additionalGSTsCount: firm.additionalGSTs?.length || 0,
      hasMultipleGSTs: firm.hasMultipleGSTs
    });

    // Prepare firm GST data
    const firmGSTs = [
      {
        gstNumber: firm.gstNo,
        state: firm.state,
        stateCode: extractStateCodeFromGST(firm.gstNo),
        locationName: 'Head Office',
        address: firm.address,
        city: extractCityFromAddress(firm.address),
        pincode: extractPincodeFromAddress(firm.address),
        isActive: true,
        isDefault: true,
        isPrimary: true
      },
      ...(firm.additionalGSTs || []).map(gst => {
        // Handle both plain objects and Mongoose documents
        const gstData = gst._doc || gst;
        return {
          gstNumber: gstData.gstNumber,
          state: gstData.state,
          stateCode: gstData.stateCode || extractStateCodeFromGST(gstData.gstNumber),
          locationName: gstData.locationName,
          address: gstData.address,
          city: gstData.city,
          pincode: gstData.pincode,
          isActive: gstData.isActive !== undefined ? gstData.isActive : true,
          isDefault: gstData.isDefault || false,
          isPrimary: false
        };
      })
    ];

    console.log('✅ Final firmGSTs array length:', firmGSTs.length);

    // Prepare parties with GST data
    const enhancedParties = parties.map(party => {
      const partyGSTs = [
        {
          gstNumber: party.gstin,
          state: party.state,
          stateCode: party.state_code || extractStateCodeFromGST(party.gstin),
          locationName: 'Primary Location',
          address: party.addr || '',
          city: extractCityFromAddress(party.addr),
          pincode: party.pin ? party.pin.toString() : '',
          isActive: true,
          isDefault: true,
          isPrimary: true
        },
        ...(party.additionalGSTs || []).map(gst => {
          // Handle both plain objects and Mongoose documents
          const gstData = gst._doc || gst;
          return {
            gstNumber: gstData.gstNumber,
            state: gstData.state,
            stateCode: gstData.stateCode,
            locationName: gstData.locationName,
            address: gstData.address || '',
            city: gstData.city || '',
            pincode: gstData.pincode || '',
            contactPerson: gstData.contactPerson || '',
            contactNumber: gstData.contactNumber || '',
            isActive: gstData.isActive !== undefined ? gstData.isActive : true,
            isDefault: gstData.isDefault || false,
            registrationType: gstData.registrationType || 'regular',
            isPrimary: false
          };
        })
      ];

      return {
        ...party.toObject(),
        allGSTs: partyGSTs,
        hasMultipleGSTs: party.hasMultipleGSTs || false
      };
    });

    return {
      userId: user._id,
      firmName: firm.name,
      gstNo: firm.gstNo,
      Firm_state: firm.state,
      Firm_address: firm.address,

      // Enhanced multi-GST data
      firmGSTs,
      hasMultipleFirmGSTs: firm.hasMultipleGSTs || false,

      stocks,
      stockReg,
      bills,
      parties: enhancedParties
    };
  } catch (error: any) {
    console.error('Error fetching inventory data:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching inventory data: ${error.message}`
    });
  }
});