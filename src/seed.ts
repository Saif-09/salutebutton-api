import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

const CATEGORIES = [
  { name: "Political Party", slug: "political-party", order: 1 },
  { name: "Politician", slug: "politician", order: 2 },
  { name: "Cricketer", slug: "cricketer", order: 3 },
  { name: "IPL Team", slug: "ipl-team", order: 4 },
  { name: "Actor", slug: "actor", order: 5 },
];

function avatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=500&background=random&bold=true&format=png`;
}

// Fetch image from Wikipedia — tries the REST summary endpoint first,
// then falls back to the MediaWiki action API's pageimages prop.
async function fetchWikiImage(name: string): Promise<string | null> {
  const headers = { "User-Agent": "SaluteButton/1.0 (seed script)" };

  // 1) REST summary endpoint (fast, returns thumbnail for most pages)
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data: any = await res.json();
      const hit = data?.thumbnail?.source ?? data?.originalimage?.source;
      if (hit) return hit;
    }
  } catch {
    /* fall through */
  }

  // 2) MediaWiki action API — explicitly asks for the page's lead image.
  // Handles pages where the summary endpoint omits the thumbnail.
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=pageimages&piprop=original|thumbnail&pithumbsize=500` +
      `&redirects=1&titles=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data: any = await res.json();
    const pages = data?.query?.pages ?? {};
    const first: any = Object.values(pages)[0];
    return (
      first?.original?.source ??
      first?.thumbnail?.source ??
      null
    );
  } catch {
    return null;
  }
}

// Map of Wikipedia article names (for those whose names differ from article titles)
const WIKI_NAMES: Record<string, string> = {
  "Vijay (Thalapathy)": "Vijay (actor)",
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

  // Political Parties — Wikipedia article titles where they differ from display names
  "BJP": "Bharatiya Janata Party",
  "INC": "Indian National Congress",
  "AAP": "Aam Aadmi Party",
  "BSP": "Bahujan Samaj Party",
  "CPI(M)": "Communist Party of India (Marxist)",
  "NPP": "National People's Party (India)",
  "CJP": "Cockroach Janta Party",
  "TMC": "All India Trinamool Congress",
  "DMK": "Dravida Munnetra Kazhagam",
  "AIADMK": "All India Anna Dravida Munnetra Kazhagam",
  "TDP": "Telugu Desam Party",
  "YSRCP": "YSR Congress Party",
  "Shiv Sena (UBT)": "Shiv Sena (UBT)",
  "Shiv Sena": "Shiv Sena",
  "NCP": "Nationalist Congress Party",
  "NCP (SP)": "Nationalist Congress Party – Sharadchandra Pawar",
  "SP": "Samajwadi Party",
  "RJD": "Rashtriya Janata Dal",
  "JD(U)": "Janata Dal (United)",
  "BJD": "Biju Janata Dal",
  "CPI": "Communist Party of India",
  "SAD": "Shiromani Akali Dal",
  "JKNC": "Jammu and Kashmir National Conference",
  "PDP": "Jammu & Kashmir People's Democratic Party",
  "BRS": "Bharat Rashtra Samithi",
  "RLD": "Rashtriya Lok Dal",
  "LJP": "Lok Janshakti Party",
  "TVK": "Tamilaga Vettri Kazhagam",
};

/**
 * Verified Wikimedia Commons URLs — short-circuits fetchWikiImage so we never
 * depend on Wikipedia's REST summary endpoint, which intermittently omits
 * thumbnails for political party pages. Add an entry here whenever an
 * entry consistently falls back to a letter avatar.
 */
const EXPLICIT_IMAGES: Record<string, string> = {
  // National parties
  "BJP": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Logo_of_the_Bharatiya_Janata_Party.svg/500px-Logo_of_the_Bharatiya_Janata_Party.svg.png",
  "INC": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Indian_National_Congress_hand_logo.svg/500px-Indian_National_Congress_hand_logo.svg.png",
  "AAP": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Aam_Aadmi_Party_logo_%28English%29.svg/500px-Aam_Aadmi_Party_logo_%28English%29.svg.png",
  "BSP": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Elephant_Bahujan_Samaj_Party.svg/500px-Elephant_Bahujan_Samaj_Party.svg.png",
  "CPI(M)": "https://upload.wikimedia.org/wikipedia/commons/d/d3/CPI%28M%29_Official_Logo.png",
  "NPP": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Indian_Election_Symbol_Book.svg/500px-Indian_Election_Symbol_Book.svg.png",

  // Regional parties
  "TMC": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/All_India_Trinamool_Congress_logo_%283%29.svg/500px-All_India_Trinamool_Congress_logo_%283%29.svg.png",
  "DMK": "https://upload.wikimedia.org/wikipedia/en/5/5e/Dravida_Munnetra_Kazhagam_logo.png",
  "AIADMK": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Indian_Election_Symbol_Two_Leaves.svg/500px-Indian_Election_Symbol_Two_Leaves.svg.png",
  "TVK": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Indian_Election_Symbol_Whistle.svg/500px-Indian_Election_Symbol_Whistle.svg.png",
  "TDP": "https://upload.wikimedia.org/wikipedia/commons/2/25/Indian_Election_Symbol_Cycle_%28cropped%29.png",
  "YSRCP": "https://upload.wikimedia.org/wikipedia/commons/3/32/YSRCPLOGO.jpg",
  "BRS": "https://upload.wikimedia.org/wikipedia/commons/5/59/Indian_Election_Symbol_Car.png",
  "SP": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Samajwadi_Party.png",
  "RJD": "https://upload.wikimedia.org/wikipedia/en/2/27/RJD_Logo.jpg",
  "JD(U)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Janata_Dal_%28United%29_Flag.svg/500px-Janata_Dal_%28United%29_Flag.svg.png",
  "BJD": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Biju_Janata_Dal_logo.svg/500px-Biju_Janata_Dal_logo.svg.png",
  "Shiv Sena (UBT)": "https://upload.wikimedia.org/wikipedia/commons/c/c3/SS%28UBT%29_flag.png",
  "Shiv Sena": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Indian_Election_Symbol_Bow_And_Arrow2.svg/500px-Indian_Election_Symbol_Bow_And_Arrow2.svg.png",
  "NCP (SP)": "https://upload.wikimedia.org/wikipedia/commons/1/12/Indian_Election_Symbol_Man_Blowing_Turha.png",
  "NCP": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Ncp-logo.png",

  // Other recognized parties
  "CPI": "https://upload.wikimedia.org/wikipedia/commons/7/7a/CPI_symbol.svg",
  "SAD": "https://upload.wikimedia.org/wikipedia/commons/c/c2/SAD_flag.svg",
  "JKNC": "https://upload.wikimedia.org/wikipedia/commons/3/32/Flag_of_Jammu_and_Kashmir_%281936-1953%29.svg",
  "PDP": "https://upload.wikimedia.org/wikipedia/commons/a/a0/Indian_Election_Symbol_Ink_Pot_and_Pen.png",
  "RLD": "https://upload.wikimedia.org/wikipedia/commons/7/71/Rashtriya-Lok-Dal-620x413-1-620x400.jpg",
  "LJP": "https://upload.wikimedia.org/wikipedia/commons/6/69/Ljp.gif",

  // Satire
  "CJP": "https://upload.wikimedia.org/wikipedia/commons/4/44/Cockroach_Janta_Party_%28icon%29.png",

  // New CM portraits (helps the entries added in the 2026 update)
  "C. Joseph Vijay": "https://upload.wikimedia.org/wikipedia/commons/6/66/The_official_portrait_of_C_Joseph_Vijay%2C_the_Chief_Minister_of_Tamilnadu.jpg",
  "Suvendu Adhikari": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Suvendu_Adhikari_at_Esplanade_Metro_Rail_Station%2C_Kolkata%2C_6_March_2024.jpg",
  "Samrat Choudhary": "https://upload.wikimedia.org/wikipedia/commons/7/73/Chief_Minister_Samrat_Chaudhary%28cropped%29.jpg",
  "N. Rangasamy": "https://upload.wikimedia.org/wikipedia/commons/7/71/N_Rangaswamy.jpg",
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
  "C. Joseph Vijay": 2,
  "Suvendu Adhikari": 2,
  "Samrat Choudhary": 2,
  "Himanta Biswa Sarma": 2,
  "Nirmala Sitharaman": 2,
  "Akhilesh Yadav": 2,
  "Rajnath Singh": 2,
  "S. Jaishankar": 2,
  "Mallikarjun Kharge": 2,
  "Sharad Pawar": 2,
  "Mayawati": 2,
  "Lalu Prasad Yadav": 2,
  "Shashi Tharoor": 2,
  "Chandrababu Naidu": 2,
  "Smriti Irani": 2,
  "Uddhav Thackeray": 2,
  "Asaduddin Owaisi": 2,

  // ── Tier 3: Senior ministers / state leaders ──
  "Tejashwi Yadav": 3,
  "Hemant Soren": 3,
  "JP Nadda": 3,
  "Nitin Gadkari": 3,
  "Pinarayi Vijayan": 3,
  "Omar Abdullah": 3,
  "N. Rangasamy": 3,
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

/**
 * Political Party popularity tiers
 * Tier 1: National giants                  → respectors 12k-20k, dispiters 4k-9k
 * Tier 2: Major national / large regional  → respectors 5k-10k,  dispiters 2k-5k
 * Tier 3: Established regional             → respectors 2k-5k,   dispiters 800-2.5k
 * Tier 4: Niche / satire                   → respectors 300-1.5k, dispiters 100-800
 */
const PARTY_TIERS: Record<string, Tier> = {
  // ── Tier 1: National giants ──
  "BJP": 1,
  "INC": 1,

  // ── Tier 2: Major national / large regional ──
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

  // ── Tier 3: Established regional ──
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

  // ── Tier 4: Niche / satire ──
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
  { name: "Suvendu Adhikari", categorySlug: "politician", comment: "Chief Minister of West Bengal" },
  { name: "Nirmala Sitharaman", categorySlug: "politician", comment: "Finance Minister of India" },
  { name: "Akhilesh Yadav", categorySlug: "politician", comment: "SP Chief & Former UP CM" },
  { name: "C. Joseph Vijay", categorySlug: "politician", comment: "Chief Minister of Tamil Nadu, TVK Founder" },
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
  { name: "Samrat Choudhary", categorySlug: "politician", comment: "Chief Minister of Bihar, BJP Leader" },
  { name: "Chandrababu Naidu", categorySlug: "politician", comment: "Chief Minister of Andhra Pradesh, TDP President" },
  { name: "Pinarayi Vijayan", categorySlug: "politician", comment: "Chief Minister of Kerala" },
  { name: "Omar Abdullah", categorySlug: "politician", comment: "Chief Minister of Jammu & Kashmir" },
  { name: "Himanta Biswa Sarma", categorySlug: "politician", comment: "Chief Minister of Assam (Re-elected 2026)" },
  { name: "Pushkar Singh Dhami", categorySlug: "politician", comment: "Chief Minister of Uttarakhand" },
  { name: "N. Rangasamy", categorySlug: "politician", comment: "Chief Minister of Puducherry, AINRC Founder" },
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

  // ───────── POLITICAL PARTIES ─────────
  // National Parties
  { name: "BJP", categorySlug: "political-party", comment: "Bharatiya Janata Party — Lotus 🪷 | Right-wing, leads NDA at the Centre" },
  { name: "INC", categorySlug: "political-party", comment: "Indian National Congress — Hand ✋ | Centre to centre-left, main opposition" },
  { name: "AAP", categorySlug: "political-party", comment: "Aam Aadmi Party — Broom 🧹 | Welfarist, strong in Delhi & Punjab" },
  { name: "BSP", categorySlug: "political-party", comment: "Bahujan Samaj Party — Elephant 🐘 | Dalit empowerment & social justice" },
  { name: "CPI(M)", categorySlug: "political-party", comment: "Communist Party of India (Marxist) — Hammer, Sickle & Star | Left-wing" },
  { name: "NPP", categorySlug: "political-party", comment: "National People's Party — Book 📖 | Regional base in Northeast India" },

  // Major Regional Parties
  { name: "TMC", categorySlug: "political-party", comment: "All India Trinamool Congress — Flowers & Grass | Dominant in West Bengal" },
  { name: "DMK", categorySlug: "political-party", comment: "Dravida Munnetra Kazhagam — Rising Sun ☀️ | Dravidian movement, Tamil Nadu" },
  { name: "AIADMK", categorySlug: "political-party", comment: "All India Anna Dravida Munnetra Kazhagam — Two Leaves | Tamil Nadu rival of DMK" },
  { name: "TVK", categorySlug: "political-party", comment: "Tamilaga Vettri Kazhagam — Founded by C. Joseph Vijay | Tamil Nadu ruling party (2026)" },
  { name: "TDP", categorySlug: "political-party", comment: "Telugu Desam Party — Bicycle 🚲 | Andhra Pradesh, founded by NTR" },
  { name: "YSRCP", categorySlug: "political-party", comment: "YSR Congress Party — Ceiling Fan | Andhra Pradesh, led by Jagan Mohan Reddy" },
  { name: "BRS", categorySlug: "political-party", comment: "Bharat Rashtra Samithi (formerly TRS) — Car 🚗 | Telangana statehood movement" },
  { name: "SP", categorySlug: "political-party", comment: "Samajwadi Party — Bicycle 🚲 | Uttar Pradesh, led by Akhilesh Yadav" },
  { name: "RJD", categorySlug: "political-party", comment: "Rashtriya Janata Dal — Lantern 🪔 | Bihar, founded by Lalu Prasad Yadav" },
  { name: "JD(U)", categorySlug: "political-party", comment: "Janata Dal (United) — Arrow ➡️ | Bihar, led by Nitish Kumar" },
  { name: "BJD", categorySlug: "political-party", comment: "Biju Janata Dal — Conch Shell | Odisha, founded by Naveen Patnaik" },
  { name: "Shiv Sena (UBT)", categorySlug: "political-party", comment: "Shiv Sena (Uddhav Balasaheb Thackeray) — Flaming Torch 🔥 | Maharashtra" },
  { name: "Shiv Sena", categorySlug: "political-party", comment: "Shiv Sena (Eknath Shinde faction) — Bow & Arrow 🏹 | Maharashtra" },
  { name: "NCP (SP)", categorySlug: "political-party", comment: "Nationalist Congress Party – Sharadchandra Pawar | Maharashtra" },
  { name: "NCP", categorySlug: "political-party", comment: "Nationalist Congress Party (Ajit Pawar faction) | Maharashtra" },

  // Other Recognized / Regional Parties
  { name: "CPI", categorySlug: "political-party", comment: "Communist Party of India — Ears of Corn & Sickle | Left-wing, est. 1925" },
  { name: "SAD", categorySlug: "political-party", comment: "Shiromani Akali Dal — Scales ⚖️ | Punjab, oldest regional party of India" },
  { name: "JKNC", categorySlug: "political-party", comment: "Jammu & Kashmir National Conference — Plough | Led by Abdullah family" },
  { name: "PDP", categorySlug: "political-party", comment: "People's Democratic Party — Inkpot & Pen ✒️ | Jammu & Kashmir" },
  { name: "RLD", categorySlug: "political-party", comment: "Rashtriya Lok Dal — Handpump | Western Uttar Pradesh, Jat heartland" },
  { name: "LJP", categorySlug: "political-party", comment: "Lok Janshakti Party — Bungalow | Bihar, founded by Ram Vilas Paswan" },

  // Satire
  { name: "CJP", categorySlug: "political-party", comment: "Cockroach Janta Party — Voice of the Lazy & Unemployed 🪳 | Political satire (est. 2026)" },
];

/**
 * Modes:
 *   default (upsert, prod-safe):
 *     - Upserts categories by slug.
 *     - Upserts celebs by (name + category). Updates image/comment only —
 *       NEVER touches respectors/dispiters on existing entries.
 *     - New celebs start at 0 votes (real users decide).
 *     - Does NOT delete entries missing from the seed list.
 *
 *   --fresh (destructive, dev/local only):
 *     - Wipes the Celeb and Category collections.
 *     - Re-inserts everything with tier-based seeded vote counts.
 *
 *   --seed-votes (with default upsert):
 *     - Inserts new celebs with tier-based seeded vote counts instead of 0.
 *     - Has no effect on existing celebs.
 */
async function seed() {
  const args = process.argv.slice(2);
  const fresh = args.includes("--fresh");
  const seedVotesOnInsert = args.includes("--seed-votes") || fresh;

  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected");
  console.log(`📋 Mode: ${fresh ? "FRESH (destructive)" : "UPSERT (prod-safe)"}\n`);

  if (fresh) {
    await Celeb.deleteMany({});
    await Category.deleteMany({});
    console.log("🗑️  Cleared existing data");
  }

  // Upsert categories
  const categoryMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    await Category.updateOne(
      { slug: cat.slug },
      { $set: { name: cat.name, order: cat.order } },
      { upsert: true },
    );
  }
  const allCats = await Category.find({}).lean();
  for (const c of allCats) categoryMap[(c as any).slug] = (c as any)._id.toString();
  console.log(`📂 Upserted ${CATEGORIES.length} categories`);

  // Upsert celebs
  let inserted = 0;
  let updated = 0;
  let found = 0;
  let fallback = 0;
  const missing: string[] = [];

  for (let i = 0; i < CELEBS.length; i++) {
    const celeb = CELEBS[i];
    const categoryId = categoryMap[celeb.categorySlug];
    if (!categoryId) {
      console.warn(`\n⚠️  Skipping ${celeb.name} — category '${celeb.categorySlug}' not found`);
      continue;
    }

    const explicit = EXPLICIT_IMAGES[celeb.name];
    const wikiName = WIKI_NAMES[celeb.name] ?? celeb.name;
    const resolvedImage = explicit ?? (await fetchWikiImage(wikiName));
    const image = resolvedImage ?? avatar(celeb.name);

    if (resolvedImage) found++;
    else {
      fallback++;
      missing.push(`${celeb.categorySlug}: ${celeb.name} (wiki: "${wikiName}")`);
    }

    const existing = await Celeb.findOne({ name: celeb.name, category: categoryId });

    if (existing) {
      // Update image/comment only — preserve real-user vote counts
      await Celeb.updateOne(
        { _id: (existing as any)._id },
        { $set: { image, comment: celeb.comment } },
      );
      updated++;
    } else {
      const votes = seedVotesOnInsert
        ? (celeb.categorySlug === "politician"      ? getVotesForPolitician(celeb.name) :
           celeb.categorySlug === "political-party" ? getVotesForParty(celeb.name) :
           celeb.categorySlug === "actor"           ? getVotesForActor(celeb.name) :
           celeb.categorySlug === "cricketer"       ? getVotesForCricketer(celeb.name) :
           celeb.categorySlug === "ipl-team"        ? getVotesForIPL(celeb.name) :
           { respectors: 0, dispiters: 0 })
        : { respectors: 0, dispiters: 0 };

      await Celeb.create({
        name: celeb.name,
        image,
        comment: celeb.comment,
        respectors: votes.respectors,
        dispiters: votes.dispiters,
        category: categoryId,
      });
      inserted++;
    }

    const icon = resolvedImage ? "✅" : "🔤";
    process.stdout.write(`\r${icon} [${i + 1}/${CELEBS.length}] ${celeb.name.padEnd(40)}`);
  }

  console.log(
    `\n\n✨ Inserted: ${inserted} | 🔁 Updated: ${updated}` +
    `  |  📸 Wiki: ${found} | 🔤 Fallback: ${fallback}`,
  );
  if (missing.length > 0) {
    console.log(`\n⚠️  Entries that fell back to letter avatars:`);
    for (const m of missing) console.log(`   - ${m}`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Done!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
