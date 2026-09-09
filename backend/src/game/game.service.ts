import { Character } from '../models/Character.model';
import { Feature } from '../models/Feature.model';
import { config } from '../config/env';
import {
  AnswerType,
  ICandidateState,
  IStartGameResponse,
  IAnswerGameResponse,
  IGuessResponse,
  ITeachGameRequest,
  ITeachGameResponse,
  ITeachModelMetadata,
  VALID_ANSWERS,
} from './game.types';
import { sessionManager } from './session.manager';
import { evidenceEngine } from './evidence.engine';
import { questionSelector } from './question.selector';
import { IFeatureDomain } from '../types/domain.types';
import { generateFeatureSlug, disambiguateSlug } from '../utils/slug.utils';
import { retrainQueue } from '../services/retrain-queue.service';

export class GameService {
  /**
   * Sorts candidates deterministically by:
   * 1. Relative evidence score (descending)
   * 2. Play count (descending)
   * 3. Character name (alphabetical ascending)
   */
  public sortCandidates(candidates: ICandidateState[]): ICandidateState[] {
    return [...candidates].sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) {
        return b.score - a.score;
      }
      if (b.playCount !== a.playCount) {
        return b.playCount - a.playCount;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Initializes a new game session with equal candidate scores (1/N).
   */
  public async startGame(
    injectedCharacters?: any[],
    injectedFeatures?: IFeatureDomain[]
  ): Promise<IStartGameResponse> {
    // 1. Fetch current knowledge base
    const characters = injectedCharacters || (await Character.find({}));
    const features: IFeatureDomain[] =
      injectedFeatures || (await Feature.find({}));

    if (!characters || characters.length === 0) {
      throw new Error('Knowledge base is empty. Please seed or train characters first.');
    }

    // Edge Case: N = 1 (Trivial single-candidate knowledge base)
    if (characters.length === 1) {
      const soleChar = characters[0];
      const session = sessionManager.createSession(
        [
          {
            name: soleChar.name,
            score: 1.0,
            playCount: soleChar.playCount || 0,
            traits: soleChar.traits instanceof Map ? Object.fromEntries(soleChar.traits) : soleChar.traits || {},
          },
        ],
        null,
        'GUESSED',
        { name: soleChar.name, score: 1.0, reason: 'TRIVIAL_KNOWLEDGE_BASE' },
        'TRIVIAL_KNOWLEDGE_BASE'
      );

      return {
        sessionId: session.sessionId,
        status: 'GUESSED',
        terminalReason: 'TRIVIAL_KNOWLEDGE_BASE',
        questionCount: 0,
        candidateCount: 1,
        guess: {
          name: soleChar.name,
          relativeScore: 1.0,
          reason: 'TRIVIAL_KNOWLEDGE_BASE',
        },
        message: 'Sole candidate knowledge base recognized.',
      };
    }

    // 2. Initialize candidates with equal score (1/N)
    const initialScore = 1.0 / characters.length;
    const candidates: ICandidateState[] = characters.map((char) => {
      let traitsObj: Record<string, boolean | undefined> = {};
      if (char.traits instanceof Map) {
        traitsObj = Object.fromEntries(char.traits);
      } else if (char.traits && typeof char.traits === 'object') {
        traitsObj = { ...char.traits };
      }

      return {
        name: char.name,
        score: initialScore,
        playCount: char.playCount || 0,
        traits: traitsObj,
      };
    });

    // 3. Request first feature guidance
    const firstFeatureKey = await questionSelector.selectNextFeature(
      candidates,
      [],
      features
    );

    if (!firstFeatureKey) {
      throw new Error('No distinguishing features available in knowledge base.');
    }

    // 4. Resolve authoritative question text from MongoDB Feature collection
    const featureDoc = features.find((f) => f.key === firstFeatureKey);
    if (!featureDoc) {
      throw new Error(`Authoritative feature document not found for key: ${firstFeatureKey}`);
    }

    // 5. Create active isolated session
    const session = sessionManager.createSession(candidates, firstFeatureKey, 'ACTIVE');

    return {
      sessionId: session.sessionId,
      status: 'ACTIVE',
      questionCount: 0,
      candidateCount: candidates.length,
      question: {
        featureKey: firstFeatureKey,
        text: featureDoc.question,
        questionCount: 1,
      },
    };
  }

  /**
   * Processes a player's answer, updates weighted evidence, and determines game progression.
   */
  public async answerQuestion(
    sessionId: string,
    answer: AnswerType,
    injectedFeatures?: IFeatureDomain[]
  ): Promise<IAnswerGameResponse> {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      const err: any = new Error(`Session '${sessionId}' not found or has expired.`);
      err.statusCode = 404;
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    if (!VALID_ANSWERS.includes(answer)) {
      const err: any = new Error(
        `Invalid answer '${answer}'. Allowed values: ${VALID_ANSWERS.join(', ')}`
      );
      err.statusCode = 400;
      err.code = 'INVALID_ANSWER_TYPE';
      throw err;
    }

    if (session.status !== 'ACTIVE') {
      const err: any = new Error(`Cannot answer question in terminal state: ${session.status}`);
      err.statusCode = 422;
      err.code = 'INVALID_SESSION_STATE';
      throw err;
    }

    const currentFeatureKey = session.currentFeatureKey;
    if (!currentFeatureKey) {
      const err: any = new Error('No active question associated with this session.');
      err.statusCode = 422;
      err.code = 'INVALID_SESSION_STATE';
      throw err;
    }

    // 1. Update candidate scores with multiplicative evidence engine
    const updatedCandidates = evidenceEngine.updateCandidateScores(
      session.candidates,
      currentFeatureKey,
      answer
    );

    // 2. Sort candidates deterministically
    const sorted = this.sortCandidates(updatedCandidates);
    session.candidates = sorted;
    session.questionCount += 1;
    session.askedFeatures.push(currentFeatureKey);

    const topCandidate = sorted[0];
    const secondCandidate = sorted.length > 1 ? sorted[1] : null;

    // 3. Dominant Guess Check:
    // top score >= 0.65 AND (top score - second score) >= 0.30
    const margin = secondCandidate ? topCandidate.score - secondCandidate.score : topCandidate.score;
    const isDominant =
      topCandidate.score >= config.guessMinScore && margin >= config.guessMinMargin;

    if (isDominant) {
      session.status = 'GUESSED';
      session.terminalReason = 'DOMINANT_THRESHOLD';
      session.bestGuess = {
        name: topCandidate.name,
        score: topCandidate.score,
        reason: 'DOMINANT_THRESHOLD',
      };
      session.currentFeatureKey = null;
      sessionManager.updateSession(sessionId, session);

      return {
        sessionId,
        status: 'GUESSED',
        terminalReason: 'DOMINANT_THRESHOLD',
        questionCount: session.questionCount,
        guess: {
          name: topCandidate.name,
          relativeScore: Number(topCandidate.score.toFixed(4)),
          reason: 'DOMINANT_THRESHOLD',
        },
        message: 'Dominant confidence threshold satisfied.',
      };
    }

    // 4. Question count limit check (Max 20 questions)
    // Reaching 20 questions does NOT mean dominant threshold was met!
    if (session.questionCount >= config.maxQuestions) {
      session.status = 'GUESSED';
      session.terminalReason = 'MAX_QUESTIONS';
      session.bestGuess = {
        name: topCandidate.name,
        score: topCandidate.score,
        reason: 'MAX_QUESTIONS',
      };
      session.currentFeatureKey = null;
      sessionManager.updateSession(sessionId, session);

      return {
        sessionId,
        status: 'GUESSED',
        terminalReason: 'MAX_QUESTIONS',
        questionCount: session.questionCount,
        guess: {
          name: topCandidate.name,
          relativeScore: Number(topCandidate.score.toFixed(4)),
          reason: 'MAX_QUESTIONS',
        },
        message: 'Maximum question limit (20) reached. Best available candidate returned without satisfying dominant threshold.',
      };
    }

    // 5. Select next question
    const features: IFeatureDomain[] =
      injectedFeatures || (await Feature.find({}));

    const nextFeatureKey = await questionSelector.selectNextFeature(
      session.candidates,
      session.askedFeatures,
      features
    );

    // If no more distinguishing features remain
    if (!nextFeatureKey) {
      session.status = 'EXHAUSTED';
      session.terminalReason = 'EXHAUSTED';
      session.bestGuess = {
        name: topCandidate.name,
        score: topCandidate.score,
        reason: 'EXHAUSTED',
      };
      session.currentFeatureKey = null;
      sessionManager.updateSession(sessionId, session);

      return {
        sessionId,
        status: 'EXHAUSTED',
        terminalReason: 'EXHAUSTED',
        questionCount: session.questionCount,
        guess: {
          name: topCandidate.name,
          relativeScore: Number(topCandidate.score.toFixed(4)),
          reason: 'EXHAUSTED',
        },
        message: 'All distinguishing features have been exhausted without satisfying dominant threshold.',
      };
    }

    // 6. Resolve question text from authoritative Feature document
    const nextFeatureDoc = features.find((f) => f.key === nextFeatureKey);
    if (!nextFeatureDoc) {
      throw new Error(`Authoritative feature document missing for key: ${nextFeatureKey}`);
    }

    session.currentFeatureKey = nextFeatureKey;
    sessionManager.updateSession(sessionId, session);

    return {
      sessionId,
      status: 'ACTIVE',
      questionCount: session.questionCount,
      nextQuestion: {
        featureKey: nextFeatureKey,
        text: nextFeatureDoc.question,
        questionCount: session.questionCount + 1,
      },
    };
  }

  /**
   * Exposes current top candidates and best guess without fabricating probabilities.
   */
  public getGuess(sessionId: string): IGuessResponse {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      const err: any = new Error(`Session '${sessionId}' not found or expired.`);
      err.statusCode = 404;
      throw err;
    }

    const sorted = this.sortCandidates(session.candidates);
    const topCandidates = sorted.slice(0, 5).map((c) => ({
      name: c.name,
      relativeScore: Number(c.score.toFixed(4)),
    }));

    return {
      sessionId,
      status: session.status,
      terminalReason: session.terminalReason,
      questionCount: session.questionCount,
      guess: session.bestGuess
        ? {
            name: session.bestGuess.name,
            relativeScore: Number(session.bestGuess.score.toFixed(4)),
            reason: session.bestGuess.reason,
          }
        : sorted.length > 0
        ? {
            name: sorted[0].name,
            relativeScore: Number(sorted[0].score.toFixed(4)),
            reason: session.terminalReason || 'DOMINANT_THRESHOLD',
          }
        : null,
      topCandidates,
    };
  }

