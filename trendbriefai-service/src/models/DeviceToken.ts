import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeviceToken extends Document {
  user_id: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android';
  created_at: Date;
  updated_at: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DeviceTokenSchema.index({ user_id: 1 });
DeviceTokenSchema.index({ token: 1 }, { unique: true });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
