import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SessionManager } from '../src/game/session.manager';
import { ICandidateState } from '../src/game/game.types';

describe('SessionManager Unit Tests', () => {
  let sessionManager: SessionManager;

  const mockCandidates: ICandidateState[] = [
    { name: 'Batman', score: 0.5, playCount: 10, traits: { wears_cape: true } },
    { name: 'Superman', score: 0.5, playCount: 5, traits: { wears_cape: true } },
  ];

  beforeEach(() => {
    sessionManager = new SessionManager(500, 100); // 500ms TTL for testing
  });

  afterAll(() => {
    sessionManager.stopCleanup();
  });

  it('1. creates a unique session with a valid UUID', () => {
    const s1 = sessionManager.createSession(mockCandidates, 'wears_cape');
    const s2 = sessionManager.createSession(mockCandidates, 'wears_cape');

    expect(s1.sessionId).toBeDefined();
    expect(s2.sessionId).toBeDefined();
    expect(s1.sessionId).not.toBe(s2.sessionId);
    expect(s1.status).toBe('ACTIVE');
    expect(s1.currentFeatureKey).toBe('wears_cape');
  });

  it('2. initializes equal candidate scores', () => {
    const s = sessionManager.createSession(mockCandidates, 'wears_cape');
    expect(s.candidates[0].score).toBe(0.5);
    expect(s.candidates[1].score).toBe(0.5);
    expect(s.questionCount).toBe(0);
  });

  it('3. isolates two sessions completely', () => {
    const s1 = sessionManager.createSession([...mockCandidates], 'feat_1');
    const s2 = sessionManager.createSession([...mockCandidates], 'feat_2');

    sessionManager.updateSession(s1.sessionId, {
      questionCount: 3,
      status: 'GUESSED',
    });

    const refreshedS1 = sessionManager.getSession(s1.sessionId);
    const refreshedS2 = sessionManager.getSession(s2.sessionId);

    expect(refreshedS1?.questionCount).toBe(3);
    expect(refreshedS1?.status).toBe('GUESSED');

    // S2 must be completely unchanged
    expect(refreshedS2?.questionCount).toBe(0);
    expect(refreshedS2?.status).toBe('ACTIVE');
  });

  it('4. expires sessions after TTL', async () => {
    const s = sessionManager.createSession(mockCandidates, 'feat_1');
    expect(sessionManager.getSession(s.sessionId)).not.toBeNull();

    // Fast-forward or wait beyond 500ms TTL
    await new Promise((resolve) => setTimeout(resolve, 550));

    expect(sessionManager.getSession(s.sessionId)).toBeNull();
  });

  it('5. returns null and rejects unknown session', () => {
    expect(sessionManager.getSession('non-existent-uuid-1234')).toBeNull();
  });
});
