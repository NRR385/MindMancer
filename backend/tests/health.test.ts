import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';

describe('Backend Foundation Health Endpoint', () => {
  it('should return health status payload from /api/health', async () => {
    const app = createApp();
    
    // Simulate express request with lightweight node server or direct handler invocation
    const res = await new Promise<{ status: number; body: any }>((resolve) => {
      const server = app.listen(0, async () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          const response = await fetch(`http://127.0.0.1:${port}/api/health`);
          const body = await response.json();
          server.close(() => {
            resolve({ status: response.status, body });
          });
        }
      });
    });

    expect(res.body).toBeDefined();
    expect(res.body.service).toBe('backend');
    expect(['healthy', 'degraded']).toContain(res.body.status);
    expect(res.body.mlService).toBeDefined();
  });
});
