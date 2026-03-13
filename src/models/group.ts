import mongoose, { Schema } from "mongoose";

export interface IProfile {
  name: string;
  description: string;
  image: string;
  respectors: number;
  dispiters: number;
}

export interface IGroup {
  name: string;
  code: string;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  profiles: IProfile[];
}

const ProfileSchema = new Schema<IProfile>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true },
    respectors: { type: Number, default: 0 },
    dispiters: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const GroupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    profiles: { type: [ProfileSchema], default: [] },
  },
  { timestamps: true },
);

export const Group =
  mongoose.models.Group || mongoose.model<IGroup>("Group", GroupSchema);
