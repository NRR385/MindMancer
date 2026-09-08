import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { createApp } from '../src/app';
import * as databaseModule from '../src/config/database';
import { config } from '../src/config/env';

describe('Phase 7 Liveness vs Readiness Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('TC-HLT-01: Liveness GET /api/health returns 200 OK without dependency checks', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data: any = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('backend');
    expect(data.uptime).toBeDefined();
  });

  it('TC-HLT-02: Readiness GET /api/health/ready returns 200 OK when dependencies are ready', async () => {
    vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(true);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options?: any) => {
      if (url.toString().startsWith(config.mlServiceUrl)) {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            modelLoaded: true,
            characterCount: 12,
            featureCount: 16,
            modelVersion: '2.0.0',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, options);
    });

    const res = await fetch(`${baseUrl}/api/health/ready`);
    const data: any = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ready');
    expect(data.ready).toBe(true);
    expect(data.checks.database.status).toBe('connected');
    expect(data.checks.mlService.status).toBe('connected');
    expect(data.checks.mlService.modelLoaded).toBe(true);
  });

  it('TC-HLT-03: Readiness GET /api/health/ready returns 503 when database is disconnected', async () => {
    vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options?: any) => {
      if (url.toString().startsWith(config.mlServiceUrl)) {
        return new Response(
          JSON.stringify({ status: 'healthy', modelLoaded: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, options);
    });

    const res = await fetch(`${baseUrl}/api/health/ready`);
    const data: any = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('not_ready');
    expect(data.ready).toBe(false);
    expect(data.checks.database.status).toBe('disconnected');
  });

  it('TC-HLT-04: Readiness GET /api/health/ready returns 503 when ML model is not loaded', async () => {
    vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(true);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options?: any) => {
      if (url.toString().startsWith(config.mlServiceUrl)) {
        return new Response(
          JSON.stringify({ status: 'degraded', modelLoaded: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, options);
    });

    const res = await fetch(`${baseUrl}/api/health/ready`);
    const data: any = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe('not_ready');
    expect(data.ready).toBe(false);
    expect(data.checks.mlService.modelLoaded).toBe(false);
  });
});
