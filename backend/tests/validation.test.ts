import { describe, it, expect } from 'vitest';
import {
  isValidUuidV4,
  hasControlChars,
  validateTeachingFields,
} from '../src/middleware/validator';

describe('Phase 7 Input Validation Tests', () => {
  describe('UUID v4 Validation', () => {
    it('TC-VAL-01: Validates standard UUID v4 strings', () => {
      expect(isValidUuidV4('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isValidUuidV4('83b7ff45-21d9-43c2-8438-ef22f3fb8d4a')).toBe(true);
    });

    it('TC-VAL-02: Rejects non-UUID strings and injection attempts', () => {
      expect(isValidUuidV4('')).toBe(false);
      expect(isValidUuidV4('12345')).toBe(false);
      expect(isValidUuidV4('not-a-uuid-format-string-here')).toBe(false);
      expect(isValidUuidV4('f47ac10b-58cc-1372-a567-0e02b2c3d479')).toBe(false); // v1 instead of v4
      expect(isValidUuidV4('{"$gt": ""}')).toBe(false);
    });
  });

  describe('Control Character Detection', () => {
    it('TC-VAL-03: Detects unprintable control characters', () => {
      expect(hasControlChars('Clean text')).toBe(false);
      expect(hasControlChars('Text with null \x00 byte')).toBe(true);
      expect(hasControlChars('Text with bell \x07 char')).toBe(true);
      expect(hasControlChars('Text with backspace \x08 char')).toBe(true);
    });
  });

  describe('Teaching Payload Validation Contract (Restored Phase 6)', () => {
    it('TC-VAL-04: Accepts valid teaching payload adhering to Phase 6 contract', () => {
      const valid = {
        characterName: 'Black Widow',
        featureQuestion: 'Is this character an elite martial artist?',
        featureCategory: 'skills',
        traitValue: true,
      };

      const result = validateTeachingFields(valid);
      expect(result.isValid).toBe(true);
    });

    it('TC-VAL-05: Rejects empty or whitespace-only character name', () => {
      const invalid = {
        characterName: '   ',
        featureQuestion: 'Is this character an elite martial artist?',
        traitValue: true,
      };

      const result = validateTeachingFields(invalid);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_CHARACTER_NAME');
    });

    it('TC-VAL-06: Rejects character name exceeding 100 characters', () => {
      const invalid = {
        characterName: 'A'.repeat(101),
        featureQuestion: 'Is this character an elite martial artist?',
        traitValue: true,
      };

      const result = validateTeachingFields(invalid);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_CHARACTER_NAME');
    });

    it('TC-VAL-07: Rejects non-boolean trait value', () => {
      const invalid1 = {
        characterName: 'Hulk',
        featureQuestion: 'Is this character green and gigantic?',
        traitValue: 'true', // string instead of boolean
      };

      const invalid2 = {
        characterName: 'Hulk',
        featureQuestion: 'Is this character green and gigantic?',
        traitValue: 1, // number instead of boolean
      };

      expect(validateTeachingFields(invalid1).code).toBe('INVALID_TRAIT_VALUE');
      expect(validateTeachingFields(invalid2).code).toBe('INVALID_TRAIT_VALUE');
    });

    it('TC-VAL-08: Rejects question without trailing question mark', () => {
      const invalid = {
        characterName: 'Thor',
        featureQuestion: 'Is this character an Asgardian god of thunder', // missing ?
        traitValue: true,
      };

      const result = validateTeachingFields(invalid);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_FEATURE_QUESTION');
    });

    it('TC-VAL-09: Rejects question shorter than 10 characters or longer than 120 characters', () => {
      const tooShort = {
        characterName: 'Thor',
        featureQuestion: 'God?', // 4 chars
        traitValue: true,
      };

      const tooLong = {
        characterName: 'Thor',
        featureQuestion: 'Is this character someone who '.repeat(5) + '?', // > 120 chars
        traitValue: true,
      };

      expect(validateTeachingFields(tooShort).code).toBe('INVALID_FEATURE_QUESTION');
      expect(validateTeachingFields(tooLong).code).toBe('INVALID_FEATURE_QUESTION');
    });

    it('TC-VAL-10: Rejects category exceeding 50 characters', () => {
      const invalid = {
        characterName: 'Thor',
        featureQuestion: 'Is this character an Asgardian god of thunder?',
        featureCategory: 'C'.repeat(51),
        traitValue: true,
      };

      const result = validateTeachingFields(invalid);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INVALID_FEATURE_CATEGORY');
    });
  });
});
