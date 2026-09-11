import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../src/app';
import { sanitizeMongoUri } from '../src/config/database';

describe('Phase 7 Security Hardening Tests', () => {
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

  it('TC-SEC-01: Rejects payload exceeding 64KB with 413 Payload Too Large', async () => {
    // Generate ~70KB payload
    const largeString = 'a'.repeat(70 * 1024);
    const res = await fetch(`${baseUrl}/api/game/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ large: largeString }),
    });

    expect(res.status).toBe(413);
  });

  it('TC-SEC-02: Returns 400 Bad Request with MALFORMED_JSON for invalid JSON syntax', async () => {
    const res = await fetch(`${baseUrl}/api/game/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid_json": true,',
    });

    const data: any = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('MALFORMED_JSON');
    expect(data.error.message).toContain('Malformed JSON payload');
  });

  it('TC-SEC-03: Redacts passwords from MongoDB URIs in logs and diagnostics', () => {
    const rawUri = 'mongodb://app_user:superSecretPassword123@cluster0.mongodb.net:27017/mindmancer';
    const sanitized = sanitizeMongoUri(rawUri);

    expect(sanitized).toBe('mongodb://***:***@cluster0.mongodb.net:27017/mindmancer');
    expect(sanitized).not.toContain('superSecretPassword123');
    expect(sanitized).not.toContain('app_user');
  });

  it('TC-SEC-04: Leaves unauthenticated URIs untouched', () => {
    const rawUri = 'mongodb://127.0.0.1:27017/mindmancer';
    const sanitized = sanitizeMongoUri(rawUri);

    expect(sanitized).toBe('mongodb://127.0.0.1:27017/mindmancer');
  });
});
