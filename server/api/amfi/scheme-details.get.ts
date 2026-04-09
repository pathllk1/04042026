import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const userId = event.context.userId;
    if (!userId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const query = getQuery(event);
    const schemeName = query.schemeName as string;

    if (!schemeName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Scheme name is required'
      });
    }

    // Fetch AMFI data
    const amfiData = await fetchAMFIData(schemeName);

    return amfiData;

  } catch (error) {
    console.error('Error fetching AMFI scheme details:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch AMFI scheme details'
    });
  }
});

async function fetchAMFIData(schemeName: string) {
  try {
    // AMFI NAV API endpoint
    const amfiUrl = 'https://www.amfiindia.com/spages/NAVAll.txt';

    const response = await fetch(amfiUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch AMFI data');
    }

    const data = await response.text();
    const lines = data.split('\n');

    let currentFundHouse = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and headers
      if (!trimmedLine || trimmedLine.includes('Scheme Code') || trimmedLine.includes('AMFI')) {
        continue;
      }

      // Check if this line is a fund house name (doesn't start with a number)
      if (!trimmedLine.match(/^\d/)) {
        currentFundHouse = trimmedLine;
        continue;
      }

      // Parse scheme data
      const parts = trimmedLine.split(';');
      if (parts.length >= 6) {
        const schemeCode = parts[0];
        const isin = parts[1];
        const currentSchemeName = parts[3];
        const currentNAV = parts[4];
        const date = parts[5];

        // Check if scheme name matches (case insensitive partial match)
        if (currentSchemeName && currentSchemeName.toLowerCase().includes(schemeName.toLowerCase())) {

          // Determine category from scheme name
          let category = 'Other';
          const nameUpper = currentSchemeName.toUpperCase();
          if (nameUpper.includes('EQUITY') || nameUpper.includes('STOCK')) {
            category = 'Equity';
          } else if (nameUpper.includes('DEBT') || nameUpper.includes('BOND') || nameUpper.includes('INCOME')) {
            category = 'Debt';
          } else if (nameUpper.includes('HYBRID') || nameUpper.includes('BALANCED')) {
            category = 'Hybrid';
          } else if (nameUpper.includes('LIQUID') || nameUpper.includes('MONEY MARKET')) {
            category = 'Liquid';
          }

          // Determine dividend option from scheme name
          let dividendOption = 'Growth';
          if (nameUpper.includes('DIVIDEND') || nameUpper.includes('DIV')) {
            dividendOption = 'Dividend';
          } else if (nameUpper.includes('BONUS')) {
            dividendOption = 'Bonus';
          }

          // Estimate expense ratio based on category and scheme type
          let estimatedExpense = 0;
          if (nameUpper.includes('DIRECT')) {
            // Direct plans typically have lower expense ratios
            if (category === 'Equity') {
              estimatedExpense = 1.0; // Typical range 0.5-1.5%
            } else if (category === 'Debt') {
              estimatedExpense = 0.5; // Typical range 0.25-0.75%
            } else if (category === 'Hybrid') {
              estimatedExpense = 0.8; // Typical range 0.5-1.2%
            } else if (category === 'Liquid') {
              estimatedExpense = 0.2; // Typical range 0.1-0.3%
            }
          } else {
            // Regular plans have higher expense ratios
            if (category === 'Equity') {
              estimatedExpense = 2.0; // Typical range 1.5-2.5%
            } else if (category === 'Debt') {
              estimatedExpense = 1.0; // Typical range 0.75-1.5%
            } else if (category === 'Hybrid') {
              estimatedExpense = 1.5; // Typical range 1.0-2.0%
            } else if (category === 'Liquid') {
              estimatedExpense = 0.3; // Typical range 0.2-0.5%
            }
          }

          return {
            schemeCode: schemeCode,
            fundHouse: currentFundHouse,
            category: category,
            currentNAV: parseFloat(currentNAV) || 0,
            prevDayNAV: parseFloat(currentNAV) || 0, // AMFI doesn't provide previous day NAV directly
            expense: estimatedExpense, // Estimated based on category and plan type
            dividendOption: dividendOption // Determined from scheme name
          };
        }
      }
    }

    // If no exact match found, return null
    throw new Error('Scheme not found in AMFI data');

  } catch (error) {
    console.error('Error parsing AMFI data:', error);
    throw error;
  }
}
