import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

const CATEGORIES = [
  { name: "Politician", slug: "politician", order: 1 },
  { name: "Cricketer", slug: "cricketer", order: 2 },
  { name: "IPL Team", slug: "ipl-team", order: 3 },
  { name: "Actor", slug: "actor", order: 4 },
];

function avatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=500&background=random&bold=true&format=png`;
}

// Fetch image from Wikipedia API
async function fetchWikiImage(name: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SaluteButton/1.0 (seed script)" },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.thumbnail?.source ?? data?.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

// Map of Wikipedia article names (for those whose names differ from article titles)
const WIKI_NAMES: Record<string, string> = {
  "Vijay (Thalapathy)": "Vijay (actor)",
  "MK Stalin": "M. K. Stalin",
  "Chandrashekhar Azad": "Chandrashekhar Aazad",
  "MS Dhoni": "MS Dhoni",
  "KL Rahul": "KL Rahul",
  "KCR": "K. Chandrashekar Rao",
  "JP Nadda": "Jagat Prakash Nadda",
  "Chennai Super Kings": "Chennai Super Kings",
  "Delhi Capitals": "Delhi Capitals",
  "Gujarat Titans": "Gujarat Titans",
  "Kolkata Knight Riders": "Kolkata Knight Riders",
  "Lucknow Super Giants": "Lucknow Super Giants",
  "Mumbai Indians": "Mumbai Indians",
  "Punjab Kings": "Punjab Kings",
  "Rajasthan Royals": "Rajasthan Royals",
  "Royal Challengers Bengaluru": "Royal Challengers Bangalore",
  "Sunrisers Hyderabad": "Sunrisers Hyderabad",
};

type CelebEntry = {
  name: string;
  categorySlug: string;
  comment: string;
};

/** Random integer in [min, max] (inclusive) */
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Popularity tiers for politicians — higher tier = more initial votes.
 * Tier 1: National icons / PM-level        → respectors 8k-15k, dispiters 3k-7k
 * Tier 2: Major national leaders / CMs      → respectors 4k-8k,  dispiters 1.5k-4k
 * Tier 3: Senior ministers / state leaders   → respectors 1.5k-4k, dispiters 500-2k
 * Tier 4: Emerging / niche leaders           → respectors 300-1.5k, dispiters 100-800
 */
type Tier = 1 | 2 | 3 | 4;

/**
 * Fixed-order politicians get a specific base + small random offset
 * so their ranking is guaranteed while still looking organic.
 */
const FIXED_ORDER_POLITICIANS: Record<string, { respectors: number; dispiters: number }> = {
  "Narendra Modi":   { respectors: 15000, dispiters: 6500 },
  "Rahul Gandhi":    { respectors: 13500, dispiters: 5800 },
  "Yogi Adityanath": { respectors: 12000, dispiters: 5200 },
  "Arvind Kejriwal": { respectors: 10500, dispiters: 4500 },
  "Amit Shah":       { respectors: 9500,  dispiters: 4000 },
};

const POLITICIAN_TIERS: Record<string, Tier> = {
  // ── Tier 1: National icons (after the fixed-order five) ──
  "Droupadi Murmu": 1,
  "Sonia Gandhi": 1,

  // ── Tier 2: Major national leaders / prominent CMs ──
  "Priyanka Gandhi": 2,
  "Mamata Banerjee": 2,
  "Nirmala Sitharaman": 2,
  "Akhilesh Yadav": 2,
  "Rajnath Singh": 2,
  "S. Jaishankar": 2,
  "Mallikarjun Kharge": 2,
  "Sharad Pawar": 2,
  "Mayawati": 2,
  "Lalu Prasad Yadav": 2,
  "Nitish Kumar": 2,
  "Shashi Tharoor": 2,
  "Chandrababu Naidu": 2,
  "Smriti Irani": 2,
  "Uddhav Thackeray": 2,
  "Asaduddin Owaisi": 2,

  // ── Tier 3: Senior ministers / state leaders ──
  "MK Stalin": 3,
  "Tejashwi Yadav": 3,
  "Hemant Soren": 3,
  "JP Nadda": 3,
  "Nitin Gadkari": 3,
  "Pinarayi Vijayan": 3,
  "Omar Abdullah": 3,
  "Himanta Biswa Sarma": 3,
  "KCR": 3,
  "Naveen Patnaik": 3,
  "Eknath Shinde": 3,
  "Ajit Pawar": 3,
  "Jagan Mohan Reddy": 3,
  "Ashok Gehlot": 3,
  "Shivraj Singh Chouhan": 3,
  "Piyush Goyal": 3,
  "Subramanian Swamy": 3,
  "Jyotiraditya Scindia": 3,
  "Mehbooba Mufti": 3,
  "Farooq Abdullah": 3,

  // ── Tier 4: Emerging / niche leaders ──
  "Chandrashekhar Azad": 4,
  "Pushkar Singh Dhami": 4,
  "Basavaraj Bommai": 4,
  "Manohar Lal Khattar": 4,
  "Prashant Kishor": 4,
};

function getVotesForPolitician(name: string): { respectors: number; dispiters: number } {
  const fixed = FIXED_ORDER_POLITICIANS[name];
  if (fixed) {
    return {
      respectors: fixed.respectors + rand(0, 400),
      dispiters: fixed.dispiters + rand(0, 300),
    };
  }
  const tier = POLITICIAN_TIERS[name] ?? 4;
  switch (tier) {
    case 1: return { respectors: rand(7000, 8500),  dispiters: rand(3000, 5000) };
    case 2: return { respectors: rand(4000, 6500),   dispiters: rand(1500, 3500) };
    case 3: return { respectors: rand(1500, 3500),   dispiters: rand(500, 1800) };
    case 4: return { respectors: rand(300, 1500),    dispiters: rand(100, 800) };
  }
}

/**
 * Actor popularity tiers
 * Tier 1: Mega superstars              → respectors 10k-18k, dispiters 2k-5k
 * Tier 2: A-list stars                 → respectors 5k-10k,  dispiters 1k-3k
 * Tier 3: Popular / rising stars       → respectors 2k-5k,   dispiters 500-2k
 */
const ACTOR_TIERS: Record<string, Tier> = {
  // ── Tier 1: Mega superstars ──
  "Shah Rukh Khan": 1,
  "Amitabh Bachchan": 1,
  "Salman Khan": 1,
  "Rajinikanth": 1,
  "Allu Arjun": 1,

  // ── Tier 2: A-list stars ──
  "Aamir Khan": 2,
  "Deepika Padukone": 2,
  "Ranveer Singh": 2,
  "Priyanka Chopra": 2,
  "Akshay Kumar": 2,
  "Vijay (Thalapathy)": 2,
  "Prabhas": 2,
  "Ranbir Kapoor": 2,
  "Alia Bhatt": 2,

  // ── Tier 3: Popular ──
  "Katrina Kaif": 3,
};

function getVotesForActor(name: string): { respectors: number; dispiters: number } {
  const tier = ACTOR_TIERS[name] ?? 3;
  switch (tier) {
    case 1: return { respectors: rand(10000, 18000), dispiters: rand(2000, 5000) };
    case 2: return { respectors: rand(5000, 10000),  dispiters: rand(1000, 3000) };
    case 3: return { respectors: rand(2000, 5000),   dispiters: rand(500, 2000) };
    default: return { respectors: rand(2000, 5000),  dispiters: rand(500, 2000) };
  }
}

/**
 * Cricketer popularity tiers
 * Tier 1: Legends / mega icons         → respectors 12k-20k, dispiters 1k-4k
 * Tier 2: Current top stars            → respectors 5k-12k,  dispiters 800-3k
 * Tier 3: Established players          → respectors 2k-5k,   dispiters 300-1.5k
 * Tier 4: Rising / newer players       → respectors 500-2k,  dispiters 100-800
 */
const CRICKETER_TIERS: Record<string, Tier> = {
  // ── Tier 1: Legends / mega icons ──
  "Virat Kohli": 1,
  "Sachin Tendulkar": 1,
  "MS Dhoni": 1,
  "Rohit Sharma": 1,

  // ── Tier 2: Current top stars ──
  "Jasprit Bumrah": 2,
  "Hardik Pandya": 2,
  "Sourav Ganguly": 2,
  "Yuvraj Singh": 2,
  "Rishabh Pant": 2,
  "Suryakumar Yadav": 2,
  "KL Rahul": 2,
  "Shubman Gill": 2,
  "Ravindra Jadeja": 2,
  "Smriti Mandhana": 2,

  // ── Tier 3: Established players ──
  "Yashasvi Jaiswal": 3,
  "Mohammed Siraj": 3,
  "Kuldeep Yadav": 3,
  "Shreyas Iyer": 3,
  "Axar Patel": 3,
  "Sanju Samson": 3,
  "Arshdeep Singh": 3,
  "Rinku Singh": 3,

  // ── Tier 4: Rising / newer players ──
  "Tilak Varma": 4,
  "Washington Sundar": 4,
  "Varun Chakaravarthy": 4,
  "Nitish Kumar Reddy": 4,
  "Ruturaj Gaikwad": 4,
  "Shivam Dube": 4,
  "Ravi Bishnoi": 4,
  "Abhishek Sharma": 4,
  "Dhruv Jurel": 4,
  "Harshit Rana": 4,
  "Prasidh Krishna": 4,
  "Sai Sudharsan": 4,
  "Akash Deep": 4,
};

function getVotesForCricketer(name: string): { respectors: number; dispiters: number } {
  const tier = CRICKETER_TIERS[name] ?? 4;
  switch (tier) {
    case 1: return { respectors: rand(12000, 20000), dispiters: rand(1000, 4000) };
    case 2: return { respectors: rand(5000, 12000),  dispiters: rand(800, 3000) };
    case 3: return { respectors: rand(2000, 5000),   dispiters: rand(300, 1500) };
    case 4: return { respectors: rand(500, 2000),    dispiters: rand(100, 800) };
  }
}

/**
 * IPL Team popularity tiers
 * Tier 1: Most popular / most titles   → respectors 15k-25k, dispiters 3k-8k
 * Tier 2: Strong fanbases              → respectors 7k-15k,  dispiters 2k-5k
 * Tier 3: Growing / newer franchises   → respectors 3k-7k,   dispiters 1k-3k
 */
const IPL_TIERS: Record<string, 1 | 2 | 3> = {
  // ── Tier 1: Most popular ──
  "Chennai Super Kings": 1,
  "Mumbai Indians": 1,
  "Royal Challengers Bengaluru": 1,
  "Kolkata Knight Riders": 1,

  // ── Tier 2: Strong fanbases ──
  "Rajasthan Royals": 2,
  "Sunrisers Hyderabad": 2,
  "Delhi Capitals": 2,
  "Punjab Kings": 2,

  // ── Tier 3: Newer franchises ──
  "Gujarat Titans": 3,
  "Lucknow Super Giants": 3,
};

function getVotesForIPL(name: string): { respectors: number; dispiters: number } {
  const tier = IPL_TIERS[name] ?? 3;
  switch (tier) {
    case 1: return { respectors: rand(15000, 25000), dispiters: rand(3000, 8000) };
    case 2: return { respectors: rand(7000, 15000),  dispiters: rand(2000, 5000) };
    case 3: return { respectors: rand(3000, 7000),   dispiters: rand(1000, 3000) };
  }
}

const CELEBS: CelebEntry[] = [
  // ───────── POLITICIANS ─────────
  { name: "Narendra Modi", categorySlug: "politician", comment: "Prime Minister of India" },
  { name: "Rahul Gandhi", categorySlug: "politician", comment: "Leader of Opposition, INC" },
  { name: "Arvind Kejriwal", categorySlug: "politician", comment: "AAP National Convenor" },
  { name: "Amit Shah", categorySlug: "politician", comment: "Home Minister of India" },
  { name: "Yogi Adityanath", categorySlug: "politician", comment: "Chief Minister of Uttar Pradesh" },
  { name: "Smriti Irani", categorySlug: "politician", comment: "Senior BJP Leader & Former Minister" },
  { name: "Priyanka Gandhi", categorySlug: "politician", comment: "INC General Secretary & MP" },
  { name: "Shashi Tharoor", categorySlug: "politician", comment: "INC MP & celebrated Author" },
  { name: "Mamata Banerjee", categorySlug: "politician", comment: "Chief Minister of West Bengal" },
  { name: "Nirmala Sitharaman", categorySlug: "politician", comment: "Finance Minister of India" },
  { name: "Akhilesh Yadav", categorySlug: "politician", comment: "SP Chief & Former UP CM" },
  { name: "MK Stalin", categorySlug: "politician", comment: "Chief Minister of Tamil Nadu" },
  { name: "Tejashwi Yadav", categorySlug: "politician", comment: "RJD Leader & Bihar Opposition Leader" },
  { name: "Hemant Soren", categorySlug: "politician", comment: "Chief Minister of Jharkhand" },
  { name: "Chandrashekhar Azad", categorySlug: "politician", comment: "Dalit Rights Leader & MP" },
  { name: "Rajnath Singh", categorySlug: "politician", comment: "Defence Minister of India" },
  { name: "S. Jaishankar", categorySlug: "politician", comment: "Minister of External Affairs" },
  { name: "Sonia Gandhi", categorySlug: "politician", comment: "Senior INC Leader & Former President" },
  { name: "Mallikarjun Kharge", categorySlug: "politician", comment: "President of Indian National Congress" },
  { name: "JP Nadda", categorySlug: "politician", comment: "BJP National President & Union Health Minister" },
  { name: "Nitin Gadkari", categorySlug: "politician", comment: "Union Minister for Road Transport & Highways" },
  { name: "Sharad Pawar", categorySlug: "politician", comment: "NCP-SP President & Veteran Leader" },
  { name: "Mayawati", categorySlug: "politician", comment: "BSP President & Former UP CM" },
  { name: "Lalu Prasad Yadav", categorySlug: "politician", comment: "RJD Founder & Former Bihar CM" },
  { name: "Nitish Kumar", categorySlug: "politician", comment: "Chief Minister of Bihar, JD(U) Leader" },
  { name: "Chandrababu Naidu", categorySlug: "politician", comment: "Chief Minister of Andhra Pradesh, TDP President" },
  { name: "Pinarayi Vijayan", categorySlug: "politician", comment: "Chief Minister of Kerala" },
  { name: "Omar Abdullah", categorySlug: "politician", comment: "Chief Minister of Jammu & Kashmir" },
  { name: "Himanta Biswa Sarma", categorySlug: "politician", comment: "Chief Minister of Assam" },
  { name: "Pushkar Singh Dhami", categorySlug: "politician", comment: "Chief Minister of Uttarakhand" },
  { name: "KCR", categorySlug: "politician", comment: "TRS Founder & Former Telangana CM" },
  { name: "Naveen Patnaik", categorySlug: "politician", comment: "BJD President & Former Odisha CM" },
  { name: "Uddhav Thackeray", categorySlug: "politician", comment: "Shiv Sena (UBT) Leader & Former Maharashtra CM" },
  { name: "Eknath Shinde", categorySlug: "politician", comment: "Shiv Sena Leader & Former Maharashtra CM" },
  { name: "Ajit Pawar", categorySlug: "politician", comment: "Deputy Chief Minister of Maharashtra" },
  { name: "Jagan Mohan Reddy", categorySlug: "politician", comment: "YSRCP President & Former AP CM" },
  { name: "Ashok Gehlot", categorySlug: "politician", comment: "Senior Congress Leader & Former Rajasthan CM" },
  { name: "Basavaraj Bommai", categorySlug: "politician", comment: "Senior BJP Leader & Former Karnataka CM" },
  { name: "Shivraj Singh Chouhan", categorySlug: "politician", comment: "Union Agriculture Minister & Former MP CM" },
  { name: "Piyush Goyal", categorySlug: "politician", comment: "Union Minister for Commerce & Industry" },
  { name: "Manohar Lal Khattar", categorySlug: "politician", comment: "Union Minister for Housing & Urban Affairs" },
  { name: "Jyotiraditya Scindia", categorySlug: "politician", comment: "Union Minister for Civil Aviation & Steel" },
  { name: "Asaduddin Owaisi", categorySlug: "politician", comment: "AIMIM President & Hyderabad MP" },
  { name: "Mehbooba Mufti", categorySlug: "politician", comment: "PDP President & Former J&K CM" },
  { name: "Subramanian Swamy", categorySlug: "politician", comment: "BJP Leader & Rajya Sabha MP" },
  { name: "Prashant Kishor", categorySlug: "politician", comment: "Jan Suraaj Party Founder & Political Strategist" },
  { name: "Droupadi Murmu", categorySlug: "politician", comment: "President of India" },
  { name: "Farooq Abdullah", categorySlug: "politician", comment: "JKNC President & Senior Leader" },

  // ───────── ACTORS ─────────
  { name: "Shah Rukh Khan", categorySlug: "actor", comment: "Bollywood's King & Global Icon" },
  { name: "Amitabh Bachchan", categorySlug: "actor", comment: "Legendary Bollywood Megastar" },
  { name: "Salman Khan", categorySlug: "actor", comment: "Bollywood Superstar & Bhai of Masses" },
  { name: "Aamir Khan", categorySlug: "actor", comment: "Perfectionist of Bollywood" },
  { name: "Deepika Padukone", categorySlug: "actor", comment: "Top Bollywood Actress & Global Star" },
  { name: "Ranveer Singh", categorySlug: "actor", comment: "Bollywood's Most Energetic Actor" },
  { name: "Priyanka Chopra", categorySlug: "actor", comment: "Bollywood Actress & Hollywood Star" },
  { name: "Akshay Kumar", categorySlug: "actor", comment: "Khiladi of Bollywood" },
  { name: "Katrina Kaif", categorySlug: "actor", comment: "Bollywood Actress & Beauty Icon" },
  { name: "Vijay (Thalapathy)", categorySlug: "actor", comment: "Tamil Superstar & Mass Hero" },
  { name: "Allu Arjun", categorySlug: "actor", comment: "Stylish Star of Telugu Cinema" },
  { name: "Rajinikanth", categorySlug: "actor", comment: "Thalaiva, Tamil Cinema Legend" },
  { name: "Prabhas", categorySlug: "actor", comment: "Pan-India Star, Baahubali Fame" },
  { name: "Ranbir Kapoor", categorySlug: "actor", comment: "Bollywood's Versatile Actor" },
  { name: "Alia Bhatt", categorySlug: "actor", comment: "Award-Winning Bollywood Actress" },

  // ───────── CRICKETERS ─────────
  { name: "Virat Kohli", categorySlug: "cricketer", comment: "Former Indian Captain & Run Machine" },
  { name: "Rohit Sharma", categorySlug: "cricketer", comment: "Indian T20 World Cup Winning Captain" },
  { name: "MS Dhoni", categorySlug: "cricketer", comment: "India's Most Successful Captain, CSK Legend" },
  { name: "Sachin Tendulkar", categorySlug: "cricketer", comment: "God of Cricket, 100 International Centuries" },
  { name: "Jasprit Bumrah", categorySlug: "cricketer", comment: "World's Best Pace Bowler" },
  { name: "Hardik Pandya", categorySlug: "cricketer", comment: "Indian All-Rounder & MI Captain" },
  { name: "Shubman Gill", categorySlug: "cricketer", comment: "India's Future Batting Star" },
  { name: "Ravindra Jadeja", categorySlug: "cricketer", comment: "Sir Jadeja — Elite All-Rounder" },
  { name: "KL Rahul", categorySlug: "cricketer", comment: "Stylish Indian Opener & Wicketkeeper" },
  { name: "Sourav Ganguly", categorySlug: "cricketer", comment: "Dada, Former Captain & BCCI President" },
  { name: "Suryakumar Yadav", categorySlug: "cricketer", comment: "T20 World #1 Batter, 360° Player" },
  { name: "Yuvraj Singh", categorySlug: "cricketer", comment: "2011 WC Hero & Six Sixes Legend" },
  { name: "Rishabh Pant", categorySlug: "cricketer", comment: "India's Star Wicketkeeper-Batsman" },
  { name: "Mohammed Siraj", categorySlug: "cricketer", comment: "India's Ace Fast Bowler" },
  { name: "Smriti Mandhana", categorySlug: "cricketer", comment: "India Women's Cricket Star" },
  { name: "Yashasvi Jaiswal", categorySlug: "cricketer", comment: "Young Indian Opener & Test Star" },
  { name: "Kuldeep Yadav", categorySlug: "cricketer", comment: "India's Premier Wrist Spinner" },
  { name: "Shreyas Iyer", categorySlug: "cricketer", comment: "Stylish Middle-Order Batsman" },
  { name: "Axar Patel", categorySlug: "cricketer", comment: "India's Spin All-Rounder" },
  { name: "Sanju Samson", categorySlug: "cricketer", comment: "Explosive Wicketkeeper-Batsman" },
  { name: "Arshdeep Singh", categorySlug: "cricketer", comment: "India's Left-Arm Pace Sensation" },
  { name: "Tilak Varma", categorySlug: "cricketer", comment: "Rising Young Indian Batsman" },
  { name: "Rinku Singh", categorySlug: "cricketer", comment: "India's Clutch Finisher" },
  { name: "Washington Sundar", categorySlug: "cricketer", comment: "Spin-Bowling All-Rounder" },
  { name: "Varun Chakaravarthy", categorySlug: "cricketer", comment: "Mystery Spinner & T20 Specialist" },
  { name: "Nitish Kumar Reddy", categorySlug: "cricketer", comment: "Young All-Rounder & Rising Star" },
  { name: "Ruturaj Gaikwad", categorySlug: "cricketer", comment: "CSK Captain & Elegant Batsman" },
  { name: "Shivam Dube", categorySlug: "cricketer", comment: "Power-Hitting All-Rounder" },
  { name: "Ravi Bishnoi", categorySlug: "cricketer", comment: "Young Leg-Spinner & T20 Specialist" },
  { name: "Abhishek Sharma", categorySlug: "cricketer", comment: "Explosive Opening All-Rounder" },
  { name: "Dhruv Jurel", categorySlug: "cricketer", comment: "Young Wicketkeeper-Batsman" },
  { name: "Harshit Rana", categorySlug: "cricketer", comment: "Young Fast Bowler & KKR Star" },
  { name: "Prasidh Krishna", categorySlug: "cricketer", comment: "Tall Indian Fast Bowler" },
  { name: "Sai Sudharsan", categorySlug: "cricketer", comment: "Emerging Indian Batsman" },
  { name: "Akash Deep", categorySlug: "cricketer", comment: "India's Rising Pace Bowler" },

  // ───────── IPL TEAMS ─────────
  { name: "Chennai Super Kings", categorySlug: "ipl-team", comment: "5× Champions (2010, 2011, 2018, 2021, 2023) — Whistle Podu!" },
  { name: "Mumbai Indians", categorySlug: "ipl-team", comment: "5× Champions (2013, 2015, 2017, 2019, 2020) — Duniya Hila Denge" },
  { name: "Kolkata Knight Riders", categorySlug: "ipl-team", comment: "3× Champions (2012, 2014, 2024) — Korbo Lorbo Jeetbo" },
  { name: "Royal Challengers Bengaluru", categorySlug: "ipl-team", comment: "1× Champions (2025) — Ee Sala Cup Namde!" },
  { name: "Rajasthan Royals", categorySlug: "ipl-team", comment: "1× Champions (2008) — Inaugural IPL Winners" },
  { name: "Sunrisers Hyderabad", categorySlug: "ipl-team", comment: "1× Champions (2016) — Orange Army" },
  { name: "Gujarat Titans", categorySlug: "ipl-team", comment: "1× Champions (2022) — Won Title in Debut Season" },
  { name: "Delhi Capitals", categorySlug: "ipl-team", comment: "IPL Finalists (2020) — Delhi's Pride" },
  { name: "Punjab Kings", categorySlug: "ipl-team", comment: "Sadda Punjab — The Eternal Entertainers" },
  { name: "Lucknow Super Giants", categorySlug: "ipl-team", comment: "Newest Franchise — Rising Force in IPL" },
];

async function seed() {
  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected");

  // Clear existing data
  await Celeb.deleteMany({});
  await Category.deleteMany({});
  console.log("🗑️  Cleared existing data");

  // Create categories
  const categoryMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const result = await Category.create(cat);
    categoryMap[cat.slug] = result._id.toString();
  }
  console.log(`📂 Seeded ${CATEGORIES.length} categories`);

  // Create celebs with Wikipedia images
  let found = 0;
  let fallback = 0;

  for (let i = 0; i < CELEBS.length; i++) {
    const celeb = CELEBS[i];
    const wikiName = WIKI_NAMES[celeb.name] ?? celeb.name;
    const wikiImage = await fetchWikiImage(wikiName);

    const image = wikiImage ?? avatar(celeb.name);
    if (wikiImage) found++;
    else fallback++;

    const votes =
      celeb.categorySlug === "politician" ? getVotesForPolitician(celeb.name) :
      celeb.categorySlug === "actor"      ? getVotesForActor(celeb.name) :
      celeb.categorySlug === "cricketer"  ? getVotesForCricketer(celeb.name) :
      celeb.categorySlug === "ipl-team"   ? getVotesForIPL(celeb.name) :
      { respectors: 0, dispiters: 0 };

    await Celeb.create({
      name: celeb.name,
      image,
      comment: celeb.comment,
      respectors: votes.respectors,
      dispiters: votes.dispiters,
      category: categoryMap[celeb.categorySlug],
    });

    const icon = wikiImage ? "✅" : "🔤";
    process.stdout.write(`\r${icon} [${i + 1}/${CELEBS.length}] ${celeb.name.padEnd(40)}`);
  }

  console.log(`\n\n📸 Wikipedia images: ${found} | 🔤 Fallback avatars: ${fallback}`);

  await mongoose.disconnect();
  console.log("✅ Done!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
