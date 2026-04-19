import mongoose, { Schema, Document } from 'mongoose';

export interface ITopic extends Document {
  key: string;
  label: string;
  icon: string;
  color: string;
  order: number;
  is_active: boolean;
  created_at: Date;
}

const TopicSchema = new Schema<ITopic>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    order: {
      type: Number,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

TopicSchema.index({ order: 1 });
TopicSchema.index({ is_active: 1 });

export const Topic = mongoose.model<ITopic>('Topic', TopicSchema);
