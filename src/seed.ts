import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

const CATEGORIES = [
  { name: "Politician", slug: "politician", order: 1 },
  { name: "Cricketer", slug: "cricketer", order: 2 },
  { name: "Actor", slug: "actor", order: 3 },
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
};

type CelebEntry = {
  name: string;
  categorySlug: string;
  comment: string;
};

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

    await Celeb.create({
      name: celeb.name,
      image,
      comment: celeb.comment,
      respectors: 0,
      dispiters: 0,
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
