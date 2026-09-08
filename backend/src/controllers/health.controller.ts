import { Request, Response } from 'express';
import { isDatabaseConnected } from '../config/database';
import { config } from '../config/env';
import { sessionManager } from '../game/session.manager';

/**
 * LIVENESS PROBE: GET /api/health
 * Fast, lightweight check to verify the Node process is alive and event-loop responsive.
 * Does NOT perform database queries or outbound network requests.
 */
export function getHealth(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    alive: true,
    service: 'backend',
    uptime: Math.floor(process.uptime()),
    mlService: {
      url: config.mlServiceUrl,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * READINESS PROBE: GET /api/health/ready
 * Verifies that all dependencies required for actual gameplay are ready:
 * 1. MongoDB connectivity
 * 2. Python ML service reachability
 * 3. ML model availability (modelLoaded === true)
 */
export async function getReadiness(req: Request, res: Response): Promise<void> {
  const t0 = performance.now();
  const dbConnected = isDatabaseConnected();
  const dbLatencyMs = parseFloat((performance.now() - t0).toFixed(2));

  let mlStatus = 'unreachable';
  let mlData: any = null;
  let mlReady = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${config.mlServiceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      mlData = await response.json();
      mlStatus = 'connected';
      mlReady = mlData?.modelLoaded === true;
    }
  } catch {
    mlStatus = 'unreachable';
  }

  const isReady = dbConnected && mlReady;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    ready: isReady,
    checks: {
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
        latencyMs: dbLatencyMs,
      },
      mlService: {
        status: mlStatus,
        modelLoaded: mlData?.modelLoaded ?? false,
        characterCount: mlData?.characterCount ?? 0,
        featureCount: mlData?.featureCount ?? 0,
        modelVersion: mlData?.modelVersion ?? null,
      },
      sessions: {
        activeCount: sessionManager.activeCount,
        maxCapacity: config.sessionMaxCount,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
