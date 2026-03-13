import mongoose, { Schema } from "mongoose";

export interface IFeedback {
  name: string;
  email: string;
  type: "feedback" | "improvement" | "bug" | "other";
  message: string;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    type: {
      type: String,
      enum: ["feedback", "improvement", "bug", "other"],
      required: true,
    },
    message: { type: String, required: true },
  },
  { timestamps: true },
);

export const Feedback =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema);
