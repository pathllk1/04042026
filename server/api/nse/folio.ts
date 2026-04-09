import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export default defineEventHandler(async (event) => {
  try {
    // Verify user authentication
    const user = await verifyToken(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }

    // Get runtime config to access environment variables
    const config = useRuntimeConfig();
    const gsEmail = config.googleDriveEmail;
    const gsKey = config.googleDriveKey;

    // Create JWT client for Google Sheets API
    const client = new JWT({
      email: gsEmail,
      key: gsKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const sheets = google.sheets({ version: "v4", auth: client });

    // Get Google Sheets data
    const spreadsheetId = "1TfOwGAQGkySV37mQl-AFBfkQkiyirxsqA4nBgtyXm0I";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:B", // Assuming column A has symbols and B has prices
    });

    // Convert sheets data to Map for faster lookups
    const priceMap = new Map(
      response.data.values?.map(([symbol, price]) => [symbol, price]) || []
    );

    // Get folio records
    const folioRecords = await Folio.find({ user: user._id });
    const today = new Date();

    // Update each record with age and current price if available
    const updatedRecords = await Promise.all(folioRecords.map(async (record) => {
      // Calculate age
      const purchaseDate = new Date(record.pdate);
      const diffTime = Math.abs(today.getTime() - purchaseDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Look up current price with "NSE:" prefix
      const symbolWithPrefix = `NSE:${record.symbol}`;
      const currentPrice = priceMap.get(symbolWithPrefix);

      // Update record with both age and current price
      return await Folio.findByIdAndUpdate(
        record._id,
        {
          age: diffDays,
          cprice: currentPrice || record.cprice, // Keep existing price if no match found
          cval: Number((parseFloat(currentPrice?.toString() || record.cprice.toString()) * parseFloat(record.qnty.toString())).toFixed(2)),
          pl: Number(((parseFloat(currentPrice?.toString() || record.cprice.toString()) - parseFloat(record.price.toString())) * parseFloat(record.qnty.toString())).toFixed(2))
        },
        { new: true }
      );
    }));

    return updatedRecords;
  } catch (error) {
    console.error('Error fetching/updating folio records:', error);
    throw createError({
      statusCode: 500,
      message: 'Error fetching/updating folio records'
    });
  }
});
