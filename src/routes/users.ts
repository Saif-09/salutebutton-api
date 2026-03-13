import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/user";

export const usersRouter = Router();

const MAX_USERNAME_LENGTH = 50;
const MAX_PHONE_LENGTH = 20;
const MAX_PASSCODE_LENGTH = 50;

// POST /api/users/register — create account, return secret code ONCE
usersRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, phone } = req.body;

    if (!username?.trim() || !phone?.trim()) {
      res.status(400).json({ error: "Username and phone are required" });
      return;
    }

    if (username.trim().length > MAX_USERNAME_LENGTH) {
      res.status(400).json({ error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` });
      return;
    }

    if (phone.trim().length > MAX_PHONE_LENGTH) {
      res.status(400).json({ error: "Invalid phone number" });
      return;
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
      res.status(409).json({ error: "Phone number already registered" });
      return;
    }

    // Generate secret code: first 3 chars of username + 4 random digits
    const namePrefix = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 3).padEnd(3, "x");
    const randomDigits = crypto.randomInt(1000, 9999).toString();
    const rawCode = namePrefix + randomDigits;
    const hashedCode = await bcrypt.hash(rawCode, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      username: username.trim(),
      phone: phone.trim(),
      passcode: hashedCode,
      token,
    });

    res.status(201).json({
      token: user.token,
      userId: user._id,
      username: user.username,
      secretCode: rawCode, // shown ONCE — user must save this
    });
  } catch {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// POST /api/users/login — verify phone + secret code
usersRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { phone, passcode } = req.body;

    if (!phone?.trim() || !passcode?.trim()) {
      res.status(400).json({ error: "Phone and secret code are required" });
      return;
    }

    if (phone.trim().length > MAX_PHONE_LENGTH || passcode.trim().length > MAX_PASSCODE_LENGTH) {
      res.status(400).json({ error: "Invalid credentials" });
      return;
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      res.status(401).json({ error: "Invalid phone or secret code" });
      return;
    }

    const match = await bcrypt.compare(passcode.trim(), user.passcode);
    if (!match) {
      res.status(401).json({ error: "Invalid phone or secret code" });
      return;
    }

    // Rotate token on each login for extra security
    const newToken = crypto.randomBytes(32).toString("hex");
    user.token = newToken;
    await user.save();

    res.json({
      token: newToken,
      userId: user._id,
      username: user.username,
    });
  } catch {
    res.status(500).json({ error: "Failed to login" });
  }
});