  /**
   * Transitions session into TEACHING mode when user indicates the system made a wrong guess.
   */
  public transitionToTeaching(sessionId: string): { sessionId: string; status: string; message: string } {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      const err: any = new Error(`Session '${sessionId}' not found or expired.`);
      err.statusCode = 404;
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    session.status = 'TEACHING';
    sessionManager.updateSession(sessionId, session);

    return {
      sessionId,
      status: 'TEACHING',
      message: 'Handoff to teaching mode initiated.',
    };
  }

  /**
   * Processes knowledge teaching payload, persists Character and Feature documents
   * to MongoDB with conflict detection & compensating rollback, and triggers serialized ML retraining.
   */
  public async teachSession(
    sessionId: string,
    payload: ITeachGameRequest
  ): Promise<ITeachGameResponse> {
    // 1. Validate session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      const err: any = new Error(`Session '${sessionId}' not found or expired.`);
      err.statusCode = 404;
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    if (session.status === 'COMPLETED_TEACHING') {
      const err: any = new Error(`Session '${sessionId}' has already completed teaching handoff.`);
      err.statusCode = 422;
      err.code = 'SESSION_ALREADY_TAUGHT';
      throw err;
    }

    if (session.status === 'ACTIVE') {
      const err: any = new Error('Cannot teach an active game session in progress. Game must reach a terminal state first.');
      err.statusCode = 422;
      err.code = 'SESSION_ACTIVE_CANNOT_TEACH';
      throw err;
    }

    if (session.status !== 'GUESSED' && session.status !== 'EXHAUSTED' && session.status !== 'TEACHING') {
      const err: any = new Error(`Invalid session status '${session.status}' for teaching handoff.`);
      err.statusCode = 422;
      err.code = 'INVALID_SESSION_STATE';
      throw err;
    }

    // 2. Validate payload fields
    if (!payload || typeof payload !== 'object') {
      const err: any = new Error('Missing or invalid request payload.');
      err.statusCode = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    if (
      typeof payload.characterName !== 'string' ||
      payload.characterName.trim().length === 0 ||
      payload.characterName.trim().length > 100
    ) {
      const err: any = new Error('Character name must be a non-empty string between 1 and 100 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_CHARACTER_NAME';
      throw err;
    }

    // Check control characters
    if (/[\x00-\x1F\x7F]/.test(payload.characterName)) {
      const err: any = new Error('Character name cannot contain control characters.');
      err.statusCode = 400;
      err.code = 'INVALID_CHARACTER_NAME';
      throw err;
    }

    if (typeof payload.traitValue !== 'boolean') {
      const err: any = new Error('Trait value must be an explicit boolean (true or false).');
      err.statusCode = 400;
      err.code = 'INVALID_TRAIT_VALUE';
      throw err;
    }

    if (!payload.featureKey && !payload.featureQuestion) {
      const err: any = new Error('Must provide either featureKey or featureQuestion in teaching payload.');
      err.statusCode = 400;
      err.code = 'MISSING_FEATURE_SPECIFICATION';
      throw err;
    }

    if (payload.featureKey) {
      if (
        typeof payload.featureKey !== 'string' ||
        !/^[a-z0-9_]{3,50}$/.test(payload.featureKey.trim().toLowerCase())
      ) {
        const err: any = new Error(
          'Feature key must be a lowercase slug containing 3-50 alphanumeric characters or underscores.'
        );
        err.statusCode = 400;
        err.code = 'INVALID_FEATURE_KEY';
        throw err;
      }
    }

    if (payload.featureQuestion) {
      const trimmedQ = payload.featureQuestion.trim();
      if (typeof payload.featureQuestion !== 'string' || trimmedQ.length < 10 || trimmedQ.length > 120) {
        const err: any = new Error('Feature question must be a string between 10 and 120 characters.');
        err.statusCode = 400;
        err.code = 'INVALID_FEATURE_QUESTION';
        throw err;
      }
      if (!trimmedQ.endsWith('?')) {
        const err: any = new Error('Feature question must end with a question mark (?).');
        err.statusCode = 400;
        err.code = 'INVALID_FEATURE_QUESTION';
        throw err;
      }
    }

    if (payload.featureCategory) {
      if (typeof payload.featureCategory !== 'string' || payload.featureCategory.trim().length > 50) {
        const err: any = new Error('Feature category cannot exceed 50 characters.');
        err.statusCode = 400;
        err.code = 'INVALID_FEATURE_CATEGORY';
        throw err;
      }
    }

    // 3. Resolve or create Feature
    let resolvedFeature: {
      key: string;
      question: string;
      category: string;
      isNew: boolean;
    };
    let createdNewFeatureDoc: any = null;

    if (payload.featureKey) {
      const targetKey = payload.featureKey.trim().toLowerCase();
      const existingFeature = await Feature.findOne({ key: targetKey });
      if (!existingFeature) {
        const err: any = new Error(`Feature key '${targetKey}' does not exist.`);
        err.statusCode = 400;
        throw err;
      }

      // If question text also supplied, verify semantics are not being redefined
      if (payload.featureQuestion) {
        const suppliedQ = payload.featureQuestion.trim();
        if (suppliedQ !== existingFeature.question.trim()) {
          const err: any = new Error(
            `Cannot redefine authoritative question semantics for existing feature '${targetKey}'. Authoritative question is: "${existingFeature.question}"`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      resolvedFeature = {
        key: existingFeature.key,
        question: existingFeature.question,
        category: existingFeature.category || 'general',
        isNew: false,
      };
    } else {
      const trimmedQ = payload.featureQuestion!.trim();
      const category = payload.featureCategory?.trim().toLowerCase() || 'general';

      // Check if feature with identical question already exists
      const existingByQuestion = await Feature.findOne({ question: trimmedQ });
      if (existingByQuestion) {
        resolvedFeature = {
          key: existingByQuestion.key,
          question: existingByQuestion.question,
          category: existingByQuestion.category || 'general',
          isNew: false,
        };
      } else {
        const slug = generateFeatureSlug(trimmedQ);
        const existingByKey = await Feature.findOne({ key: slug });
        const finalKey = existingByKey ? disambiguateSlug(slug, trimmedQ) : slug;

        const newFeature = await Feature.create({
          key: finalKey,
          question: trimmedQ,
          category,
        });

        createdNewFeatureDoc = newFeature;
        resolvedFeature = {
          key: newFeature.key,
          question: newFeature.question,
          category: newFeature.category || 'general',
          isNew: true,
        };
      }
    }

    // 4. Resolve or create Character with Compensating Rollback
    const trimmedCharName = payload.characterName.trim();
    let charDoc = await Character.findOne({ name: trimmedCharName });
    let isCharNew = false;

    try {
      if (charDoc) {
        const existingTrait = charDoc.traits.get(resolvedFeature.key);
        if (existingTrait !== undefined) {
          if (existingTrait === payload.traitValue) {
            // Idempotent update: trait already matches taught value
          } else {
            // Contradiction detected
            const err: any = new Error(
              `Conflicting knowledge detected: Character '${charDoc.name}' already has '${resolvedFeature.key}' recorded as '${existingTrait}'. Canonical knowledge cannot be overwritten via user teaching.`
            );
            err.statusCode = 409;
            err.conflict = {
              character: charDoc.name,
              featureKey: resolvedFeature.key,
              existingValue: existingTrait,
              submittedValue: payload.traitValue,
            };
            throw err;
          }
        } else {
          // Enrich unobserved trait
          charDoc.traits.set(resolvedFeature.key, payload.traitValue);
          await charDoc.save();
        }
      } else {
        // Create brand new character (playCount = 0)
        isCharNew = true;
        const newChar = new Character({
          name: trimmedCharName,
          traits: new Map([[resolvedFeature.key, payload.traitValue]]),
          playCount: 0,
        });
        await newChar.save();
        charDoc = newChar;
      }
    } catch (dbError) {
      // Compensating rollback: clean up newly created Feature document if character update/creation failed
      if (createdNewFeatureDoc) {
        try {
          await Feature.deleteOne({ _id: createdNewFeatureDoc._id });
        } catch (cleanupErr) {
          console.error('[GameService] Compensating rollback of feature failed:', cleanupErr);
        }
      }
      throw dbError;
    }

    // 5. Trigger serialized ML Retraining
    let modelMetadata: ITeachModelMetadata = {
      retrained: false,
      modelVersion: '2.0.0',
      status: 'RETRAINING_PENDING_OR_FAILED',
      warning:
        'Knowledge persisted successfully to MongoDB, but ML model retraining failed or timed out. The previous model remains active.',
    };

    try {
      const retrainResult = await retrainQueue.enqueue();
      if (retrainResult && retrainResult.success) {
        modelMetadata = {
          retrained: true,
          modelVersion: '2.0.0',
          characterCount: retrainResult.character_count,
          featureCount: retrainResult.feature_count,
          treeDepth: retrainResult.tree_depth,
          leafCount: retrainResult.leaf_count,
          trainedAt: retrainResult.trained_at,
          status: 'SUCCESS',
        };
      }
    } catch (retrainError) {
      console.warn('[GameService] Retraining dispatch failed:', retrainError);
    }

    // 6. Transition session status to COMPLETED_TEACHING
    session.status = 'COMPLETED_TEACHING';
    sessionManager.updateSession(sessionId, session);

    return {
      success: true,
      sessionId,
      status: 'COMPLETED_TEACHING',
      character: {
        name: charDoc.name,
        isNew: isCharNew,
        playCount: charDoc.playCount || 0,
        taughtTrait: {
          featureKey: resolvedFeature.key,
          value: payload.traitValue,
        },
      },
      feature: {
        key: resolvedFeature.key,
        question: resolvedFeature.question,
        category: resolvedFeature.category,
        isNew: resolvedFeature.isNew,
      },
      model: modelMetadata,
      message: `Successfully incorporated ${charDoc.name} into Mind-Mancer knowledge base.`,
    };
  }
}

export const gameService = new GameService();
