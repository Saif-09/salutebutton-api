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
  { name: "Businessman", slug: "businessman", order: 4 },
  { name: "Celebrity", slug: "celebrity", order: 5 },
  { name: "Youtuber", slug: "youtuber", order: 6 },
  { name: "Athlete", slug: "athlete", order: 7 },
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
  "CarryMinati (Ajey Nagar)": "CarryMinati",
  "BB Ki Vines (Bhuvan Bam)": "Bhuvan Bam",
  "Technical Guruji (Gaurav Chaudhary)": "Gaurav Chaudhary",
  "Nikhil Sharma (Mumbiker Nikhil)": "Mumbiker Nikhil",
  "Triggered Insaan (Nischay Malhan)": "Triggered Insaan",
  "Ranveer Allahbadia (BeerBiceps)": "Ranveer Allahbadia",
  "Prajakta Koli (MostlySane)": "Prajakta Koli",
  "Ajju Bhai (Total Gaming)": "Total Gaming (YouTuber)",
  "Nikunj Lotia (Be YouNick)": "Be YouNick",
  "Zepto Founders (Aadit & Kaivalya)": "Zepto (company)",
  "N R Narayana Murthy": "N. R. Narayana Murthy",
  "MK Stalin": "M. K. Stalin",
  "Chandrashekhar Azad": "Chandrashekhar Aazad",
  "MS Dhoni": "MS Dhoni",
  "KL Rahul": "KL Rahul",
  "PV Sindhu": "P. V. Sindhu",
  "AR Rahman": "A. R. Rahman",
  "PR Sreejesh": "P. R. Sreejesh",
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

  // ───────── BUSINESSMEN ─────────
  { name: "Mukesh Ambani", categorySlug: "businessman", comment: "Chairman, Reliance Industries — Richest Indian" },
  { name: "Gautam Adani", categorySlug: "businessman", comment: "Chairman, Adani Group" },
  { name: "Ratan Tata", categorySlug: "businessman", comment: "Former Chairman, Tata Group — Beloved Icon" },
  { name: "Sundar Pichai", categorySlug: "businessman", comment: "CEO, Google & Alphabet" },
  { name: "Azim Premji", categorySlug: "businessman", comment: "Former Chairman, Wipro — Philanthropist" },
  { name: "Anand Mahindra", categorySlug: "businessman", comment: "Chairman, Mahindra Group" },
  { name: "N R Narayana Murthy", categorySlug: "businessman", comment: "Co-Founder, Infosys" },
  { name: "Kumar Mangalam Birla", categorySlug: "businessman", comment: "Chairman, Aditya Birla Group" },
  { name: "Byju Raveendran", categorySlug: "businessman", comment: "Founder, BYJU'S EdTech" },
  { name: "Ritesh Agarwal", categorySlug: "businessman", comment: "Founder & CEO, OYO Rooms" },
  { name: "Vijay Shekhar Sharma", categorySlug: "businessman", comment: "Founder & CEO, Paytm" },
  { name: "Deep Kalra", categorySlug: "businessman", comment: "Co-Founder, MakeMyTrip" },
  { name: "Falguni Nayar", categorySlug: "businessman", comment: "Founder & CEO, Nykaa" },
  { name: "Zepto Founders (Aadit & Kaivalya)", categorySlug: "businessman", comment: "Co-Founders, Zepto — Quick Commerce Disruptors" },
  { name: "Kunal Shah", categorySlug: "businessman", comment: "Founder, CRED — Fintech Visionary" },

  // ───────── CELEBRITIES ─────────
  { name: "Virat Kohli", categorySlug: "celebrity", comment: "Cricket Star & Brand Icon" },
  { name: "Anushka Sharma", categorySlug: "celebrity", comment: "Actress, Producer & Style Icon" },
  { name: "Karan Johar", categorySlug: "celebrity", comment: "Bollywood Director, Producer & Host" },
  { name: "Sonam Kapoor", categorySlug: "celebrity", comment: "Fashion Icon & Actress" },
  { name: "Hrithik Roshan", categorySlug: "celebrity", comment: "Bollywood's Greek God" },
  { name: "Disha Patani", categorySlug: "celebrity", comment: "Actress & Social Media Sensation" },
  { name: "Urvashi Rautela", categorySlug: "celebrity", comment: "Actress & Miss Universe India" },
  { name: "Kapil Sharma", categorySlug: "celebrity", comment: "India's Most Popular Stand-Up Comedian & Host" },
  { name: "Badshah", categorySlug: "celebrity", comment: "Indian Rapper & Music Producer" },
  { name: "Diljit Dosanjh", categorySlug: "celebrity", comment: "Punjabi Singer & Bollywood Actor" },
  { name: "Neha Kakkar", categorySlug: "celebrity", comment: "Popular Indian Playback Singer" },
  { name: "AR Rahman", categorySlug: "celebrity", comment: "Oscar-Winning Music Composer" },
  { name: "Arijit Singh", categorySlug: "celebrity", comment: "India's Most Loved Playback Singer" },
  { name: "Tamannaah Bhatia", categorySlug: "celebrity", comment: "South & Bollywood Actress & Style Star" },
  { name: "Sonu Sood", categorySlug: "celebrity", comment: "Actor & Real-Life Hero (COVID relief)" },

  // ───────── YOUTUBERS ─────────
  { name: "CarryMinati (Ajey Nagar)", categorySlug: "youtuber", comment: "India's #1 Roaster & YouTuber" },
  { name: "BB Ki Vines (Bhuvan Bam)", categorySlug: "youtuber", comment: "Pioneer of Indian YouTube Comedy" },
  { name: "Ashish Chanchlani", categorySlug: "youtuber", comment: "Comedy YouTuber & Actor" },
  { name: "Technical Guruji (Gaurav Chaudhary)", categorySlug: "youtuber", comment: "India's Biggest Tech YouTuber" },
  { name: "Sandeep Maheshwari", categorySlug: "youtuber", comment: "Motivational Speaker & Life Coach" },
  { name: "Amit Bhadana", categorySlug: "youtuber", comment: "Most Subscribed Indian YouTuber (Hindi)" },
  { name: "Vivek Bindra", categorySlug: "youtuber", comment: "Business Coach & Motivational YouTuber" },
  { name: "Dhruv Rathee", categorySlug: "youtuber", comment: "Political & Social Commentary YouTuber" },
  { name: "Nikhil Sharma (Mumbiker Nikhil)", categorySlug: "youtuber", comment: "Travel & Lifestyle Vlogger" },
  { name: "Triggered Insaan (Nischay Malhan)", categorySlug: "youtuber", comment: "Reaction & Comedy YouTuber" },
  { name: "Ranveer Allahbadia (BeerBiceps)", categorySlug: "youtuber", comment: "Podcast Host & Mindset Coach" },
  { name: "Prajakta Koli (MostlySane)", categorySlug: "youtuber", comment: "Female Comedy Creator & Netflix Actor" },
  { name: "Elvish Yadav", categorySlug: "youtuber", comment: "Comedy YouTuber & Bigg Boss OTT Winner" },
  { name: "Ajju Bhai (Total Gaming)", categorySlug: "youtuber", comment: "India's Biggest Gaming YouTuber" },
  { name: "Nikunj Lotia (Be YouNick)", categorySlug: "youtuber", comment: "Comedy Sketch & Entertainment Creator" },

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

  // ───────── ATHLETES ─────────
  { name: "Neeraj Chopra", categorySlug: "athlete", comment: "Olympic Gold Medallist — Javelin Throw" },
  { name: "PV Sindhu", categorySlug: "athlete", comment: "2x Olympic Badminton Medallist" },
  { name: "Mary Kom", categorySlug: "athlete", comment: "6x World Boxing Champion & Olympian" },
  { name: "Bajrang Punia", categorySlug: "athlete", comment: "Olympic Bronze Medallist — Wrestling" },
  { name: "Saina Nehwal", categorySlug: "athlete", comment: "Former World #1 Badminton Player" },
  { name: "Mirabai Chanu", categorySlug: "athlete", comment: "Olympic Silver Medallist — Weightlifting" },
  { name: "Kidambi Srikanth", categorySlug: "athlete", comment: "Former World #1 Badminton Player" },
  { name: "Vinesh Phogat", categorySlug: "athlete", comment: "Top Indian Wrestler & Arjuna Awardee" },
  { name: "Sumit Antil", categorySlug: "athlete", comment: "Paralympic Gold Medallist — Javelin" },
  { name: "Lovlina Borgohain", categorySlug: "athlete", comment: "Olympic Bronze Medallist — Boxing" },
  { name: "Abhinav Bindra", categorySlug: "athlete", comment: "India's First Individual Olympic Gold Medallist" },
  { name: "Dutee Chand", categorySlug: "athlete", comment: "India's Fastest Female Sprinter" },
  { name: "Sunil Chhetri", categorySlug: "athlete", comment: "India's Football Captain & Legendary Striker" },
  { name: "Rohan Bopanna", categorySlug: "athlete", comment: "India's Top Tennis Player" },
  { name: "PR Sreejesh", categorySlug: "athlete", comment: "Olympic Bronze Medallist — Hockey Goalkeeper" },
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
