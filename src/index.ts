import dotenv from "dotenv";
dotenv.config();

import http from "http";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import multer from "multer";
import { initSocket } from "./socket";
import { v2 as cloudinary } from "cloudinary";
import { celebsRouter } from "./routes/celebs";
import { categoriesRouter } from "./routes/categories";
import { usersRouter } from "./routes/users";
import { feedbacksRouter } from "./routes/feedbacks";
import { groupsRouter } from "./routes/groups";
import { requireAuth } from "./middleware/auth";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
// CORS_ORIGIN supports comma-separated origins: "https://app.com,http://localhost:3000"
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

if (!MONGODB_URI) {
  console.error("FATAL: MONGODB_URI environment variable is not set");
  process.exit(1);
}

console.log("ENV check — PORT:", PORT, "CORS_ORIGINS:", CORS_ORIGINS, "MONGODB_URI set:", !!MONGODB_URI);

// ──────────── Security Middleware ────────────

// Helmet — sets secure HTTP headers (XSS protection, no sniff, HSTS, etc.)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow serving uploaded images cross-origin
  }),
);

// CORS — restrict to known origins
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));

// ──────────── Socket.IO ────────────

initSocket(server, CORS_ORIGINS);

// Body size limits — prevent payload flooding
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// Global rate limiter — 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use(globalLimiter);

// Stricter rate limiter for auth routes — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// Stricter rate limiter for uploads — 10 uploads per 15 minutes
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads, please try again later" },
});

// Stricter rate limiter for feedback — 5 per hour
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many feedback submissions, please try again later" },
});

// ──────────── Cloudinary ────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ──────────── File Upload ────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

// Upload requires auth + stricter rate limit
app.post(
  "/api/upload",
  uploadLimiter,
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image provided" });
      return;
    }
    try {
      const result = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { upload_preset: "salutebutton", resource_type: "image" },
              (error, result) => {
                if (error || !result) reject(error || new Error("Upload failed"));
                else resolve(result);
              },
            )
            .end(req.file!.buffer);
        },
      );
      res.json({ url: result.secure_url });
    } catch {
      res.status(500).json({ error: "Image upload failed" });
    }
  },
);

// ──────────── Routes ────────────

// Auth routes get stricter rate limiting
app.use("/api/users", authLimiter, usersRouter);

// Feedback gets its own limiter
app.use("/api/feedbacks", feedbackLimiter, feedbacksRouter);

// Public read routes
app.use("/api/celebs", celebsRouter);
app.use("/api/categories", categoriesRouter);

// Groups require auth
app.use("/api/groups", groupsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ──────────── Global Error Handler ────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // Multer file size error
    if (err.message === "Only images are allowed") {
      res.status(400).json({ error: "Only image files are allowed" });
      return;
    }

    // Never leak internal error details to clients
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  },
);

// ──────────── Start Server ────────────

mongoose
  .connect(MONGODB_URI, { bufferCommands: false })
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
