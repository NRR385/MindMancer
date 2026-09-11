import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameService } from '../src/game/game.service';
import { sessionManager } from '../src/game/session.manager';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { retrainQueue } from '../src/services/retrain-queue.service';

describe('Phase 6: Feature Teaching & Resolution Unit Tests', () => {
  let gameService: GameService;
  let sessionId: string;

  beforeEach(() => {
    sessionManager.clearAll();
    gameService = new GameService();
    vi.restoreAllMocks();

    const session = sessionManager.createSession([], null, 'GUESSED', {
      name: 'Batman',
      score: 0.9,
      reason: 'DOMINANT_THRESHOLD',
    });
    sessionId = session.sessionId;

    vi.spyOn(retrainQueue, 'enqueue').mockResolvedValue({
      success: true,
      status: 'trained',
      character_count: 13,
      feature_count: 17,
      tree_depth: 4,
      leaf_count: 13,
      trained_at: new Date().toISOString(),
    });

    vi.spyOn(Character.prototype, 'save').mockImplementation(function (this: any) {
      return Promise.resolve(this);
    });
  });

  it('TC-FEAT-01: Teaching with an existing valid featureKey links the trait without creating a duplicate Feature document', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'can_fly',
      question: 'Can your character fly?',
      category: 'abilities',
    } as any);

    const featureCreateSpy = vi.spyOn(Feature, 'create');
    vi.spyOn(Character, 'findOne').mockResolvedValue(null);

    const res = await gameService.teachSession(sessionId, {
      characterName: 'Superman',
      featureKey: 'can_fly',
      traitValue: true,
    });

    expect(res.success).toBe(true);
    expect(res.feature.key).toBe('can_fly');
    expect(res.feature.isNew).toBe(false);
    expect(featureCreateSpy).not.toHaveBeenCalled();
  });

  it('TC-FEAT-02: Teaching with a new valid question generates a normalized slug and creates a Feature document in MongoDB', async () => {
    // Feature does not exist yet
    vi.spyOn(Feature, 'findOne').mockResolvedValue(null);
    vi.spyOn(Character, 'findOne').mockResolvedValue(null);

    const createdDocs: any[] = [];
    vi.spyOn(Feature, 'create').mockImplementation(function (doc: any) {
      createdDocs.push(doc);
      return Promise.resolve({ ...doc, _id: 'mock-feat-id' } as any);
    });

    const res = await gameService.teachSession(sessionId, {
      characterName: 'Black Widow',
      featureQuestion: 'Is this character an elite martial artist and master spy?',
      featureCategory: 'skills',
      traitValue: true,
    });

    expect(res.success).toBe(true);
    expect(res.feature.isNew).toBe(true);
    expect(res.feature.key).toBe('is_elite_martial_artist_and_master_spy');
    expect(res.feature.category).toBe('skills');
    expect(createdDocs.length).toBe(1);
    expect(createdDocs[0].key).toBe('is_elite_martial_artist_and_master_spy');
  });

  it('TC-FEAT-03: Teaching with a question without a trailing ? returns HTTP 400 Bad Request', async () => {
    await expect(
      gameService.teachSession(sessionId, {
        characterName: 'Black Widow',
        featureQuestion: 'Is this character an elite martial artist',
        traitValue: true,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('must end with a question mark (?)'),
    });
  });

  it('TC-FEAT-04: Teaching with a question shorter than 10 characters or longer than 120 characters returns HTTP 400 Bad Request', async () => {
    await expect(
      gameService.teachSession(sessionId, {
        characterName: 'Black Widow',
        featureQuestion: 'Hero?',
        traitValue: true,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('between 10 and 120 characters'),
    });

    const tooLong = 'A'.repeat(125) + '?';
    await expect(
      gameService.teachSession(sessionId, {
        characterName: 'Black Widow',
        featureQuestion: tooLong,
        traitValue: true,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('between 10 and 120 characters'),
    });
  });

  it('TC-FEAT-05: Submitting an existing featureKey with a different question returns HTTP 409 Conflict (semantic redefinition blocked)', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'can_fly',
      question: 'Can your character fly?',
      category: 'abilities',
    } as any);

    await expect(
      gameService.teachSession(sessionId, {
        characterName: 'Superman',
        featureKey: 'can_fly',
        featureQuestion: 'Is this character rich?', // Redefining semantic meaning
        traitValue: true,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Cannot redefine authoritative question semantics'),
    });
  });

  it('TC-FEAT-06: Multiple characters taught with the same new question share the single created Feature document without duplication', async () => {
    // First invocation creates feature, second finds existing by question
    const questionText = 'Does this character wield adamantium claws?';
    vi.spyOn(Character, 'findOne').mockResolvedValue(null);

    let existingDoc: any = null;
    vi.spyOn(Feature, 'findOne').mockImplementation((query: any) => {
      if (query.question === questionText && existingDoc) {
        return Promise.resolve(existingDoc);
      }
      return Promise.resolve(null);
    });

    vi.spyOn(Feature, 'create').mockImplementation((doc: any) => {
      existingDoc = { ...doc, _id: 'feat-id-123' };
      return Promise.resolve(existingDoc);
    });

    // 1st teaching
    const res1 = await gameService.teachSession(sessionId, {
      characterName: 'Wolverine',
      featureQuestion: questionText,
      traitValue: true,
    });
    expect(res1.feature.isNew).toBe(true);

    // Setup another terminal session for 2nd teaching
    const s2 = sessionManager.createSession([], null, 'GUESSED');
    const res2 = await gameService.teachSession(s2.sessionId, {
      characterName: 'X-23',
      featureQuestion: questionText,
      traitValue: true,
    });

    expect(res2.feature.isNew).toBe(false);
    expect(res2.feature.key).toBe(res1.feature.key);
  });
});
