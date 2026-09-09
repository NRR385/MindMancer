import { IFeatureDomain } from '../types/domain.types';
import { ICandidateState } from './game.types';
import { mlClientService } from '../services/ml-client.service';

export class QuestionSelector {
  /**
   * Selects the next best distinguishing question.
   * Primary: Calls Python ML service.
   * Resilience: Deterministic Node fallback calculating tri-state entropy and unknown penalty.
   */
  public async selectNextFeature(
    candidates: ICandidateState[],
    askedFeatures: string[],
    allFeatures: IFeatureDomain[]
  ): Promise<string | null> {
    const unaskedFeatures = allFeatures.filter((f) => !askedFeatures.includes(f.key));
    if (unaskedFeatures.length === 0) {
      return null;
    }

    const unaskedKeys = new Set(unaskedFeatures.map((f) => f.key));
    const candidateNames = candidates.map((c) => c.name);

    // 1. Try Python ML service guidance
    try {
      const mlResponse = await mlClientService.getNextQuestion(candidateNames, askedFeatures);

      if (mlResponse && mlResponse.featureKey && unaskedKeys.has(mlResponse.featureKey)) {
        return mlResponse.featureKey;
      }
    } catch (e) {
      // Gracefully continue to Node fallback
    }

    // 2. Deterministic Node Fallback Heuristic
    return this.calculateNodeFallbackFeature(candidates, unaskedFeatures);
  }

  /**
   * Evaluates candidate pool using tri-state Shannon entropy and distinguishing ratio gamma.
   * Utility(f) = Entropy(f) * (1.0 - p_unknown)
   */
  public calculateNodeFallbackFeature(
    candidates: ICandidateState[],
    unaskedFeatures: IFeatureDomain[]
  ): string | null {
    if (unaskedFeatures.length === 0 || candidates.length === 0) {
      return null;
    }

    const nCandidates = candidates.length;

    const scoredFeatures = unaskedFeatures.map((feat) => {
      let nTrue = 0;
      let nFalse = 0;
      let nUnk = 0;

      for (const candidate of candidates) {
        const val = candidate.traits[feat.key];
        if (val === true) {
          nTrue++;
        } else if (val === false) {
          nFalse++;
        } else {
          nUnk++;
        }
      }

      const pTrue = nTrue / nCandidates;
      const pFalse = nFalse / nCandidates;
      const pUnk = nUnk / nCandidates;

      // Calculate tri-state entropy
      let entropy = 0;
      for (const p of [pTrue, pFalse, pUnk]) {
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
      }

      const distinguishingRatio = 1.0 - pUnk;
      const utility = entropy * distinguishingRatio;

      return {
        key: feat.key,
        entropy,
        unknownRate: pUnk,
        distinguishingRatio,
        utility,
      };
    });

    // Sort deterministically:
    // 1. Highest utility descending
    // 2. Lowest unknown rate ascending
    // 3. Alphabetical feature key ascending
    scoredFeatures.sort((a, b) => {
      if (Math.abs(b.utility - a.utility) > 1e-6) {
        return b.utility - a.utility;
      }
      if (Math.abs(a.unknownRate - b.unknownRate) > 1e-6) {
        return a.unknownRate - b.unknownRate;
      }
      return a.key.localeCompare(b.key);
    });

    return scoredFeatures[0]?.key || null;
  }
}

export const questionSelector = new QuestionSelector();
