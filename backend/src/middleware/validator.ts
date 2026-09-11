import { Request, Response, NextFunction } from 'express';
import { AnswerType } from '../game/game.types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/;
const VALID_ANSWERS = new Set<string>(['YES', 'PROBABLY', 'DONT_KNOW', 'PROBABLY_NOT', 'NO']);
const SLUG_REGEX = /^[a-z0-9_]{3,80}$/;

export function isValidUuidV4(id: string): boolean {
  return typeof id === 'string' && UUID_V4_REGEX.test(id.trim());
}

export function hasControlChars(str: string): boolean {
  return CONTROL_CHARS_REGEX.test(str);
}

/**
 * Middleware validating sessionId parameter in route URLs (e.g. /:sessionId).
 */
export function validateSessionIdParam(req: Request, res: Response, next: NextFunction): void {
  const { sessionId } = req.params;

  if (!sessionId || !isValidUuidV4(sessionId)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SESSION_ID',
        message: 'Invalid or missing sessionId. Must be a valid UUID v4 format.',
      },
    });
    return;
  }

  next();
}

/**
 * Middleware validating POST /api/game/answer payload.
 */
export function validateAnswerPayload(req: Request, res: Response, next: NextFunction): void {
  const { sessionId, answer } = req.body || {};

  if (!sessionId || !isValidUuidV4(sessionId)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SESSION_ID',
        message: 'Invalid or missing sessionId. Must be a valid UUID v4 format.',
      },
    });
    return;
  }

  if (!answer || typeof answer !== 'string' || !VALID_ANSWERS.has(answer)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ANSWER_TYPE',
        message: `Invalid answer '${answer}'. Allowed values: YES, PROBABLY, DONT_KNOW, PROBABLY_NOT, NO`,
      },
    });
    return;
  }

  next();
}

/**
 * Validates teaching payload fields according to the frozen Phase 6 contract.
 */
export function validateTeachingFields(body: any): { isValid: boolean; code?: string; message?: string } {
  const { characterName, featureKey, featureQuestion, featureCategory, traitValue } = body || {};

  // 1. characterName: string, trimmed, 1-100 chars, no control chars, not whitespace-only
  if (
    typeof characterName !== 'string' ||
    characterName.trim().length === 0 ||
    characterName.trim().length > 100 ||
    hasControlChars(characterName)
  ) {
    return {
      isValid: false,
      code: 'INVALID_CHARACTER_NAME',
      message: 'characterName must be a non-empty string between 1 and 100 characters with no control characters.',
    };
  }

  // 2. traitValue: strict boolean, true or false only
  if (typeof traitValue !== 'boolean') {
    return {
      isValid: false,
      code: 'INVALID_TRAIT_VALUE',
      message: 'traitValue must be a strict boolean (true or false).',
    };
  }

  // 3. Feature specification: must have either featureKey or featureQuestion
  const hasKey = typeof featureKey === 'string' && featureKey.trim().length > 0;
  const hasQuestion = typeof featureQuestion === 'string' && featureQuestion.trim().length > 0;

  if (!hasKey && !hasQuestion) {
    return {
      isValid: false,
      code: 'MISSING_FEATURE_SPECIFICATION',
      message: 'Must provide either featureKey or featureQuestion.',
    };
  }

  if (hasKey) {
    const trimmedKey = featureKey.trim();
    if (!SLUG_REGEX.test(trimmedKey) || hasControlChars(trimmedKey)) {
      return {
        isValid: false,
        code: 'INVALID_FEATURE_KEY',
        message: 'featureKey must be 3-80 lowercase alphanumeric/underscore characters.',
      };
    }
  }

  if (hasQuestion) {
    const trimmedQ = featureQuestion.trim();
    if (trimmedQ.length < 10 || trimmedQ.length > 120 || !trimmedQ.endsWith('?') || hasControlChars(trimmedQ)) {
      return {
        isValid: false,
        code: 'INVALID_FEATURE_QUESTION',
        message: 'featureQuestion must be a string between 10 and 120 characters ending with a question mark (?) with no control characters.',
      };
    }
  }

  // 4. featureCategory: optional string, max 50 chars
  if (featureCategory !== undefined && featureCategory !== null) {
    if (typeof featureCategory !== 'string' || featureCategory.trim().length > 50 || hasControlChars(featureCategory)) {
      return {
        isValid: false,
        code: 'INVALID_FEATURE_CATEGORY',
        message: 'featureCategory must be an optional string up to 50 characters with no control characters.',
      };
    }
  }

  return { isValid: true };
}
