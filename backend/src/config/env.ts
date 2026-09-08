import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root or workspace root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  mlServiceUrl: string;
  guessMinScore: number;
  guessMinMargin: number;
  maxQuestions: number;
  corsOrigin: string;
  sessionMaxCount: number;
  rateLimitEnabled: boolean;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mindmancer',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  guessMinScore: parseFloat(process.env.GUESS_MIN_SCORE || '0.65'),
  guessMinMargin: parseFloat(process.env.GUESS_MIN_MARGIN || '0.30'),
  maxQuestions: parseInt(process.env.MAX_QUESTIONS || '20', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  sessionMaxCount: parseInt(process.env.SESSION_MAX_COUNT || '5000', 10),
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
};
