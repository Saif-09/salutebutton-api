import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { Celeb } from "../models/celeb";
import { getIO } from "../socket";

// Map of Wikipedia article names (for those whose names differ from article titles)
const WIKI_NAMES: Record<string, string> = {
  "Vijay (Thalapathy)": "Vijay (actor)",
  "MK Stalin": "M. K. Stalin",
  "Chandrashekhar Azad": "Chandrashekhar Aazad",
  "KCR": "K. Chandrashekar Rao",
  "JP Nadda": "Jagat Prakash Nadda",
  "Royal Challengers Bengaluru": "Royal Challengers Bangalore",
};

async function fetchWikiImage(name: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SaluteButton/1.0 (image-refresh)" },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.thumbnail?.source ?? data?.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

async function isImageBroken(imageUrl: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl, { method: "HEAD" });
    return !res.ok;
  } catch {
    return true;
  }
}

// Stricter rate limiter for anonymous voting — 30 votes per minute per IP
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many votes, please slow down" },
});

export const celebsRouter = Router();

// Escape special regex characters to prevent ReDoS attacks
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/celebs — list all (with optional search & category filter)
celebsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, category } = req.query;
    const filter: Record<string, unknown> = {};

    if (typeof search === "string" && search.trim()) {
      // Limit search length and escape regex to prevent ReDoS
      const sanitized = escapeRegex(search.trim().slice(0, 100));
      filter.name = { $regex: sanitized, $options: "i" };
    }
    if (typeof category === "string" && category.trim()) {
      filter.category = category.trim();
    }

    const celebs = await Celeb.find(filter)
      .populate("category", "name slug")
      .sort({ respectors: -1 })
      .limit(200) // cap results to prevent memory abuse
      .lean();

    res.json(celebs);
  } catch {
    res.status(500).json({ error: "Failed to fetch celebs" });
  }
});

// POST /api/celebs/refresh-images — re-fetch Wikipedia images for celebs with broken image URLs
celebsRouter.post("/refresh-images", async (_req: Request, res: Response) => {
  try {
    const celebs = await Celeb.find({}).lean();
    const results: { name: string; old: string; new: string }[] = [];

    for (const celeb of celebs) {
      const broken = await isImageBroken(celeb.image);
      if (!broken) continue;

      const wikiName = WIKI_NAMES[celeb.name] ?? celeb.name;
      const newImage = await fetchWikiImage(wikiName);
      if (!newImage) continue;

      await Celeb.findByIdAndUpdate(celeb._id, { image: newImage });
      results.push({ name: celeb.name, old: celeb.image, new: newImage });
    }

    res.json({ refreshed: results.length, details: results });
  } catch {
    res.status(500).json({ error: "Failed to refresh images" });
  }
});

// GET /api/celebs/:id — single celeb by ID
celebsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const celeb = await Celeb.findById(req.params.id)
      .populate("category", "name slug")
      .lean();

    if (!celeb) {
      res.status(404).json({ error: "Celeb not found" });
      return;
    }

    res.json(celeb);
  } catch {
    res.status(500).json({ error: "Failed to fetch celeb" });
  }
});

// PATCH /api/celebs/:id/reactions — increment salute/disrespect counts
// Public — common profiles (politicians, cricketers, actors, etc.) can be voted without login
celebsRouter.patch(
  "/:id/reactions",
  voteLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { type, count } = req.body;

      if (type !== "respect" && type !== "dispite") {
        res
          .status(400)
          .json({ error: 'Invalid reaction type. Use "respect" or "dispite"' });
        return;
      }

      // Accept a delta count but cap it to prevent abuse
      const delta = Math.min(Math.max(Math.floor(Number(count) || 1), 1), 50);
      const field = type === "respect" ? "respectors" : "dispiters";

      const celeb = await Celeb.findByIdAndUpdate(
        id,
        { $inc: { [field]: delta } },
        { new: true },
      ).populate("category", "name slug");

      if (!celeb) {
        res.status(404).json({ error: "Celeb not found" });
        return;
      }

      // Broadcast the updated counts to all connected clients
      getIO().emit("celeb-reaction", {
        celebId: celeb._id,
        respectors: celeb.respectors,
        dispiters: celeb.dispiters,
      });

      res.json(celeb);
    } catch {
      res.status(500).json({ error: "Failed to update reactions" });
    }
  },
);
