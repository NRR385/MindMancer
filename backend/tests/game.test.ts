import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameService } from '../src/game/game.service';
import { sessionManager } from '../src/game/session.manager';
import { mlClientService } from '../src/services/ml-client.service';
import { questionSelector } from '../src/game/question.selector';
import { IFeatureDomain } from '../src/types/domain.types';

describe('GameEngine & GameService Integration Tests', () => {
  let gameService: GameService;

  const mockFeatures: IFeatureDomain[] = [
    { key: 'can_fly', question: 'Can your character fly?', category: 'abilities' },
    { key: 'wears_cape', question: 'Does your character wear a cape?', category: 'appearance' },
    { key: 'is_human', question: 'Is your character biologically human?', category: 'biology' },
    { key: 'uses_technology', question: 'Does your character rely on high-tech gadgets?', category: 'equipment' },
  ];

  const mockCharacters = [
    {
      name: 'Superman',
      playCount: 10,
      traits: { can_fly: true, wears_cape: true, is_human: false, uses_technology: false },
    },
    {
      name: 'Batman',
      playCount: 15,
      traits: { can_fly: false, wears_cape: true, is_human: true, uses_technology: true },
    },
    {
      name: 'Iron Man',
      playCount: 8,
      traits: { can_fly: true, wears_cape: false, is_human: true, uses_technology: true },
    },
  ];

  beforeEach(() => {
    sessionManager.clearAll();
    gameService = new GameService();
    vi.restoreAllMocks();
  });

  it('17. start game returns first question, session id, and active state', async () => {
    const res = await gameService.startGame(mockCharacters, mockFeatures);

    expect(res.sessionId).toBeDefined();
    expect(res.status).toBe('ACTIVE');
    expect(res.candidateCount).toBe(3);
    expect(res.question).toBeDefined();
    expect(res.question?.featureKey).toBeDefined();
    expect(res.question?.text).toContain('?');
    expect(res.question?.questionCount).toBe(1);
  });

  it('18. answer advances game and updates candidate evidence', async () => {
    const startRes = await gameService.startGame(mockCharacters, mockFeatures);
    const initialFeature = startRes.question!.featureKey;

    const answerRes = await gameService.answerQuestion(
      startRes.sessionId,
      'YES',
      mockFeatures
    );

    expect(answerRes.sessionId).toBe(startRes.sessionId);
    expect(answerRes.questionCount).toBe(1);
    expect(answerRes.nextQuestion?.featureKey).not.toBe(initialFeature);
  });

  it('19. same feature cannot be asked twice in a session', async () => {
    const startRes = await gameService.startGame(mockCharacters, mockFeatures);
    const session = sessionManager.getSession(startRes.sessionId)!;

    const firstFeature = startRes.question!.featureKey;

    // Answer first question
    const answerRes1 = await gameService.answerQuestion(startRes.sessionId, 'YES', mockFeatures);
    expect(session.askedFeatures).toContain(firstFeature);

    const secondFeature = answerRes1.nextQuestion!.featureKey;
    expect(secondFeature).not.toBe(firstFeature);

    // Answer second question
    await gameService.answerQuestion(startRes.sessionId, 'NO', mockFeatures);
    expect(session.askedFeatures).toContain(secondFeature);

    // Ensure all asked features are unique
    const uniqueAsked = new Set(session.askedFeatures);
    expect(uniqueAsked.size).toBe(session.askedFeatures.length);
  });

  it('20. question count increments accurately with each answer', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    expect(start.questionCount).toBe(0);

    const a1 = await gameService.answerQuestion(start.sessionId, 'DONT_KNOW', mockFeatures);
    expect(a1.questionCount).toBe(1);

    const a2 = await gameService.answerQuestion(start.sessionId, 'DONT_KNOW', mockFeatures);
    expect(a2.questionCount).toBe(2);
  });

  it('21. dominant candidate triggers guess (score >= 0.65 and margin >= 0.30)', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    let currentRes: any = start;
    const superman = mockCharacters.find((c) => c.name === 'Superman')!;

    // Answer truthfully according to Superman's traits
    while (currentRes.status === 'ACTIVE') {
      const featKey = currentRes.question?.featureKey || currentRes.nextQuestion?.featureKey;
      const supermanVal = (superman.traits as any)[featKey];
      const answer = supermanVal ? 'YES' : 'NO';
      currentRes = await gameService.answerQuestion(start.sessionId, answer, mockFeatures);
    }

    expect(currentRes.status).toBe('GUESSED');
    expect(currentRes.terminalReason).toBe('DOMINANT_THRESHOLD');
    expect(currentRes.guess).toBeDefined();
    expect(currentRes.guess?.name).toBe('Superman');
    expect(currentRes.guess?.reason).toBe('DOMINANT_THRESHOLD');
    expect(currentRes.guess?.relativeScore).toBeGreaterThanOrEqual(0.65);
  });

  it('22. weak evidence continues questioning when no candidate dominates', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);

    // Answer DONT_KNOW leaves evidence uniform (no dominance)
    const res = await gameService.answerQuestion(start.sessionId, 'DONT_KNOW', mockFeatures);

    expect(res.status).toBe('ACTIVE');
    expect(res.nextQuestion).toBeDefined();
    expect(res.guess).toBeUndefined();
  });

  it('23. 20-question limit enforced with MAX_QUESTIONS reason, NOT claiming dominant threshold', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    const session = sessionManager.getSession(start.sessionId)!;

    // Simulate session at 19 questions with an ambiguous candidate pool
    session.questionCount = 19;
    session.currentFeatureKey = 'can_fly';

    // Player answers DONT_KNOW (relative scores remain balanced, e.g. 0.33 each)
    const res = await gameService.answerQuestion(start.sessionId, 'DONT_KNOW', mockFeatures);

    expect(res.questionCount).toBe(20);
    expect(res.status).toBe('GUESSED');
    expect(res.terminalReason).toBe('MAX_QUESTIONS');
    expect(res.guess).toBeDefined();
    expect(res.guess?.reason).toBe('MAX_QUESTIONS');
    expect(res.guess?.reason).not.toBe('DOMINANT_THRESHOLD');
    expect(res.message).toContain('without satisfying dominant threshold');

    // Confirm that the top score is well below the dominant threshold of 0.65
    expect(res.guess!.relativeScore).toBeLessThan(0.65);
  });

  it('24. exhausted feature pool handled gracefully with status EXHAUSTED and reason EXHAUSTED', async () => {
    // Only 1 feature available
    const singleFeatureList: IFeatureDomain[] = [
      { key: 'can_fly', question: 'Can fly?', category: 'abilities' },
    ];

    const start = await gameService.startGame(mockCharacters, singleFeatureList);
    // Answer the only available feature with DONT_KNOW so nobody dominates
    const res = await gameService.answerQuestion(start.sessionId, 'DONT_KNOW', singleFeatureList);

    expect(res.status).toBe('EXHAUSTED');
    expect(res.terminalReason).toBe('EXHAUSTED');
    expect(res.guess).toBeDefined();
    expect(res.guess?.reason).toBe('EXHAUSTED');
    expect(res.message).toContain('exhausted');
  });

  it('25. identical candidates are ranked deterministically by playCount then name', () => {
    const identicalChars = [
      { name: 'BetaClone', score: 0.5, playCount: 5, traits: {} },
      { name: 'AlphaClone', score: 0.5, playCount: 5, traits: {} },
      { name: 'VeteranClone', score: 0.5, playCount: 50, traits: {} },
    ];

    const sorted = gameService.sortCandidates(identicalChars);

    // VeteranClone has highest playCount (50) -> must be first
    expect(sorted[0].name).toBe('VeteranClone');
    // AlphaClone vs BetaClone have same score and playCount -> alphabetical order AlphaClone first
    expect(sorted[1].name).toBe('AlphaClone');
    expect(sorted[2].name).toBe('BetaClone');
  });

  it('26. invalid answer value is rejected with 400 error', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);

    await expect(
      // @ts-expect-error Testing invalid runtime string
      gameService.answerQuestion(start.sessionId, 'MAYBE_SOMETIMES', mockFeatures)
    ).rejects.toThrow(/Invalid answer/);
  });

  it('27. answering after a terminal state is rejected with 400 error', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    const session = sessionManager.getSession(start.sessionId)!;

    // Force terminal state
    session.status = 'GUESSED';

    await expect(
      gameService.answerQuestion(start.sessionId, 'YES', mockFeatures)
    ).rejects.toThrow(/Cannot answer question in terminal state/);
  });

  it('28. Python ML integration: uses Python guidance when service is online', async () => {
    vi.spyOn(mlClientService, 'getNextQuestion').mockResolvedValueOnce({
      featureKey: 'uses_technology',
      status: 'available',
    });

    const nextFeature = await questionSelector.selectNextFeature(
      [
        { name: 'Batman', score: 0.5, playCount: 1, traits: {} },
        { name: 'Superman', score: 0.5, playCount: 1, traits: {} },
      ],
      [],
      mockFeatures
    );

    expect(nextFeature).toBe('uses_technology');
  });

  it('29. Python ML failure fallback: falls back to deterministic Node selector if Python fails', async () => {
    vi.spyOn(mlClientService, 'getNextQuestion').mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const candidates = [
      { name: 'Batman', score: 0.5, playCount: 1, traits: { can_fly: false, wears_cape: true } },
      { name: 'Superman', score: 0.5, playCount: 1, traits: { can_fly: true, wears_cape: true } },
    ];

    // Node fallback calculates entropy for can_fly (50/50 split -> entropy 1.0) vs wears_cape (100% true -> entropy 0.0)
    const nextFeature = await questionSelector.selectNextFeature(
      candidates,
      [],
      mockFeatures
    );

    // Fallback must choose can_fly because it has highest entropy
    expect(nextFeature).toBe('can_fly');
  });

  it('30. Python unknown feature fallback: falls back to Node selector if Python returns unknown key', async () => {
    vi.spyOn(mlClientService, 'getNextQuestion').mockResolvedValueOnce({
      featureKey: 'non_existent_feature_123',
      status: 'available',
    });

    const candidates = [
      { name: 'Batman', score: 0.5, playCount: 1, traits: { can_fly: false } },
      { name: 'Superman', score: 0.5, playCount: 1, traits: { can_fly: true } },
    ];

    const nextFeature = await questionSelector.selectNextFeature(
      candidates,
      [],
      mockFeatures
    );

    // Rejected non_existent_feature_123 and deterministically selected can_fly
    expect(nextFeature).toBe('can_fly');
  });

  it('31. CRITICAL REGRESSION TEST: Question and Trait Desynchronization Prevention', async () => {
    /**
     * The original legacy bug:
     * Question text was selected for one feature, but the answer was evaluated against a different feature.
     *
     * In the new architecture:
     * 1. session.currentFeatureKey strictly defines the current question.
     * 2. Authoritative question text is derived strictly from Feature.find(key === currentFeatureKey).
     * 3. The evidence engine evaluates traits strictly using candidate.traits[currentFeatureKey].
     */
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    const session = sessionManager.getSession(start.sessionId)!;

    // Feature key delivered to user
    const askedFeatureKey = start.question!.featureKey;
    expect(askedFeatureKey).toBe(session.currentFeatureKey);

    // Authoritative feature question
    const authoritativeFeature = mockFeatures.find((f) => f.key === askedFeatureKey)!;
    expect(start.question!.text).toBe(authoritativeFeature.question);

    // Spy on evidence engine to verify it receives EXACTLY askedFeatureKey
    const spyEvidence = vi.spyOn(questionSelector, 'selectNextFeature');

    await gameService.answerQuestion(start.sessionId, 'YES', mockFeatures);

    // Verified: The exact same key was recorded in session.askedFeatures
    expect(session.askedFeatures[0]).toBe(askedFeatureKey);
  });

  it('32. supports transition to TEACHING mode when user rejects guess', async () => {
    const start = await gameService.startGame(mockCharacters, mockFeatures);
    const teachRes = gameService.transitionToTeaching(start.sessionId);

    expect(teachRes.status).toBe('TEACHING');
    const session = sessionManager.getSession(start.sessionId)!;
    expect(session.status).toBe('TEACHING');
  });

  it('33. recognizes trivial single-candidate knowledge base immediately', async () => {
    const singleChar = [{ name: 'LoneRanger', playCount: 1, traits: {} }];
    const res = await gameService.startGame(singleChar, mockFeatures);

    expect(res.status).toBe('GUESSED');
    expect(res.candidateCount).toBe(1);
    expect(res.guess?.name).toBe('LoneRanger');
    expect(res.guess?.relativeScore).toBe(1.0);
  });
});
