import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameService } from '../src/game/game.service';
import { sessionManager } from '../src/game/session.manager';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { retrainQueue } from '../src/services/retrain-queue.service';

describe('Phase 6: Character Teaching & Resolution Unit Tests', () => {
  let gameService: GameService;
  let sessionId: string;

  beforeEach(() => {
    sessionManager.clearAll();
    gameService = new GameService();
    vi.restoreAllMocks();

    // Setup an initial terminal session ready for teaching
    const session = sessionManager.createSession([], null, 'GUESSED', {
      name: 'Spider-Man',
      score: 0.95,
      reason: 'DOMINANT_THRESHOLD',
    });
    sessionId = session.sessionId;

    // Default mock for ML retraining
    vi.spyOn(retrainQueue, 'enqueue').mockResolvedValue({
      success: true,
      status: 'trained',
      character_count: 13,
      feature_count: 17,
      tree_depth: 4,
      leaf_count: 13,
      trained_at: new Date().toISOString(),
    });
  });

  it('TC-CHAR-01: Teaching a completely new character creates a document with playCount = 0 and specified trait', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'has_superpowers',
      question: 'Does your character possess superpowers?',
      category: 'abilities',
    } as any);

    vi.spyOn(Character, 'findOne').mockResolvedValue(null);

    let savedCharDoc: any = null;
    vi.spyOn(Character.prototype, 'save').mockImplementation(function (this: any) {
      savedCharDoc = this;
      return Promise.resolve(this);
    });

    const response = await gameService.teachSession(sessionId, {
      characterName: 'Black Widow',
      featureKey: 'has_superpowers',
      traitValue: false,
    });

    expect(response.success).toBe(true);
    expect(response.character.name).toBe('Black Widow');
    expect(response.character.isNew).toBe(true);
    expect(response.character.playCount).toBe(0);
    expect(response.character.taughtTrait).toEqual({
      featureKey: 'has_superpowers',
      value: false,
    });

    expect(savedCharDoc).not.toBeNull();
    expect(savedCharDoc.name).toBe('Black Widow');
    expect(savedCharDoc.playCount).toBe(0);
    expect(savedCharDoc.traits.get('has_superpowers')).toBe(false);
  });

  it('TC-CHAR-02: Teaching an existing character with a new feature enriches their traits map without altering existing traits', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'is_acrobatic',
      question: 'Is your character highly acrobatic?',
      category: 'skills',
    } as any);

    const existingChar = new Character({
      name: 'Spider-Man',
      playCount: 15,
      traits: new Map([['can_fly', false]]),
    });

    vi.spyOn(Character, 'findOne').mockResolvedValue(existingChar);
    const saveSpy = vi.spyOn(existingChar, 'save').mockResolvedValue(existingChar);

    const response = await gameService.teachSession(sessionId, {
      characterName: 'Spider-Man',
      featureKey: 'is_acrobatic',
      traitValue: true,
    });

    expect(response.success).toBe(true);
    expect(response.character.isNew).toBe(false);
    expect(response.character.playCount).toBe(15);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(existingChar.traits.get('can_fly')).toBe(false);
    expect(existingChar.traits.get('is_acrobatic')).toBe(true);
  });

  it('TC-CHAR-03: Teaching an existing character with an already recorded trait of identical value is idempotent and returns 200 OK', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'can_fly',
      question: 'Can your character fly?',
      category: 'abilities',
    } as any);

    const existingChar = new Character({
      name: 'Spider-Man',
      playCount: 15,
      traits: new Map([['can_fly', false]]),
    });

    vi.spyOn(Character, 'findOne').mockResolvedValue(existingChar);
    const saveSpy = vi.spyOn(existingChar, 'save');

    const response = await gameService.teachSession(sessionId, {
      characterName: 'Spider-Man',
      featureKey: 'can_fly',
      traitValue: false,
    });

    expect(response.success).toBe(true);
    expect(response.character.isNew).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(existingChar.traits.get('can_fly')).toBe(false);
  });

  it('TC-CHAR-04: Teaching an existing character with a contradictory trait value returns HTTP 409 Conflict and leaves the document unchanged', async () => {
    vi.spyOn(Feature, 'findOne').mockResolvedValue({
      key: 'can_fly',
      question: 'Can your character fly?',
      category: 'abilities',
    } as any);

    const existingChar = new Character({
      name: 'Spider-Man',
      playCount: 15,
      traits: new Map([['can_fly', false]]),
    });

    vi.spyOn(Character, 'findOne').mockResolvedValue(existingChar);
    const saveSpy = vi.spyOn(existingChar, 'save');

    await expect(
      gameService.teachSession(sessionId, {
        characterName: 'Spider-Man',
        featureKey: 'can_fly',
        traitValue: true, // Contradicts false
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      conflict: {
        character: 'Spider-Man',
        featureKey: 'can_fly',
        existingValue: false,
        submittedValue: true,
      },
    });

    expect(saveSpy).not.toHaveBeenCalled();
    expect(existingChar.traits.get('can_fly')).toBe(false);
  });

  it('TC-CHAR-05: Teaching with whitespace-only or empty character name returns HTTP 400 Bad Request', async () => {
    await expect(
      gameService.teachSession(sessionId, {
        characterName: '   ',
        featureKey: 'can_fly',
        traitValue: false,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Character name must be a non-empty string'),
    });
  });

  it('TC-CHAR-06: Teaching with a character name exceeding 100 characters returns HTTP 400 Bad Request', async () => {
    const longName = 'A'.repeat(101);
    await expect(
      gameService.teachSession(sessionId, {
        characterName: longName,
        featureKey: 'can_fly',
        traitValue: false,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('Character name must be a non-empty string'),
    });
  });
});
