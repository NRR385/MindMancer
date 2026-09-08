import mongoose from 'mongoose';
import { config } from './env';

/**
 * Sanitizes MongoDB connection URIs by redacting passwords.
 * e.g. mongodb://user:secret@localhost:27017/db -> mongodb://***:***@localhost:27017/db
 */
export function sanitizeMongoUri(uri: string): string {
  return uri.replace(/\/\/[^@]+@/, '//***:***@');
}

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || config.mongoUri;
  const sanitized = sanitizeMongoUri(targetUri);

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      heartbeatFrequencyMS: 10000,
    });

    console.log(`[Database] Connected to MongoDB at ${sanitized}`);
    return conn;
  } catch (error: any) {
    console.error(`[Database] MongoDB connection error to ${sanitized}:`, error.message);
    throw error;
  }
}

// Attach connection event listeners once
if (mongoose.connection) {
  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[Database] MongoDB connection reconnected.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err.message);
  });
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB');
  }
}
