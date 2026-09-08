/**
 * Domain-level type definitions for Mind-Mancer knowledge base.
 */

export enum TraitState {
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  UNKNOWN = 'UNKNOWN',
}

export interface ICharacterDomain {
  id?: string;
  name: string;
  traits: Record<string, boolean>;
  playCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFeatureDomain {
  id?: string;
  key: string;
  question: string;
  category?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Returns the explicit tri-state value of a feature for a given character.
 * Strictly guarantees that missing or null traits are treated as UNKNOWN, never coerced to FALSE.
 */
export function getCharacterTraitState(
  traits: Map<string, boolean> | Record<string, boolean | undefined> | undefined,
  featureKey: string
): TraitState {
  if (!traits) {
    return TraitState.UNKNOWN;
  }

  const val = traits instanceof Map ? traits.get(featureKey) : traits[featureKey];

  if (val === true) {
    return TraitState.TRUE;
  }
  if (val === false) {
    return TraitState.FALSE;
  }
  return TraitState.UNKNOWN;
}
