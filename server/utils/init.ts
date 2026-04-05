// server/utils/init.ts
import { initializeRoles } from './roles';

// Import all models to ensure they are registered with Mongoose
import '../models/User';
import { NSE } from '../models/NSE';
import { Folio } from '../models/Folio';
import { CNNote } from '../models/CNNote';
import NSEDocumentModel from '../models/NSEDocument';


/**
 * Initialize server resources
 */
export async function initializeServer() {
  try {
    // Initialize roles
    await initializeRoles();

    // Server initialization completed
  } catch (error) {
    console.error('Error initializing server:', error);
    throw error;
  }
}
