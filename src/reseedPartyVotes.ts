import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Tier = 1 | 2 | 3 | 4;

const PARTY_TIERS: Record<string, Tier> = {
  // Tier 1: National giants
  "BJP": 1,
  "INC": 1,

  // Tier 2: Major national / large regional
  "AAP": 2,
  "TMC": 2,
  "DMK": 2,
  "BJD": 2,
  "YSRCP": 2,
  "TDP": 2,
  "BRS": 2,
  "SP": 2,
  "RJD": 2,
  "JD(U)": 2,
  "Shiv Sena (UBT)": 2,
  "TVK": 2,

  // Tier 3: Established regional
  "BSP": 3,
  "CPI(M)": 3,
  "AIADMK": 3,
  "NCP": 3,
  "NCP (SP)": 3,
  "Shiv Sena": 3,
  "JKNC": 3,
  "PDP": 3,
  "SAD": 3,
  "CPI": 3,
  "RLD": 3,
  "LJP": 3,
  "NPP": 3,

  // Tier 4: Niche / satire
  "CJP": 4,
};

function getVotesForParty(name: string): { respectors: number; dispiters: number } {
  const tier = PARTY_TIERS[name] ?? 3;
  switch (tier) {
    case 1: return { respectors: rand(12000, 20000), dispiters: rand(4000, 9000) };
    case 2: return { respectors: rand(5000, 10000),  dispiters: rand(2000, 5000) };
    case 3: return { respectors: rand(2000, 5000),   dispiters: rand(800, 2500) };
    case 4: return { respectors: rand(300, 1500),    dispiters: rand(100, 800) };
  }
}

async function reseedPartyVotes() {
  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected");

  const partyCategory = await Category.findOne({ slug: "political-party" });
  if (!partyCategory) {
    console.error("❌ 'political-party' category not found. Run `npm run seed` first to create it.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const parties = await Celeb.find({ category: partyCategory._id });
  console.log(`🎯 Found ${parties.length} parties — refreshing votes...\n`);

  for (const party of parties) {
    const votes = getVotesForParty(party.name);
    await Celeb.updateOne(
      { _id: party._id },
      { $set: { respectors: votes.respectors, dispiters: votes.dispiters } },
    );
    console.log(
      `  ${party.name.padEnd(20)} → 👍 ${votes.respectors.toString().padStart(6)}  👎 ${votes.dispiters.toString().padStart(6)}`,
    );
  }

  console.log(`\n✅ Refreshed votes for ${parties.length} parties.`);
  await mongoose.disconnect();
}

reseedPartyVotes().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
