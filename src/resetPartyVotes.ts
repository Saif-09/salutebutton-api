import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

async function resetPartyVotes() {
  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected");

  const partyCategory = await Category.findOne({ slug: "political-party" });
  if (!partyCategory) {
    console.error("❌ 'political-party' category not found.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const result = await Celeb.updateMany(
    { category: partyCategory._id },
    { $set: { respectors: 0, dispiters: 0 } },
  );

  console.log(`✅ Reset votes to 0 for ${result.modifiedCount} parties.`);
  await mongoose.disconnect();
}

resetPartyVotes().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
