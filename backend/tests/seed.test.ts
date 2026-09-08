import { describe, it, expect } from 'vitest';
import { Character } from '../src/models/Character.model';
import { Feature } from '../src/models/Feature.model';
import { SEED_CHARACTERS, SEED_FEATURES } from '../src/seed';
import { TraitState } from '../src/types/domain.types';

describe('Seed Data Integrity & Validation', () => {
  it('should validate that all seed features adhere strictly to Feature schema', () => {
    expect(SEED_FEATURES.length).toBeGreaterThanOrEqual(12);
    expect(SEED_FEATURES.length).toBeLessThanOrEqual(20);

    const keys = new Set<string>();

    for (const feat of SEED_FEATURES) {
      // Key must be unique within seed
      expect(keys.has(feat.key)).toBe(false);
      keys.add(feat.key);

      const doc = new Feature(feat);
      const validationError = doc.validateSync();
      expect(validationError).toBeUndefined();
      expect(feat.question.endsWith('?')).toBe(true);
      expect(feat.question.length).toBeGreaterThanOrEqual(10);
      expect(feat.question.length).toBeLessThanOrEqual(120);
    }
  });

  it('should validate that all seed characters adhere strictly to Character schema', () => {
    expect(SEED_CHARACTERS.length).toBeGreaterThanOrEqual(10);
    expect(SEED_CHARACTERS.length).toBeLessThanOrEqual(15);

    const names = new Set<string>();

    for (const char of SEED_CHARACTERS) {
      // Name must be unique within seed
      expect(names.has(char.name)).toBe(false);
      names.add(char.name);

      const doc = new Character(char);
      const validationError = doc.validateSync();
      expect(validationError).toBeUndefined();
    }
  });

  it('should verify that seed data genuinely demonstrates UNKNOWN traits by omission', () => {
    const supermanDoc = new Character(SEED_CHARACTERS.find((c) => c.name === 'Superman'));
    expect(supermanDoc).toBeDefined();

    // Superman has is_human: false (known False)
    expect(supermanDoc.getTrait('is_human')).toBe(TraitState.FALSE);

    // Superman has can_fly: true (known True)
    expect(supermanDoc.getTrait('can_fly')).toBe(TraitState.TRUE);

    // Superman has uses_martial_arts omitted (UNKNOWN by omission)
    expect(supermanDoc.getTrait('uses_martial_arts')).toBe(TraitState.UNKNOWN);
    expect(supermanDoc.getTrait('uses_martial_arts')).not.toBe(TraitState.FALSE);

    // Yoda has is_wealthy omitted (UNKNOWN by omission)
    const yodaDoc = new Character(SEED_CHARACTERS.find((c) => c.name === 'Yoda'));
    expect(yodaDoc.getTrait('is_wealthy')).toBe(TraitState.UNKNOWN);
    expect(yodaDoc.getTrait('uses_lightsaber')).toBe(TraitState.TRUE);
  });
});
