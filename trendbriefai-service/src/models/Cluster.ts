import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICluster extends Document {
  centroid_embedding?: number[];
  representative_article_id?: Types.ObjectId;
  article_count: number;
  created_at: Date;
}

const ClusterSchema = new Schema<ICluster>(
  {
    centroid_embedding: {
      type: [Number],
    },
    representative_article_id: {
      type: Schema.Types.ObjectId,
      ref: 'Article',
    },
    article_count: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export const Cluster = mongoose.model<ICluster>('Cluster', ClusterSchema);
