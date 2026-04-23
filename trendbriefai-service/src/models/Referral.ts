import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  referrer_id: Types.ObjectId;
  referee_id: Types.ObjectId;
  code: string;
  reward_granted: boolean;
  created_at: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrer_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referee_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true },
    reward_granted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

ReferralSchema.index({ referrer_id: 1 });
ReferralSchema.index({ referee_id: 1 }, { unique: true });
ReferralSchema.index({ code: 1 });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
