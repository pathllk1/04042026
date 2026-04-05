import mongoose from 'mongoose';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { useRuntimeConfig } from '#imports';
import { registerAllModels } from './register-models';

// Connection options with retry logic
const connectOptions = {
  serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  retryWrites: true,
  retryReads: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 1, // Keep at least 1 socket connection active
};

// Track connection status
let isConnected = false;

export const connectDB = async () => {
  // If already connected, return the existing connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('Using existing MongoDB connection');
    return;
  }

  try {
    // Get MongoDB URI from runtime config
    const config = useRuntimeConfig();
    const mongoUri = config.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MongoDB URI is not configured');
    }

    console.log(`Connecting to MongoDB in ${config.public.nodeEnv} environment...`);

    // Connect with retry options
    await mongoose.connect(mongoUri, connectOptions);

    // Test the connection
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }

    isConnected = true;
    console.log('MongoDB connected successfully');

    // Register all models
    const registeredModels = registerAllModels();
    console.log(`Registered ${registeredModels.length} Mongoose models`);

    // Set up connection error handler
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    // Handle disconnection
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
      isConnected = false;
      // Don't call connectDB here to avoid infinite loops
      // Mongoose will attempt to reconnect automatically
    });

    // Handle reconnection
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
      isConnected = true;
    });

  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnected = false;

    // Don't exit the process on Netlify
    const config = useRuntimeConfig();
    if (config.NETLIFY) {
      console.error('Running on Netlify, not exiting process');
    } else {
      process.exit(1);
    }
  }
};

export default defineNitroPlugin(async (nitroApp) => {
  try {
    await connectDB();

    // Add hook to handle requests when database is disconnected
    nitroApp.hooks.hook('request', async (event) => {
      // Skip for non-API routes
      const path = event.node.req.url;
      if (!path || !path.startsWith('/api/')) return;

      // Skip for authentication routes
      if (path.includes('/api/auth/')) return;

      // If MongoDB is disconnected, try to reconnect
      if (!isConnected || mongoose.connection.readyState !== 1) {
        console.log('Database disconnected, attempting to reconnect...');
        try {
          await connectDB();
        } catch (error) {
          console.error('Failed to reconnect to database:', error);
          // Continue processing the request, the handler will return an error if needed
        }
      }

      // Ensure models are registered for each request
      if (path && path.startsWith('/api/nse/')) {
        console.log(`Ensuring models are registered for NSE API request: ${path}`);
        const modelNames = Object.keys(mongoose.models);
        if (!modelNames.includes('Folio') || !modelNames.includes('CNNote')) {
          console.log('Re-registering models for NSE API request');
          registerAllModels();
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
  }
});