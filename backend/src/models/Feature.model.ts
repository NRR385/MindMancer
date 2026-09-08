import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFeatureDocument extends Document {
  key: string;
  question: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureSchema = new Schema<IFeatureDocument>(
  {
    key: {
      type: String,
      required: [true, 'Feature key is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          return /^[a-z0-9_]{3,50}$/.test(v);
        },
        message: 'Feature key must be a lowercase slug containing 3-50 alphanumeric characters or underscores',
      },
    },
    question: {
      type: String,
      required: [true, 'Feature question text is required'],
      trim: true,
      minlength: [10, 'Question must be at least 10 characters long'],
      maxlength: [120, 'Question cannot exceed 120 characters'],
      validate: {
        validator: function (v: string) {
          return typeof v === 'string' && v.trim().endsWith('?');
        },
        message: 'Question must end with a question mark (?)',
      },
    },
    category: {
      type: String,
      trim: true,
      maxlength: [50, 'Category cannot exceed 50 characters'],
      default: 'general',
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes
FeatureSchema.index({ key: 1 }, { unique: true });

export const Feature: Model<IFeatureDocument> =
  mongoose.models.Feature || mongoose.model<IFeatureDocument>('Feature', FeatureSchema);
