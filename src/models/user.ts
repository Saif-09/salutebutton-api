import mongoose, { Schema } from "mongoose";

export interface IUser {
  username: string;
  phone: string;
  passcode: string; // bcrypt hash
  token: string;
  securityQuestion: string;
  securityAnswer: string; // bcrypt hash
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passcode: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    securityQuestion: { type: String, required: true },
    securityAnswer: { type: String, required: true },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
