import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../src/api/api-client';

describe('Phase 7 Frontend Hardening Tests', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient('http://127.0.0.1:3000');
    vi.restoreAllMocks();
  });

  it('TC-FE-HARD-01: Handles non-JSON HTTP error response (HTML error page) gracefully', async () => {
    // Simulate reverse proxy returning 502 Bad Gateway HTML
    const htmlResponse = '<html><body>502 Bad Gateway</body></html>';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(htmlResponse, {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'text/html' },
      })
    );

    await expect(client.startGame()).rejects.toThrow(
      /Server returned status 502/
    );
  });

  it('TC-FE-HARD-02: Handles network disconnection with friendly error message', async () => {
    const fetchError = new TypeError('Failed to fetch');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(fetchError);

    await expect(client.startGame()).rejects.toThrow(
      /Unable to connect to Mind-Mancer server/
    );
  });

  it('TC-FE-HARD-03: checkReadiness invokes /api/health/ready endpoint', async () => {
    const readyPayload = { status: 'ready', ready: true };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(readyPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await client.checkReadiness();
    expect(result.status).toBe('ready');
    expect(result.ready).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/health/ready',
      expect.anything()
    );
  });

  it('TC-FE-MOUNT-01: initializeApp mounts into #root container without throwing', async () => {
    const { initializeApp } = await import('../src/main');
    document.body.innerHTML = '<div id="root"></div>';
    expect(() => initializeApp()).not.toThrow();
    const rootEl = document.getElementById('root');
    expect(rootEl?.querySelector('.start-container')).not.toBeNull();
  });

  it('TC-FE-MOUNT-02: initializeApp supports fallback to #app container', async () => {
    const { initializeApp } = await import('../src/main');
    document.body.innerHTML = '<div id="app"></div>';
    expect(() => initializeApp()).not.toThrow();
    const appEl = document.getElementById('app');
    expect(appEl?.querySelector('.start-container')).not.toBeNull();
  });

  it('TC-FE-MOUNT-03: initializeApp throws descriptive error when no root container exists', async () => {
    const { initializeApp } = await import('../src/main');
    document.body.innerHTML = '<div id="missing"></div>';
    expect(() => initializeApp()).toThrow(/Root #root container not found in DOM/);
  });
});
