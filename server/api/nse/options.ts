import { defineEventHandler, createError } from 'h3';
import { Folio } from '../../models/Folio';
import { verifyToken } from '../../utils/auth';

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

    // Get unique broker values
    const brokers = await Folio.distinct('broker', { user: user._id });
    
    // Get unique folio values
    const folios = await Folio.distinct('folio', { user: user._id });
    
    // Group brokers by first letter
    const groupedBrokers = brokers.reduce((acc, broker) => {
      if (!broker) return acc;
      
      const firstLetter = broker.charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      
      if (!acc[firstLetter].includes(broker)) {
        acc[firstLetter].push(broker);
      }
      
      return acc;
    }, {});
    
    // Group folios by first letter
    const groupedFolios = folios.reduce((acc, folio) => {
      if (!folio) return acc;
      
      const firstLetter = folio.charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      
      if (!acc[firstLetter].includes(folio)) {
        acc[firstLetter].push(folio);
      }
      
      return acc;
    }, {});

    return {
      brokers: groupedBrokers,
      folios: groupedFolios
    };
  } catch (error) {
    console.error('Error fetching options:', error);
    throw createError({
      statusCode: 500,
      message: `Error fetching options: ${error.message}`
    });
  }
});
