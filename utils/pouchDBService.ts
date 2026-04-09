import { isToday, isOlderThanMinutes, getTimestamp } from './cacheUtils';
import { ref } from 'vue';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// We'll dynamically import PouchDB only on the client side
// Define PouchDB type for TypeScript
let PouchDB: any = null;

// Define PouchDB database type
type PouchDBDatabase = PouchDB.Database;

// Define metadata document type
interface MetadataDoc {
  _id: string;
  lastFetch?: string;
  [key: string]: any;
}

// Constants for cache refresh intervals
export const CURRENT_PRICES_REFRESH_MINUTES = 20; // Refresh current prices every 20 minutes
export const HISTORY_REFRESH_DAYS = 1; // Refresh history data once per day

// Database references
export const gsHistoryDb = ref<PouchDBDatabase | null>(null);
export const gsCurrentPricesDb = ref<PouchDBDatabase | null>(null);
export const nseDb = ref<PouchDBDatabase | null>(null);

// Cache metadata
export const lastHistoryFetch = ref<Date | null>(null);
export const lastPricesFetch = ref<Date | null>(null);

/**
 * Initialize PouchDB databases
 */
export async function initPouchDBs() {
  if (isBrowser) {
    try {
      // Dynamically import PouchDB only on the client side
      if (!PouchDB) {
        try {
          // Use dynamic import to load PouchDB only in the browser
          const PouchDBModule = await import('pouchdb-browser');
          PouchDB = PouchDBModule.default;
        } catch (importError) {
          console.error(`[${getTimestamp()}] Error importing PouchDB:`, importError);
          return;
        }
      }

      // Initialize databases if they don't exist
      if (!gsHistoryDb.value) {
        gsHistoryDb.value = new PouchDB('gs_history_records');
      }

      if (!gsCurrentPricesDb.value) {
        gsCurrentPricesDb.value = new PouchDB('gs_current_prices');
      }

      if (!nseDb.value) {
        nseDb.value = new PouchDB('nse_records');
      }

      // Check for existing metadata
      await loadCacheMetadata();
    } catch (error) {
      console.error(`[${getTimestamp()}] Error initializing PouchDB:`, error);
    }
  }
}

/**
 * Load cache metadata from PouchDB
 */
async function loadCacheMetadata() {
  try {
    // Try to get metadata document from history database
    if (gsHistoryDb.value) {
      try {
        const metaDoc: any = await gsHistoryDb.value.get('metadata');
        if (metaDoc && metaDoc.lastFetch) {
          lastHistoryFetch.value = new Date(metaDoc.lastFetch);
          console.log(`[${getTimestamp()}] Loaded history metadata: last fetch at ${lastHistoryFetch.value}`);
        }
      } catch (err: any) {
        if (err.name !== 'not_found') {
          console.error(`[${getTimestamp()}] Error loading history metadata:`, err);
        }
      }
    }

    // Try to get metadata document from prices database
    if (gsCurrentPricesDb.value) {
      try {
        const metaDoc: any = await gsCurrentPricesDb.value.get('metadata');
        if (metaDoc && metaDoc.lastFetch) {
          lastPricesFetch.value = new Date(metaDoc.lastFetch);
          console.log(`[${getTimestamp()}] Loaded prices metadata: last fetch at ${lastPricesFetch.value}`);
        }
      } catch (err: any) {
        if (err.name !== 'not_found') {
          console.error(`[${getTimestamp()}] Error loading prices metadata:`, err);
        }
      }
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] Error loading cache metadata:`, error);
  }
}

/**
 * Update cache metadata
 * @param type The type of cache to update ('history' or 'prices')
 */
export async function updateCacheMetadata(type: 'history' | 'prices') {
  try {
    const now = new Date();
    const db = type === 'history' ? gsHistoryDb.value : gsCurrentPricesDb.value;

    if (db) {
      // Try to get existing metadata doc
      let metaDoc: any;
      try {
        metaDoc = await db.get('metadata');
      } catch (err: any) {
        if (err.name === 'not_found') {
          metaDoc = { _id: 'metadata' };
        } else {
          throw err;
        }
      }

      // Update the metadata
      metaDoc.lastFetch = now.toISOString();
      await db.put(metaDoc);

      // Update the ref
      if (type === 'history') {
        lastHistoryFetch.value = now;
      } else {
        lastPricesFetch.value = now;
      }

      console.log(`[${getTimestamp()}] Updated ${type} metadata: last fetch at ${now.toISOString()}`);
    }
  } catch (error) {
    console.error(`[${getTimestamp()}] Error updating ${type} metadata:`, error);
  }
}

/**
 * Check if history data needs to be refreshed
 * @returns boolean indicating if history data should be refreshed
 */
export function shouldRefreshHistory(): boolean {
  // If no last fetch or not fetched today, we should refresh
  return !lastHistoryFetch.value || !isToday(lastHistoryFetch.value);
}

/**
 * Check if current prices need to be refreshed
 * @returns boolean indicating if current prices should be refreshed
 */
export function shouldRefreshPrices(): boolean {
  // If no last fetch or older than CURRENT_PRICES_REFRESH_MINUTES, we should refresh
  return !lastPricesFetch.value ||
         isOlderThanMinutes(lastPricesFetch.value, CURRENT_PRICES_REFRESH_MINUTES);
}

/**
 * Store data in PouchDB with proper metadata
 * @param db The PouchDB instance
 * @param data The data to store
 * @param type The type of data ('history' or 'prices')
 */
export async function storeDataInPouchDB(db: PouchDBDatabase, data: any[], type: 'history' | 'prices') {
  if (!db || !Array.isArray(data)) {
    return;
  }

  try {
    // Generate a batch ID for this set of records
    const batchId = `batch_${Date.now()}`;

    // Store each record with the batch ID
    for (const record of data) {
      const docId = `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await db.put({
        _id: docId,
        batchId,
        type,
        timestamp: new Date().toISOString(),
        ...record
      });
    }

    // Update metadata
    await updateCacheMetadata(type);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error storing ${type} data in PouchDB:`, error);
  }
}

/**
 * Retrieve all data from a PouchDB database
 * @param db The PouchDB instance
 * @returns Array of documents (excluding metadata)
 */
export async function getAllFromPouchDB(db: PouchDBDatabase): Promise<any[]> {
  if (!db) {
    return [];
  }

  try {
    const result = await db.allDocs({ include_docs: true });

    // Filter out metadata document and map to just the document content
    return result.rows
      .filter((row: any) => row.id !== 'metadata')
      .map((row: any) => row.doc);
  } catch (error) {
    console.error(`[${getTimestamp()}] Error retrieving data from PouchDB:`, error);
    return [];
  }
}
