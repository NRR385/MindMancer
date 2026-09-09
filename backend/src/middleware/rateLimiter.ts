import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

interface RateLimitRecord {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private clients: Map<string, RateLimitRecord> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxRequests: number, windowMs: number = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic cleanup of stale client IPs every 2 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // If rate limiting is disabled, bypass immediately
      if (!config.rateLimitEnabled) {
        next();
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const cutoff = now - this.windowMs;

      let record = this.clients.get(clientIp);
      if (!record) {
        record = { timestamps: [] };
        this.clients.set(clientIp, record);
      }

      // Filter out timestamps older than the window
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

      if (record.timestamps.length >= this.maxRequests) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please wait before trying again.',
          },
        });
        return;
      }

      record.timestamps.push(now);
      next();
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [ip, record] of this.clients.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        this.clients.delete(ip);
      }
    }
  }

  public reset(): void {
    this.clients.clear();
  }

  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// 30 starts per minute per IP
export const startGameRateLimiter = new InMemoryRateLimiter(30, 60 * 1000);

// 10 teaches per minute per IP
export const teachGameRateLimiter = new InMemoryRateLimiter(10, 60 * 1000);
