import { app } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';

async function startServer(): Promise<void> {
  try {
    // Attempt database connection on startup
    await connectDatabase().catch((err) => {
      console.warn(`[Server] Initial database connection failed: ${err.message}. Server will start in degraded mode.`);
    });

    const server = app.listen(config.port, () => {
      console.log(`[Server] Mind-Mancer API Gateway running on port ${config.port} (${config.nodeEnv})`);
      console.log(`[Server] ML Microservice URL: ${config.mlServiceUrl}`);
      console.log(`[Server] Health Endpoint: http://localhost:${config.port}/api/health`);
      console.log(`[Server] Readiness Endpoint: http://localhost:${config.port}/api/health/ready`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await disconnectDatabase();
        } catch (dbErr: any) {
          console.error('[Server] Error during database disconnection:', dbErr.message);
        }
        process.exit(0);
      });

      // Force exit if shutdown hangs beyond 10 seconds
      setTimeout(() => {
        console.error('[Server] Graceful shutdown timed out. Forcing process termination.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { startServer };
