import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationLog extends Document {
  user_id: Types.ObjectId;
  article_id: Types.ObjectId;
  type: 'trending' | 'topic_update' | 'daily_digest' | 'weekly_digest';
  sent_at: Date;
  delivered_at?: Date;
  opened_at?: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>(
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
    type: {
      type: String,
      enum: ['trending', 'topic_update', 'daily_digest', 'weekly_digest'],
      required: true,
    },
    sent_at: {
      type: Date,
      default: Date.now,
    },
    delivered_at: {
      type: Date,
    },
    opened_at: {
      type: Date,
    },
  },
  {
    timestamps: false,
  }
);

NotificationLogSchema.index({ user_id: 1, sent_at: -1 });
NotificationLogSchema.index({ user_id: 1, sent_at: 1 }); // For daily rate limit queries

export const NotificationLog = mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema);
