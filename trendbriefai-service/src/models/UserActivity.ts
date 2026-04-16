import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserActivity extends Document {
  user_id: Types.ObjectId;
  date: string; // YYYY-MM-DD
  sessions: number;
  articles_viewed: number;
  first_seen_at: Date;
  last_seen_at: Date;
  created_at: Date;
}

const UserActivitySchema = new Schema<IUserActivity>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    sessions: { type: Number, default: 1 },
    articles_viewed: { type: Number, default: 0 },
    first_seen_at: { type: Date, required: true },
    last_seen_at: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

// One record per user per day
UserActivitySchema.index({ user_id: 1, date: 1 }, { unique: true });
// For DAU/MAU queries
UserActivitySchema.index({ date: 1 });
// For retention cohort queries (find user's first ever activity)
UserActivitySchema.index({ user_id: 1, created_at: 1 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);
