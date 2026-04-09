// server/api/stock-market/contract-notes.ts
import { defineEventHandler, createError } from 'h3';
import { CNNote } from '../../models/CNNote';
import { Folio } from '../../models/Folio';

export default defineEventHandler(async (event) => {
  try {
    // Ensure user is authenticated
    const user = event.context.user;
    if (!user) {
      console.error('Authentication error: User not authenticated');
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: User not authenticated'
      });
    }

    // Get the user ID from the authenticated user
    const userId = user._id.toString();
    console.log(`Fetching contract notes for user ID: ${userId}`);

    try {
      // Fetch all contract notes for the user with populated Folio records
      const contractNotes = await CNNote.find({ user: userId })
        .populate({
          path: 'Folio_rec',
          model: Folio,
          options: { lean: true }
        })
        .sort({ cn_date: -1 }) // Sort by contract note date, newest first
        .lean(); // Convert to plain JavaScript objects

      console.log(`Found ${contractNotes.length} contract notes for user`);

      try {
        // Process contract notes to include summary information
        const processedNotes = contractNotes.map(note => {
          try {
            // Calculate summary statistics for each note
            let totalInvested = 0;
            let totalQuantity = 0;
            let totalStocks = 0;
            
            // Count unique symbols in the note
            const uniqueSymbols = new Set();
            
            // Process folio records if they exist
            if (note.Folio_rec && Array.isArray(note.Folio_rec) && note.Folio_rec.length > 0) {
              note.Folio_rec.forEach(folio => {
                try {
                  // Add to totals
                  totalInvested += Number(folio.namt) || 0;
                  totalQuantity += Number(folio.qnty) || 0;
                  
                  // Add to unique symbols
                  if (folio.symbol) {
                    uniqueSymbols.add(folio.symbol);
                  }
                } catch (folioError) {
                  console.error(`Error processing folio record in contract note ${note._id}:`, folioError);
                }
              });
              
              totalStocks = uniqueSymbols.size;
            }
            
            // Return the note with summary information
            return {
              ...note,
              summary: {
                totalInvested,
                totalQuantity,
                totalStocks,
                otherCharges: note.oth_chg || 0,
                finalAmount: note.famt || 0
              }
            };
          } catch (noteError) {
            console.error(`Error processing contract note ${note._id}:`, noteError);
            // Return the original note without summary if there's an error
            return note;
          }
        });
        
        // Calculate overall summary
        let totalNotes = processedNotes.length;
        let totalInvested = 0;
        let totalStocks = 0;
        
        // Count unique brokers and folios
        const uniqueBrokers = new Set();
        const uniqueFolios = new Set();
        const uniqueSymbols = new Set();
        
        // Process all notes
        processedNotes.forEach(note => {
          try {
            // Add to totals
            if (note.summary && note.summary.totalInvested) {
              totalInvested += note.summary.totalInvested;
            }
            
            // Add to unique sets
            if (note.broker) uniqueBrokers.add(note.broker);
            if (note.folio) uniqueFolios.add(note.folio);
            
            // Process folio records to count unique symbols
            if (note.Folio_rec && Array.isArray(note.Folio_rec)) {
              note.Folio_rec.forEach(folio => {
                if (folio.symbol) uniqueSymbols.add(folio.symbol);
              });
            }
          } catch (summaryError) {
            console.error(`Error calculating summary for contract note ${note._id}:`, summaryError);
          }
        });
        
        totalStocks = uniqueSymbols.size;
        
        // Group by broker
        const brokerSummary = {};
        processedNotes.forEach(note => {
          try {
            const broker = note.broker || 'Unknown';
            if (!brokerSummary[broker]) {
              brokerSummary[broker] = {
                count: 0,
                totalInvested: 0
              };
            }
            
            brokerSummary[broker].count += 1;
            if (note.summary && note.summary.totalInvested) {
              brokerSummary[broker].totalInvested += note.summary.totalInvested;
            }
          } catch (brokerError) {
            console.error(`Error calculating broker summary for contract note ${note._id}:`, brokerError);
          }
        });
        
        // Convert broker summary to array
        const brokerSummaryArray = Object.entries(brokerSummary).map(([broker, data]) => ({
          broker,
          count: data.count,
          totalInvested: data.totalInvested,
          percentage: totalInvested > 0 ? (data.totalInvested / totalInvested) * 100 : 0
        }));
        
        // Group by month and year
        const monthlyData = {};
        processedNotes.forEach(note => {
          try {
            if (note.cn_date) {
              const date = new Date(note.cn_date);
              const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              
              if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                  count: 0,
                  totalInvested: 0,
                  month: date.getMonth() + 1,
                  year: date.getFullYear(),
                  displayName: date.toLocaleString('default', { month: 'short', year: 'numeric' })
                };
              }
              
              monthlyData[monthYear].count += 1;
              if (note.summary && note.summary.totalInvested) {
                monthlyData[monthYear].totalInvested += note.summary.totalInvested;
              }
            }
          } catch (monthlyError) {
            console.error(`Error calculating monthly summary for contract note ${note._id}:`, monthlyError);
          }
        });
        
        // Convert monthly data to array and sort by date
        const monthlyDataArray = Object.values(monthlyData)
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          });
        
        console.log(`Successfully processed ${processedNotes.length} contract notes`);
        
        // Return the data
        return {
          contractNotes: processedNotes,
          summary: {
            totalNotes,
            totalInvested,
            totalStocks,
            uniqueBrokers: uniqueBrokers.size,
            uniqueFolios: uniqueFolios.size
          },
          brokerSummary: brokerSummaryArray,
          monthlyData: monthlyDataArray,
          timestamp: new Date().toISOString()
        };
      } catch (processingError) {
        const error = processingError as Error;
        console.error(`Error processing contract notes data: ${error.message || 'Unknown error'}`);
        console.error(error.stack || 'No stack trace available');
        throw createError({
          statusCode: 500,
          statusMessage: `Error processing contract notes data: ${error.message || 'Unknown error'}`
        });
      }
    } catch (dbError) {
      const error = dbError as Error;
      console.error(`Database error: ${error.message || 'Unknown database error'}`);
      console.error(error.stack || 'No stack trace available');
      throw createError({
        statusCode: 500,
        statusMessage: `Database error: ${error.message || 'Unknown database error'}`
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Unhandled error in contract-notes.ts: ${error.message || 'Unknown error'}`);
    console.error(error.stack || 'No stack trace available');
    throw createError({
      statusCode: 500,
      statusMessage: `Error fetching contract notes data: ${error.message || 'Unknown error'}`
    });
  }
});
