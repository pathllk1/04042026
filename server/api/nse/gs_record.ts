import { verifyToken } from '../../utils/auth';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export default defineEventHandler(async (event) => {
  console.log(`[GS_Record API] Received ${event.method} request`);
  try {
    // Verify user authentication
    console.log('[GS_Record API] Verifying user token');
    const user = await verifyToken(event);
    if (!user) {
      console.error('[GS_Record API] Unauthorized access attempt');
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      });
    }
    console.log(`[GS_Record API] User authenticated: ${user._id}`);

    // Get runtime config to access environment variables
    console.log('[GS_Record API] Loading runtime configuration');
    const config = useRuntimeConfig();
    const gsEmail = config.googleDriveEmail;
    const gsKey = config.googleDriveKey;
    console.log(`[GS_Record API] Google Drive email configured: ${gsEmail ? 'Yes' : 'No'}`);

    // Create JWT client for Google Sheets API
    console.log('[GS_Record API] Creating JWT client for Google Sheets API');
    const client = new JWT({
      email: gsEmail,
      key: gsKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth: client });
    console.log('[GS_Record API] Google Sheets API client initialized');

    // Get Google Sheets data
    const spreadsheetId = "1TfOwGAQGkySV37mQl-AFBfkQkiyirxsqA4nBgtyXm0I";
    console.log(`[GS_Record API] Fetching data from spreadsheet: ${spreadsheetId}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet2!A1:IZ", // Assuming column A has symbols and B has prices
    });
    console.log('[GS_Record API] Successfully retrieved spreadsheet data');

    const data = response.data.values;
    if (!data) {
      console.error('[GS_Record API] No data found in spreadsheet');
      throw createError({
        statusCode: 404,
        message: 'No data found'
      });
    }
    console.log(`[GS_Record API] Retrieved ${data.length} rows of data`);

    const dates = data[0]?.slice(2) || []; // Skip Columns A and B, start from Column C
    console.log(`[GS_Record API] Extracted ${dates.length} date points`);

    // Process each stock row
    console.log('[GS_Record API] Processing stock data rows');
    const jsonOutput = [];
    for (let i = 1; i < data.length; i++) {
      const symbol = data[i][0]; // Column A (symbol)
      const closingPrices = data[i].slice(2).map((price: any) => parseFloat(price)); // Skip Columns A and B

      const history = dates.map((date: any, idx: any) => ({
        date,
        close: closingPrices[idx] || null, // Handle missing data
      }));

      jsonOutput.push({ symbol, history });

      // Log progress every 10 symbols to avoid excessive logging
      if (i % 10 === 0 || i === data.length - 1) {
        console.log(`[GS_Record API] Processed ${i}/${data.length - 1} symbols`);
      }
    }
    console.log(`[GS_Record API] Successfully processed ${jsonOutput.length} stock symbols`);

    return jsonOutput;
  } catch (error: any) {
    console.error(`[GS_Record API] Error: ${error.message}`, error);
    throw createError({
      statusCode: 500,
      message: `Error fetching Google Sheets data: ${error.message}`
    });
  }
});
