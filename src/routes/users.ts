import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/user";
import { Group } from "../models/group";
import { requireAuth } from "../middleware/auth";

export const usersRouter = Router();

const MAX_USERNAME_LENGTH = 50;
const MAX_PASSCODE_LENGTH = 50;
const MAX_SECURITY_ANSWER_LENGTH = 100;

// Indian mobile: optional +91/91 prefix, then 10 digits starting with 6-9
const INDIAN_PHONE_REGEX = /^(?:\+?91)?[6-9]\d{9}$/;

function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (!INDIAN_PHONE_REGEX.test(cleaned)) return false;

  // Extract last 10 digits for pattern checks
  const digits = cleaned.slice(-10);

  // Reject all same digit (6666666666, 9999999999, etc.)
  if (/^(\d)\1{9}$/.test(digits)) return false;

  // Reject repeating 2-digit pattern (9191919191, 8282828282, etc.)
  if (/^(\d{2})\1{4}$/.test(digits)) return false;

  // Reject one digit followed by all zeros (9000000000, 8000000000, etc.)
  if (/^[6-9]0{9}$/.test(digits)) return false;

  // Reject sequential digits (6789012345, etc.)
  const seq = "0123456789012345";
  const rseq = "9876543210987654";
  if (seq.includes(digits) || rseq.includes(digits)) return false;

  return true;
}

const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What city were you born in?",
  "What is your favorite movie?",
  "What is your mother's maiden name?",
  "What was your first school's name?",
  "What is your favorite food?",
];

// POST /api/users/register — create account, return secret code ONCE
usersRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, phone, securityQuestion, securityAnswer } = req.body;

    if (!username?.trim() || !phone?.trim()) {
      res.status(400).json({ error: "Username and phone are required" });
      return;
    }

    if (!securityQuestion?.trim() || !securityAnswer?.trim()) {
      res.status(400).json({ error: "Security question and answer are required" });
      return;
    }

    if (!SECURITY_QUESTIONS.includes(securityQuestion.trim())) {
      res.status(400).json({ error: "Invalid security question" });
      return;
    }

    if (securityAnswer.trim().length > MAX_SECURITY_ANSWER_LENGTH) {
      res.status(400).json({ error: "Security answer is too long" });
      return;
    }

    if (username.trim().length > MAX_USERNAME_LENGTH) {
      res.status(400).json({ error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` });
      return;
    }

    if (!isValidIndianPhone(phone.trim())) {
      res.status(400).json({ error: "Invalid Indian mobile number" });
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
    const hashedAnswer = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);
    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      username: username.trim(),
      phone: phone.trim(),
      passcode: hashedCode,
      token,
      securityQuestion: securityQuestion.trim(),
      securityAnswer: hashedAnswer,
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

    if (!isValidIndianPhone(phone.trim()) || passcode.trim().length > MAX_PASSCODE_LENGTH) {
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

// GET /api/users/security-questions — list available questions
usersRouter.get("/security-questions", (_req: Request, res: Response) => {
  res.json({ questions: SECURITY_QUESTIONS });
});

// POST /api/users/forgot-passcode/lookup — return the user's security question
usersRouter.post("/forgot-passcode/lookup", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone?.trim()) {
      res.status(400).json({ error: "Phone number is required" });
      return;
    }

    if (!isValidIndianPhone(phone.trim())) {
      res.status(400).json({ error: "Invalid Indian mobile number" });
      return;
    }

    const user = await User.findOne({ phone: phone.trim() }).select("securityQuestion").lean();
    if (!user || !user.securityQuestion) {
      // Generic error to avoid phone enumeration
      res.status(404).json({ error: "No account found with this phone number" });
      return;
    }

    res.json({ securityQuestion: user.securityQuestion });
  } catch {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/users/forgot-passcode — verify phone + security answer, return new code
usersRouter.post("/forgot-passcode", async (req: Request, res: Response) => {
  try {
    const { phone, securityAnswer } = req.body;

    if (!phone?.trim() || !securityAnswer?.trim()) {
      res.status(400).json({ error: "Phone and security answer are required" });
      return;
    }

    if (!isValidIndianPhone(phone.trim()) || securityAnswer.trim().length > MAX_SECURITY_ANSWER_LENGTH) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      // Generic error to avoid phone enumeration
      res.status(400).json({ error: "Invalid phone or security answer" });
      return;
    }

    if (!user.securityAnswer) {
      res.status(400).json({ error: "No security question set for this account. Please contact support." });
      return;
    }

    const match = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.securityAnswer);
    if (!match) {
      res.status(400).json({ error: "Invalid phone or security answer" });
      return;
    }

    // Generate new secret code
    const namePrefix = user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 3).padEnd(3, "x");
    const randomDigits = crypto.randomInt(1000, 9999).toString();
    const rawCode = namePrefix + randomDigits;
    const hashedCode = await bcrypt.hash(rawCode, 10);

    user.passcode = hashedCode;
    await user.save();

    res.json({
      secretCode: rawCode,
      securityQuestion: user.securityQuestion,
    });
  } catch {
    res.status(500).json({ error: "Failed to reset passcode" });
  }
});

// GET /api/users/me — authenticated user profile with group stats
usersRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id.toString();
    const user = await User.findById(userId).select("username phone createdAt").lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get all groups the user is a member of
    const groups = await Group.find({ members: userId })
      .select("_id name isPublic createdBy")
      .lean();

    const totalGroups = groups.length;
    const publicGroups = groups.filter((g) => g.isPublic).length;
    const privateGroups = totalGroups - publicGroups;

    const createdGroups = groups.filter((g) => g.createdBy.toString() === userId);

    res.json({
      _id: userId,
      username: user.username,
      phone: user.phone,
      createdAt: user.createdAt,
      groups: {
        total: totalGroups,
        public: publicGroups,
        private: privateGroups,
        hasGroups: totalGroups > 0,
        created: createdGroups.map((g) => ({ _id: g._id, name: g.name })),
        createdCount: createdGroups.length,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});
