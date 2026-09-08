import mongoose, { Document, Schema, Model } from 'mongoose';
import { TraitState, getCharacterTraitState } from '../types/domain.types';

export interface ICharacterDocument extends Document {
  name: string;
  traits: Map<string, boolean>;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
  getTrait(featureKey: string): TraitState;
}

const CharacterSchema = new Schema<ICharacterDocument>(
  {
    name: {
      type: String,
      required: [true, 'Character name is required'],
      trim: true,
      maxlength: [100, 'Character name cannot exceed 100 characters'],
      validate: {
        validator: function (v: string) {
          return typeof v === 'string' && v.trim().length > 0;
        },
        message: 'Character name cannot be empty or whitespace only',
      },
    },
    traits: {
      type: Map,
      of: Boolean,
      default: () => new Map<string, boolean>(),
    },
    playCount: {
      type: Number,
      default: 0,
      min: [0, 'Play count cannot be negative'],
    },
  },
  {
    timestamps: true,
    strict: true, // Strict schema: rejects unmodeled root fields
  }
);

// Indexes
CharacterSchema.index({ name: 1 }, { unique: true });

// Instance method to inspect trait state preserving tri-state semantics
CharacterSchema.methods.getTrait = function (featureKey: string): TraitState {
  return getCharacterTraitState(this.traits, featureKey);
};

export const Character: Model<ICharacterDocument> =
  mongoose.models.Character || mongoose.model<ICharacterDocument>('Character', CharacterSchema);
