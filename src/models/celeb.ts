import mongoose, { Schema } from "mongoose";

export interface ICeleb {
  name: string;
  image: string;
  category: mongoose.Types.ObjectId;
  respectors: number;
  dispiters: number;
  comment: string;
}

const CelebSchema = new Schema<ICeleb>(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    respectors: { type: Number, default: 0 },
    dispiters: { type: Number, default: 0 },
    comment: { type: String, default: "" },
  },
  { timestamps: true },
);

CelebSchema.index({ name: "text" });
CelebSchema.index({ respectors: -1 });

export const Celeb =
  mongoose.models.Celeb || mongoose.model<ICeleb>("Celeb", CelebSchema);
