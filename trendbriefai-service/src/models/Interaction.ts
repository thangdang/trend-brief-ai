import mongoose, { Schema, Document, Types } from 'mongoose';
import { InteractionAction } from '../types/api.types';

export interface IInteraction extends Document {
  user_id: Types.ObjectId;
  article_id: Types.ObjectId;
  action: InteractionAction;
  created_at: Date;
}

const InteractionSchema = new Schema<IInteraction>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    article_id: {
      type: Schema.Types.ObjectId,
      ref: 'Article',
      required: true,
    },
    action: {
      type: String,
      enum: ['view', 'click_original', 'share', 'bookmark'],
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

InteractionSchema.index({ user_id: 1, created_at: -1 });
InteractionSchema.index({ article_id: 1 });

export const Interaction = mongoose.model<IInteraction>('Interaction', InteractionSchema);
