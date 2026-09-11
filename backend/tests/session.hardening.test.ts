import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../src/game/session.manager';
import { InMemoryRateLimiter } from '../src/middleware/rateLimiter';
import { config } from '../src/config/env';

describe('Phase 7 Session Hardening & Rate Limiting Tests', () => {
  describe('Session Capacity & Eviction', () => {
    let sm: SessionManager;

    beforeEach(() => {
      // Create SessionManager with tiny capacity for testing
      sm = new SessionManager(30 * 60 * 1000, 5 * 60 * 1000, 3);
    });

    afterEach(() => {
      sm.stopCleanup();
    });

    it('TC-SES-01: Maintains session count within maxCapacity by evicting oldest session', () => {
      // Create 3 sessions with distinct updated timestamps
      const s1 = sm.createSession([], null);
      const s2 = sm.createSession([], null);
      const s3 = sm.createSession([], null);

      expect(sm.activeCount).toBe(3);

      // Artificially age s1 so it is strictly the oldest
      (s1 as any).updatedAt = new Date(Date.now() - 10000);
      (s2 as any).updatedAt = new Date(Date.now() - 5000);
      (s3 as any).updatedAt = new Date(Date.now());

      // Creating a 4th session must evict s1 (the oldest inactive)
      const s4 = sm.createSession([], null);

      expect(sm.activeCount).toBe(3);
      expect(sm.getSession(s1.sessionId)).toBeNull(); // s1 evicted
      expect(sm.getSession(s2.sessionId)).not.toBeNull();
      expect(sm.getSession(s3.sessionId)).not.toBeNull();
      expect(sm.getSession(s4.sessionId)).not.toBeNull();
    });
  });

  describe('In-Memory Rate Limiter', () => {
    let limiter: InMemoryRateLimiter;

    beforeEach(() => {
      limiter = new InMemoryRateLimiter(2, 60 * 1000); // 2 requests per minute limit
      config.rateLimitEnabled = true;
    });

    afterEach(() => {
      limiter.stop();
      config.rateLimitEnabled = false;
    });

    it('TC-RAT-01: Allows requests up to maxRequests, then rejects with 429 RATE_LIMIT_EXCEEDED', () => {
      const middleware = limiter.middleware();
      const mockReq = { ip: '127.0.0.1', socket: {} } as any;

      let statusReceived = 200;
      let jsonReceived: any = null;
      const mockRes = {
        status: (s: number) => {
          statusReceived = s;
          return {
            json: (j: any) => {
              jsonReceived = j;
            },
          };
        },
      } as any;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      // Request 1: allowed
      nextCalled = false;
      middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);

      // Request 2: allowed
      nextCalled = false;
      middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(true);

      // Request 3: rejected with 429
      nextCalled = false;
      middleware(mockReq, mockRes, next);
      expect(nextCalled).toBe(false);
      expect(statusReceived).toBe(429);
      expect(jsonReceived.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
