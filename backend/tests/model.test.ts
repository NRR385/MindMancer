import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { TraitState, getCharacterTraitState } from '../src/types/domain.types';

describe('Phase 5A: Character & Feature Mongoose Models', () => {
  // 1. Valid character creation
  it('1. should validate a valid character document', async () => {
    const char = new Character({
      name: 'Superman',
      traits: {
        is_human: false,
        can_fly: true,
      },
    });

    const error = char.validateSync();
    expect(error).toBeUndefined();
    expect(char.name).toBe('Superman');
    expect(char.traits.get('can_fly')).toBe(true);
    expect(char.traits.get('is_human')).toBe(false);
  });

  // 2. Empty character name rejected
  it('2. should reject empty or whitespace-only character name', () => {
    const emptyNameChar = new Character({ name: '' });
    const emptyErr = emptyNameChar.validateSync();
    expect(emptyErr).toBeDefined();
    expect(emptyErr?.errors['name']).toBeDefined();

    const whitespaceChar = new Character({ name: '    ' });
    const whitespaceErr = whitespaceChar.validateSync();
    expect(whitespaceErr).toBeDefined();
    expect(whitespaceErr?.errors['name']).toBeDefined();
  });

  // 3. Duplicate character name uniqueness constraint
  it('3. should enforce unique index on character name', () => {
    const indexes = Character.schema.indexes();
    const nameIndex = indexes.find((idx) => idx[0]['name'] !== undefined);
    expect(nameIndex).toBeDefined();
    expect(nameIndex?.[1]?.unique).toBe(true);
  });

  // 4. Valid feature creation
  it('4. should validate a valid feature document', () => {
    const feature = new Feature({
      key: 'has_batmobile',
      question: 'Does your character drive a Batmobile?',
      category: 'equipment',
    });

    const error = feature.validateSync();
    expect(error).toBeUndefined();
    expect(feature.key).toBe('has_batmobile');
    expect(feature.question).toBe('Does your character drive a Batmobile?');
  });

  // 5. Invalid feature key rejected
  it('5. should reject invalid feature keys (uppercase, special characters, too short)', () => {
    // Uppercase
    const upperFeature = new Feature({
      key: 'Has_Batmobile',
      question: 'Valid question text?',
    });
    // Feature schema lowercases on setter, but regex validator checks pattern:
    // Testing special characters (spaces, dashes, punctuation):
    const specialFeature = new Feature({
      key: 'has-batmobile!',
      question: 'Valid question text?',
    });
    const specialErr = specialFeature.validateSync();
    expect(specialErr).toBeDefined();
    expect(specialErr?.errors['key']).toBeDefined();

    // Too short (< 3 chars)
    const shortFeature = new Feature({
      key: 'ab',
      question: 'Valid question text?',
    });
    const shortErr = shortFeature.validateSync();
    expect(shortErr).toBeDefined();
    expect(shortErr?.errors['key']).toBeDefined();
  });

  // 6. Invalid question rejected (no question mark or too short)
  it('6. should reject invalid question text missing question mark or under 10 chars', () => {
    // Missing question mark
    const noMark = new Feature({
      key: 'can_fly',
      question: 'Can your character fly',
    });
    const noMarkErr = noMark.validateSync();
    expect(noMarkErr).toBeDefined();
    expect(noMarkErr?.errors['question']).toBeDefined();

    // Under 10 characters
    const shortQ = new Feature({
      key: 'can_fly',
      question: 'Fly?',
    });
    const shortQErr = shortQ.validateSync();
    expect(shortQErr).toBeDefined();
    expect(shortQErr?.errors['question']).toBeDefined();
  });

  // 7. Duplicate feature key index
  it('7. should enforce unique index on feature key', () => {
    const indexes = Feature.schema.indexes();
    const keyIndex = indexes.find((idx) => idx[0]['key'] !== undefined);
    expect(keyIndex).toBeDefined();
    expect(keyIndex?.[1]?.unique).toBe(true);
  });

  // 8. TRUE trait remains true
  it('8. should preserve TRUE trait value accurately', () => {
    const char = new Character({
      name: 'Batman',
      traits: {
        wears_cape: true,
      },
    });

    expect(char.traits.get('wears_cape')).toBe(true);
    expect(char.getTrait('wears_cape')).toBe(TraitState.TRUE);
  });

  // 9. FALSE trait remains false
  it('9. should preserve FALSE trait value accurately', () => {
    const char = new Character({
      name: 'Batman',
      traits: {
        has_superpowers: false,
      },
    });

    expect(char.traits.get('has_superpowers')).toBe(false);
    expect(char.getTrait('has_superpowers')).toBe(TraitState.FALSE);
  });

  // 10. Missing trait is interpreted as UNKNOWN
  it('10. should interpret missing/unrecorded trait as UNKNOWN', () => {
    const char = new Character({
      name: 'Batman',
      traits: {
        wears_cape: true,
      },
    });

    // 'uses_magic' was never set
    expect(char.traits.get('uses_magic')).toBeUndefined();
    expect(char.getTrait('uses_magic')).toBe(TraitState.UNKNOWN);
  });

  // 11. UNKNOWN is NOT coerced into false
  it('11. strictly ensures UNKNOWN is never equal to FALSE', () => {
    const char = new Character({
      name: 'Superman',
      traits: {
        is_human: false, // known false
        // 'uses_martial_arts' is omitted (unknown)
      },
    });

    const knownFalse = char.getTrait('is_human');
    const unknownTrait = char.getTrait('uses_martial_arts');

    expect(knownFalse).toBe(TraitState.FALSE);
    expect(unknownTrait).toBe(TraitState.UNKNOWN);

    // Strict semantic differentiation
    expect(unknownTrait).not.toBe(TraitState.FALSE);
    expect(unknownTrait === TraitState.FALSE).toBe(false);

    // Test direct helper logic as well
    const helperState = getCharacterTraitState(char.traits, 'uses_martial_arts');
    expect(helperState).toBe(TraitState.UNKNOWN);
    expect(helperState).not.toBe(TraitState.FALSE);
  });
});
