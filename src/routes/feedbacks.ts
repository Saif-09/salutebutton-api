import { Router, type Request, type Response } from "express";
import { Feedback } from "../models/feedback";

export const feedbacksRouter = Router();

const VALID_TYPES = ["feedback", "improvement", "bug", "other"] as const;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

// POST /api/feedbacks
feedbacksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, type, message } = req.body;

    if (!type || !message?.trim()) {
      res.status(400).json({ error: "Type and message are required" });
      return;
    }

    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
      return;
    }

    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` });
      return;
    }

    if (name && name.trim().length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` });
      return;
    }

    if (email && email.trim().length > MAX_EMAIL_LENGTH) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const feedback = await Feedback.create({
      name: name?.trim(),
      email: email?.trim(),
      type,
      message: message.trim(),
    });
    res.status(201).json(feedback);
  } catch {
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});
