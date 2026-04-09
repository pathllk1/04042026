// Import PouchDB dynamically to avoid SSR issues
let PouchDB: any = null;

// Use a prefix to ensure databases are stored in the browser's IndexedDB storage
const DB_PREFIX = 'nse_app_';

export async function initPouchDB() {
  if (process.client) {
    try {
      // Only import PouchDB on the client side with idb adapter
      const PouchDBModule = await import('pouchdb');
      PouchDB = PouchDBModule.default;

      // Force PouchDB to use IndexedDB in the browser
      if (typeof window !== 'undefined' && window.indexedDB) {
        console.log('Using IndexedDB for PouchDB storage');
      } else {
        console.warn('IndexedDB not available, PouchDB may use file system storage');
      }
    } catch (error) {
      console.error('Failed to initialize PouchDB:', error);
    }
  }
  return PouchDB;
}

export async function createDatabase(name: string) {
  const PouchDBInstance = await initPouchDB();
  if (!PouchDBInstance) return null;

  // Only create database if we're in the browser
  if (typeof window === 'undefined') {
    console.warn('Attempted to create PouchDB outside of browser environment');
    return null;
  }

  try {
    // Use prefixed database name and ensure it's stored in IndexedDB
    const db = new PouchDBInstance(`${DB_PREFIX}${name}`, {
      // Avoid creating folders in the project root
      prefix: ''
    });

    console.log(`Created PouchDB database: ${DB_PREFIX}${name}`);
    return db;
  } catch (error) {
    console.error(`Failed to create PouchDB database ${name}:`, error);
    return null;
  }
}

export async function storeData(db: any, data: any[], idField: string = '_id') {
  if (!db) return;

  for (const item of data) {
    try {
      // Create a unique ID if not present
      const docId = item[idField] || `record_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Remove __v field if present
      const { __v, ...cleanItem } = item;

      // Store the item
      await db.put({
        _id: docId,
        ...cleanItem
      });
    } catch (error) {
      console.warn(`Failed to store item:`, error);
    }
  }
}

export async function getAllData(db: any) {
  if (!db) return [];

  try {
    const result = await db.allDocs({
      include_docs: true
    });

    return result.rows.map(row => row.doc);
  } catch (error) {
    console.error('Error retrieving data from PouchDB:', error);
    return [];
  }
}

export async function destroyDatabase(db: any) {
  if (!db) return;

  try {
    await db.destroy();
  } catch (error) {
    console.error('Error destroying PouchDB database:', error);
  }
}
