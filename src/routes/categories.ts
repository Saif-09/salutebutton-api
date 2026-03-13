import { Router, type Request, type Response } from "express";
import { Category } from "../models/category";

export const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});
