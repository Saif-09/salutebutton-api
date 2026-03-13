import mongoose, { Schema } from "mongoose";

export interface ICategory {
  name: string;
  slug: string;
  order: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Category =
  mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);
