import mongoose, { Schema } from "mongoose";

export interface IUser {
  username: string;
  phone: string;
  passcode: string; // bcrypt hash
  token: string;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passcode: { type: String, required: true },
    token: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
