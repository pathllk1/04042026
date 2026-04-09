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

    // Get Google Sheets data from Sheet1 which contains current prices
    const spreadsheetId = "1TfOwGAQGkySV37mQl-AFBfkQkiyirxsqA4nBgtyXm0I";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:B", // Column A has symbols and B has prices
    });

    const data = response.data.values;
    if (!data || data.length === 0) {
      console.log('No data found in Google Sheet');
      throw createError({
        statusCode: 404,
        message: 'No data found in Google Sheet'
      });
    }

    console.log(`Found ${data.length} rows in Google Sheet`);

    // Process the data to return all symbols with their prices
    // Skip the header row if it exists
    const startIndex = data[0][0] === 'Symbol' || data[0][0] === 'SYMBOL' ? 1 : 0;
    
    const symbolsWithPrices = [];
    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const symbol = row[0].replace('NSE:', ''); // Remove NSE: prefix if it exists
        const price = parseFloat(row[1]);
        
        if (symbol && !isNaN(price)) {
          symbolsWithPrices.push({
            symbol,
            price
          });
        }
      }
    }

    console.log(`Processed ${symbolsWithPrices.length} valid symbols with prices`);
    return symbolsWithPrices;
  } catch (error) {
    console.error('Error fetching symbols with prices:', error);
    throw createError({
      statusCode: 500,
      message: 'Error fetching symbols with prices'
    });
  }
});
