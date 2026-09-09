import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { app } from '../src/app';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { sessionManager } from '../src/game/session.manager';

describe('Game API Endpoints Integration Tests (Native HTTP)', () => {
  let server: http.Server;
  let baseUrl: string;

  const mockFeatures = [
    { key: 'can_fly', question: 'Can your character fly?', category: 'abilities' },
    { key: 'wears_cape', question: 'Does your character wear a cape?', category: 'appearance' },
    { key: 'is_human', question: 'Is your character human?', category: 'biology' },
  ];

  const mockCharacters = [
    {
      name: 'Superman',
      playCount: 10,
      traits: new Map([
        ['can_fly', true],
        ['wears_cape', true],
        ['is_human', false],
      ]),
    },
    {
      name: 'Batman',
      playCount: 15,
      traits: new Map([
        ['can_fly', false],
        ['wears_cape', true],
        ['is_human', true],
      ]),
    },
  ];

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr: any = server.address();
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

  beforeEach(() => {
    sessionManager.clearAll();
    vi.restoreAllMocks();
  });

  it('POST /api/game/start creates session and returns first question', async () => {
    vi.spyOn(Character, 'find').mockResolvedValue(mockCharacters as any);
    vi.spyOn(Feature, 'find').mockResolvedValue(mockFeatures as any);

    const res = await fetch(`${baseUrl}/api/game/start`, { method: 'POST' });
    const data: any = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessionId).toBeDefined();
    expect(data.status).toBe('ACTIVE');
    expect(data.question).toBeDefined();
    expect(data.question.text).toBeDefined();
  });

  it('POST /api/game/answer updates evidence and advances game', async () => {
    vi.spyOn(Character, 'find').mockResolvedValue(mockCharacters as any);
    vi.spyOn(Feature, 'find').mockResolvedValue(mockFeatures as any);

    const startRes = await fetch(`${baseUrl}/api/game/start`, { method: 'POST' });
    const startData: any = await startRes.json();
    const sessionId = startData.sessionId;

    const answerRes = await fetch(`${baseUrl}/api/game/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answer: 'YES' }),
    });
    const answerData: any = await answerRes.json();

    expect(answerRes.status).toBe(200);
    expect(answerData.sessionId).toBe(sessionId);
    expect(answerData.questionCount).toBe(1);
  });

  it('GET /api/game/guess/:sessionId returns relative scores without fake confidence', async () => {
    vi.spyOn(Character, 'find').mockResolvedValue(mockCharacters as any);
    vi.spyOn(Feature, 'find').mockResolvedValue(mockFeatures as any);

    const startRes = await fetch(`${baseUrl}/api/game/start`, { method: 'POST' });
    const startData: any = await startRes.json();
    const sessionId = startData.sessionId;

    const guessRes = await fetch(`${baseUrl}/api/game/guess/${sessionId}`);
    const guessData: any = await guessRes.json();

    expect(guessRes.status).toBe(200);
    expect(guessData.sessionId).toBe(sessionId);
    expect(guessData.topCandidates).toBeInstanceOf(Array);
    expect(guessData.topCandidates.length).toBeGreaterThan(0);
    expect(guessData.topCandidates[0].relativeScore).toBeDefined();
  });

  it('POST /api/game/teach/:sessionId transitions session to TEACHING mode', async () => {
    vi.spyOn(Character, 'find').mockResolvedValue(mockCharacters as any);
    vi.spyOn(Feature, 'find').mockResolvedValue(mockFeatures as any);

    const startRes = await fetch(`${baseUrl}/api/game/start`, { method: 'POST' });
    const startData: any = await startRes.json();
    const sessionId = startData.sessionId;

    const teachRes = await fetch(`${baseUrl}/api/game/teach/${sessionId}`, { method: 'POST' });
    const teachData: any = await teachRes.json();

    expect(teachRes.status).toBe(200);
    expect(teachData.status).toBe('TEACHING');
  });

  it('POST /api/game/answer returns 400 for invalid answer', async () => {
    vi.spyOn(Character, 'find').mockResolvedValue(mockCharacters as any);
    vi.spyOn(Feature, 'find').mockResolvedValue(mockFeatures as any);

    const startRes = await fetch(`${baseUrl}/api/game/start`, { method: 'POST' });
    const startData: any = await startRes.json();
    const sessionId = startData.sessionId;

    const res = await fetch(`${baseUrl}/api/game/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answer: 'NOT_A_VALID_ANSWER' }),
    });
    const data: any = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.message).toContain('Invalid answer');
  });

  it('POST /api/game/answer returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/game/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'non-existent-session-id', answer: 'YES' }),
    });
    const data: any = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.message).toContain('not found or has expired');
  });
});
