import { describe, it, expect } from 'vitest';
import { evidenceEngine, EVIDENCE_MULTIPLIERS } from '../src/game/evidence.engine';
import { ICandidateState } from '../src/game/game.types';
import { TraitState } from '../src/types/domain.types';

describe('Weighted Evidence Engine Tests', () => {
  const baseCandidate = (name: string, traitVal?: boolean): ICandidateState => ({
    name,
    score: 0.5,
    playCount: 1,
    traits: traitVal !== undefined ? { test_trait: traitVal } : {}, // missing = unknown
  });

  it('6. verifies YES x TRUE has multiplier 1.00', () => {
    expect(EVIDENCE_MULTIPLIERS.YES[TraitState.TRUE]).toBe(1.00);
  });

  it('7. verifies YES x FALSE has multiplier 0.02', () => {
    expect(EVIDENCE_MULTIPLIERS.YES[TraitState.FALSE]).toBe(0.02);
  });

  it('8. verifies YES x UNKNOWN has multiplier 0.50', () => {
    expect(EVIDENCE_MULTIPLIERS.YES[TraitState.UNKNOWN]).toBe(0.50);
  });

  it('9. verifies PROBABLY multipliers: TRUE=0.85, FALSE=0.25, UNKNOWN=0.50', () => {
    expect(EVIDENCE_MULTIPLIERS.PROBABLY[TraitState.TRUE]).toBe(0.85);
    expect(EVIDENCE_MULTIPLIERS.PROBABLY[TraitState.FALSE]).toBe(0.25);
    expect(EVIDENCE_MULTIPLIERS.PROBABLY[TraitState.UNKNOWN]).toBe(0.50);
  });

  it('10. verifies PROBABLY NOT multipliers: TRUE=0.25, FALSE=0.85, UNKNOWN=0.50', () => {
    expect(EVIDENCE_MULTIPLIERS.PROBABLY_NOT[TraitState.TRUE]).toBe(0.25);
    expect(EVIDENCE_MULTIPLIERS.PROBABLY_NOT[TraitState.FALSE]).toBe(0.85);
    expect(EVIDENCE_MULTIPLIERS.PROBABLY_NOT[TraitState.UNKNOWN]).toBe(0.50);
  });

  it('11. verifies NO multipliers: TRUE=0.02, FALSE=1.00, UNKNOWN=0.50', () => {
    expect(EVIDENCE_MULTIPLIERS.NO[TraitState.TRUE]).toBe(0.02);
    expect(EVIDENCE_MULTIPLIERS.NO[TraitState.FALSE]).toBe(1.00);
    expect(EVIDENCE_MULTIPLIERS.NO[TraitState.UNKNOWN]).toBe(0.50);
  });

  it("12. verifies DON'T KNOW leaves relative ranking unchanged", () => {
    const candidates = [
      { name: 'C1', score: 0.7, playCount: 1, traits: { test_trait: true } },
      { name: 'C2', score: 0.3, playCount: 1, traits: { test_trait: false } },
    ];

    const updated = evidenceEngine.updateCandidateScores(candidates, 'test_trait', 'DONT_KNOW');

    // Both get multiplied by 0.50 and normalized back:
    // C1: 0.7 * 0.5 = 0.35; C2: 0.3 * 0.5 = 0.15; sum = 0.50
    // C1: 0.35 / 0.50 = 0.70; C2: 0.15 / 0.50 = 0.30
    expect(updated[0].score).toBeCloseTo(0.70, 4);
    expect(updated[1].score).toBeCloseTo(0.30, 4);
  });

  it('13. ensures scores always normalize to 1.0', () => {
    const candidates = [
      baseCandidate('CharA', true),
      baseCandidate('CharB', false),
      baseCandidate('CharC', undefined), // Unknown
    ];

    const updated = evidenceEngine.updateCandidateScores(candidates, 'test_trait', 'YES');
    const totalScore = updated.reduce((sum, c) => sum + c.score, 0);

    expect(totalScore).toBeCloseTo(1.0, 5);
  });

  it('14. ensures missing trait strictly behaves as UNKNOWN (multiplier 0.50 for YES)', () => {
    const candidates = [
      { name: 'KnownTrue', score: 1.0, playCount: 1, traits: { test_trait: true } },
      { name: 'MissingTrait', score: 1.0, playCount: 1, traits: {} }, // Omitted
    ];

    // Initial sum = 2.0 (unnormalized) -> for YES:
    // KnownTrue: 1.0 * 1.00 = 1.00
    // MissingTrait: 1.0 * 0.50 = 0.50
    // Sum = 1.50 -> KnownTrue = 1.00 / 1.50 = 0.6667; MissingTrait = 0.50 / 1.50 = 0.3333
    const updated = evidenceEngine.updateCandidateScores(candidates, 'test_trait', 'YES');

    expect(updated[0].score).toBeCloseTo(1.0 / 1.5, 4);
    expect(updated[1].score).toBeCloseTo(0.5 / 1.5, 4);
  });

  it('15. ensures missing trait is NEVER coerced into FALSE (which would be 0.02 for YES)', () => {
    const candidates = [
      { name: 'KnownFalse', score: 1.0, playCount: 1, traits: { test_trait: false } },
      { name: 'MissingTrait', score: 1.0, playCount: 1, traits: {} },
    ];

    // For YES:
    // KnownFalse gets 0.02
    // MissingTrait gets 0.50
    // If MissingTrait was mistakenly coerced to false, both would have score 0.02
    const updated = evidenceEngine.updateCandidateScores(candidates, 'test_trait', 'YES');

    const falseCandidate = updated.find((c) => c.name === 'KnownFalse')!;
    const missingCandidate = updated.find((c) => c.name === 'MissingTrait')!;

    expect(missingCandidate.score).toBeGreaterThan(falseCandidate.score * 20);
    expect(falseCandidate.score / missingCandidate.score).toBeCloseTo(0.02 / 0.50, 3);
  });

  it('16. provides numerical safety against NaN and underflow', () => {
    // Edge case: Extremely small scores that could underflow
    const candidates = [
      { name: 'TinyA', score: 1e-300, playCount: 1, traits: { test_trait: false } },
      { name: 'TinyB', score: 1e-300, playCount: 1, traits: { test_trait: false } },
    ];

    // Even under extreme repeated penalties, evidence engine must never return NaN or Infinity
    const updated = evidenceEngine.updateCandidateScores(candidates, 'test_trait', 'YES');

    expect(Number.isFinite(updated[0].score)).toBe(true);
    expect(Number.isFinite(updated[1].score)).toBe(true);
    expect(updated[0].score).toBeGreaterThan(0);
    expect(updated[0].score + updated[1].score).toBeCloseTo(1.0, 4);
  });
});
