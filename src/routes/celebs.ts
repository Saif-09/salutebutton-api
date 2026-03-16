import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { Celeb } from "../models/celeb";
import { getIO } from "../socket";

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
