import crypto from 'crypto';
import { IGameSession, ICandidateState, GameStatus } from './game.types';
import { config } from '../config/env';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SessionManager {
  private sessions: Map<string, IGameSession> = new Map();
  private readonly ttlMs: number = 30 * 60 * 1000; // 30 minutes TTL
  private readonly maxCapacity: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(ttlMs?: number, sweepIntervalMs?: number, maxCapacity?: number) {
    if (ttlMs) this.ttlMs = ttlMs;
    this.maxCapacity = maxCapacity || config.sessionMaxCount || 5000;
    const interval = sweepIntervalMs || 5 * 60 * 1000; // 5 minutes sweep

    // Periodic sweep of expired sessions
    this.cleanupTimer = setInterval(() => {
      this.sweepExpired();
    }, interval);

    // Allow process to exit cleanly during tests or shutdown
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Generates a secure random session ID and initializes session state.
   * Enforces capacity bound by sweeping expired sessions or evicting oldest inactive.
   */
  public createSession(
    candidates: ICandidateState[],
    initialFeatureKey: string | null = null,
    initialStatus: GameStatus = 'ACTIVE',
    initialGuess: { name: string; score: number; reason: any } | null = null,
    terminalReason?: any
  ): IGameSession {
    // Check if at capacity; attempt cleanup then evict oldest if needed
    if (this.sessions.size >= this.maxCapacity) {
      this.sweepExpired();

      if (this.sessions.size >= this.maxCapacity) {
        this.evictOldest();
      }
    }

    const sessionId = crypto.randomUUID();
    const now = new Date();

    const session: IGameSession = {
      sessionId,
      candidates,
      askedFeatures: [],
      questionCount: 0,
      currentFeatureKey: initialFeatureKey,
      status: initialStatus,
      terminalReason,
      bestGuess: initialGuess,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Evicts the oldest inactive session (lowest updatedAt timestamp).
   */
  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, s] of this.sessions.entries()) {
      const time = s.updatedAt.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.sessions.delete(oldestId);
      console.warn(`[SessionManager] Maximum capacity (${this.maxCapacity}) reached. Evicted oldest session ${oldestId}.`);
    }
  }

  /**
   * Retrieves an active session, checking TTL expiry and UUID format.
   */
  public getSession(sessionId: string): IGameSession | null {
    if (!sessionId || !UUID_V4_REGEX.test(sessionId.trim())) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const now = Date.now();
    const age = now - session.updatedAt.getTime();

    if (age > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Updates existing session state with timestamp refresh.
   */
  public updateSession(sessionId: string, updates: Partial<IGameSession>): IGameSession {
    const existing = this.getSession(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found or expired.`);
    }

    const updatedSession: IGameSession = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Explicitly deletes a session.
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Sweeps and removes sessions older than the TTL.
   */
  public sweepExpired(nowTimeMs?: number): number {
    const now = nowTimeMs || Date.now();
    let expiredCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > this.ttlMs) {
        this.sessions.delete(id);
        expiredCount++;
      }
    }

    return expiredCount;
  }

  /**
   * Helper for tests: clears all sessions.
   */
  public clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Cleanly disposes the background interval timer.
   */
  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  public get activeCount(): number {
    return this.sessions.size;
  }
}

export const sessionManager = new SessionManager();
