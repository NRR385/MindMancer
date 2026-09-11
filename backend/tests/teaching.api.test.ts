import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { app } from '../src/app';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { sessionManager } from '../src/game/session.manager';
import { retrainQueue } from '../src/services/retrain-queue.service';
import { mlClientService } from '../src/services/ml-client.service';

describe('Phase 6: Teaching API Endpoints Integration Tests (Native HTTP)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
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

  async function postJson(endpoint: string, body?: any): Promise<{ status: number; data: any }> {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  it('TC-API-01: Valid teaching request on a guessed session returns 200 OK with full metadata', async () => {
    const session = sessionManager.createSession([], null, 'GUESSED', {
      name: 'Iron Man',
      score: 0.9,
      reason: 'DOMINANT_THRESHOLD',
    });

    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'uses_technology',
      question: 'Does your character rely on technology?',
      category: 'equipment',
    } as any);

    vi.spyOn(Character, 'findOne').mockResolvedValue(null);
    vi.spyOn(Character.prototype, 'save').mockImplementation(function (this: any) {
      return Promise.resolve(this);
    });

    vi.spyOn(retrainQueue, 'enqueue').mockResolvedValueOnce({
      success: true,
      status: 'trained',
      character_count: 13,
      feature_count: 16,
      tree_depth: 4,
      leaf_count: 13,
      trained_at: '2026-09-04T10:30:00Z',
    });

    const res = await postJson(`/api/game/teach/${session.sessionId}`, {
      characterName: 'Captain America',
      featureKey: 'uses_technology',
      traitValue: false,
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.status).toBe('COMPLETED_TEACHING');
    expect(res.data.character.name).toBe('Captain America');
    expect(res.data.character.isNew).toBe(true);
    expect(res.data.model.retrained).toBe(true);
    expect(res.data.model.characterCount).toBe(13);
  });

  it('TC-API-02: Teaching request with missing/invalid sessionId returns 404 Not Found', async () => {
    const res = await postJson('/api/game/teach/non-existent-session-1234', {
      characterName: 'Thor',
      featureKey: 'can_fly',
      traitValue: true,
    });

    expect(res.status).toBe(404);
    expect(res.data.error.message).toContain('not found or expired');
  });

  it('TC-API-03: Teaching request on an active (in-progress) session returns 422 Unprocessable Entity', async () => {
    const session = sessionManager.createSession([], 'can_fly', 'ACTIVE');

    const res = await postJson(`/api/game/teach/${session.sessionId}`, {
      characterName: 'Thor',
      featureKey: 'can_fly',
      traitValue: true,
    });

    expect(res.status).toBe(422);
    expect(res.data.error.message).toContain('Cannot teach an active game session');
  });

  it('TC-API-04: Re-teaching an already taught session returns 422 Unprocessable Entity', async () => {
    const session = sessionManager.createSession([], null, 'COMPLETED_TEACHING');

    const res = await postJson(`/api/game/teach/${session.sessionId}`, {
      characterName: 'Thor',
      featureKey: 'can_fly',
      traitValue: true,
    });

    expect(res.status).toBe(422);
    expect(res.data.error.message).toContain('already completed teaching handoff');
  });

  it('TC-API-05: Retraining queue is serialized (two retrains cannot execute concurrently)', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    vi.spyOn(mlClientService, 'triggerRetrain').mockImplementation(async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      await new Promise((r) => setTimeout(r, 20));
      concurrentCalls--;
      return {
        success: true,
        status: 'trained',
        character_count: 14,
        feature_count: 17,
        trained_at: new Date().toISOString(),
      };
    });

    // Enqueue two concurrent retraining jobs
    const job1 = retrainQueue.enqueue();
    const job2 = retrainQueue.enqueue();

    await Promise.all([job1, job2]);

    expect(maxConcurrent).toBe(1);
  });

  it('TC-API-06: Compensating rollback removes newly created feature if character creation fails on standalone DB', async () => {
    const session = sessionManager.createSession([], null, 'GUESSED');

    vi.spyOn(Feature, 'findOne').mockResolvedValue(null);
    const featureDeleteSpy = vi.spyOn(Feature, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);

    vi.spyOn(Feature, 'create').mockResolvedValue({
      _id: 'new-feat-id-to-rollback',
      key: 'wields_mjolnir',
      question: 'Does your character wield Mjolnir?',
      category: 'equipment',
    } as any);

    vi.spyOn(Character, 'findOne').mockResolvedValue(null);
    vi.spyOn(Character.prototype, 'save').mockRejectedValueOnce(new Error('Simulated DB Character Write Error'));

    const res = await postJson(`/api/game/teach/${session.sessionId}`, {
      characterName: 'Thor',
      featureQuestion: 'Does your character wield Mjolnir?',
      featureCategory: 'equipment',
      traitValue: true,
    });

    expect(res.status).toBe(500);
    expect(featureDeleteSpy).toHaveBeenCalledWith({ _id: 'new-feat-id-to-rollback' });
  });

  it('TC-API-07: MongoDB knowledge remains persisted if Python is unavailable, and response reports retraining pending/failed without false durability claims', async () => {
    const session = sessionManager.createSession([], null, 'GUESSED');

    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'can_fly',
      question: 'Can fly?',
      category: 'abilities',
    } as any);

    vi.spyOn(Character, 'findOne').mockResolvedValue(null);
    vi.spyOn(Character.prototype, 'save').mockImplementation(function (this: any) {
      return Promise.resolve(this);
    });

    // Python ML offline / throws
    vi.spyOn(retrainQueue, 'enqueue').mockResolvedValueOnce(null);

    const res = await postJson(`/api/game/teach/${session.sessionId}`, {
      characterName: 'Falcon',
      featureKey: 'can_fly',
      traitValue: true,
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.character.name).toBe('Falcon');
    expect(res.data.model.retrained).toBe(false);
    expect(res.data.model.status).toBe('RETRAINING_PENDING_OR_FAILED');
    expect(res.data.model.warning).toContain('ML model retraining failed or timed out');
  });
});
