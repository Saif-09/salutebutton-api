import type { Request, Response, NextFunction } from "express";
import { User } from "../models/user";

/**
 * Auth middleware — validates Bearer token from Authorization header.
 * Attaches the authenticated user to req.user.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const token = header.slice(7);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await User.findOne({ token }).select("_id username").lean();
    if (!user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Attach user to request for downstream handlers
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}
