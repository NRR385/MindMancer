import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { getHealth, getReadiness } from './controllers/health.controller';
import { errorHandler } from './middleware/errorHandler';
import { startGameRateLimiter, teachGameRateLimiter } from './middleware/rateLimiter';
import {
  handleStartGame,
  handleAnswerQuestion,
  handleGetGuess,
  handleTeach,
} from './game/game.controller';

export function createApp(): Express {
  const app = express();

  // Strict CORS configuration
  const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || config.corsOrigin === '*' || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy does not allow access from origin ${origin}`));
        }
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Payload size limit (64kb)
  app.use(express.json({ limit: '64kb' }));

  // Liveness & Readiness Probes
  app.get('/api/health', getHealth);
  app.get('/api/health/ready', getReadiness);

  // Game endpoints with rate limiting
  app.post('/api/game/start', startGameRateLimiter.middleware(), handleStartGame);
  app.post('/api/game/answer', handleAnswerQuestion);
  app.get('/api/game/guess/:sessionId', handleGetGuess);
  app.post('/api/game/teach/:sessionId', teachGameRateLimiter.middleware(), handleTeach);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
