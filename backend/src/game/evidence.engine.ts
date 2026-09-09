import { TraitState, getCharacterTraitState } from '../types/domain.types';
import { AnswerType, ICandidateState } from './game.types';

/**
 * Frozen evidence multipliers for tri-state trait interactions.
 * YES:          TRUE = 1.00, FALSE = 0.02, UNKNOWN = 0.50
 * PROBABLY:     TRUE = 0.85, FALSE = 0.25, UNKNOWN = 0.50
 * DONT_KNOW:    TRUE = 0.50, FALSE = 0.50, UNKNOWN = 0.50
 * PROBABLY_NOT: TRUE = 0.25, FALSE = 0.85, UNKNOWN = 0.50
 * NO:           TRUE = 0.02, FALSE = 1.00, UNKNOWN = 0.50
 */
export const EVIDENCE_MULTIPLIERS: Record<AnswerType, Record<TraitState, number>> = {
  YES: {
    [TraitState.TRUE]: 1.00,
    [TraitState.FALSE]: 0.02,
    [TraitState.UNKNOWN]: 0.50,
  },
  PROBABLY: {
    [TraitState.TRUE]: 0.85,
    [TraitState.FALSE]: 0.25,
    [TraitState.UNKNOWN]: 0.50,
  },
  DONT_KNOW: {
    [TraitState.TRUE]: 0.50,
    [TraitState.FALSE]: 0.50,
    [TraitState.UNKNOWN]: 0.50,
  },
  PROBABLY_NOT: {
    [TraitState.TRUE]: 0.25,
    [TraitState.FALSE]: 0.85,
    [TraitState.UNKNOWN]: 0.50,
  },
  NO: {
    [TraitState.TRUE]: 0.02,
    [TraitState.FALSE]: 1.00,
    [TraitState.UNKNOWN]: 0.50,
  },
};

export class EvidenceEngine {
  /**
   * Applies multiplicative evidence scoring and normalizes candidate scores.
   *
   * newScore(c) = oldScore(c) * multiplier(answer, traitState)
   * normalizedScore(c) = newScore(c) / sum(all newScores)
   */
  public updateCandidateScores(
    candidates: ICandidateState[],
    featureKey: string,
    answer: AnswerType
  ): ICandidateState[] {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const answerMultipliers = EVIDENCE_MULTIPLIERS[answer];
    if (!answerMultipliers) {
      throw new Error(`Invalid answer type: ${answer}`);
    }

    // 1. Calculate unnormalized multiplicative scores
    const updatedCandidates = candidates.map((candidate) => {
      const traitState = getCharacterTraitState(candidate.traits, featureKey);
      const multiplier = answerMultipliers[traitState];
      const newScore = candidate.score * multiplier;

      return {
        ...candidate,
        score: newScore,
      };
    });

    // 2. Compute total sum for normalization
    let sum = updatedCandidates.reduce((acc, c) => acc + c.score, 0);

    // 3. Numerical safety checks against NaN, underflow, or zero sum
    if (!Number.isFinite(sum) || sum <= 0) {
      // Numerical underflow protection: distribute equal scores rather than corrupting into NaN
      const fallbackScore = 1 / updatedCandidates.length;
      return updatedCandidates.map((c) => ({
        ...c,
        score: fallbackScore,
      }));
    }

    // 4. Normalize scores so sum(score) === 1.0
    return updatedCandidates.map((c) => ({
      ...c,
      score: c.score / sum,
    }));
  }
}

export const evidenceEngine = new EvidenceEngine();
