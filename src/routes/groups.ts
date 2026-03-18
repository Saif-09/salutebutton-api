import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { Group } from "../models/group";
import { User } from "../models/user";
import { requireAuth } from "../middleware/auth";
import { getIO } from "../socket";

export const groupsRouter = Router();

const MAX_GROUPS_PER_USER = 4;

// Public preview — no auth required (used for join-link landing page)
groupsRouter.get("/preview/:code", async (req, res) => {
  try {
    const { profileId } = req.query;
    const group = await Group.findOne({ code: req.params.code.toUpperCase() })
      .populate("createdBy", "username")
      .select("name code members createdBy profiles");

    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const response: any = {
      _id: group._id,
      name: group.name,
      code: group.code,
      isPublic: group.isPublic ?? false,
      memberCount: group.members.length,
      profileCount: group.profiles.length,
      createdBy: (group.createdBy as any).username,
    };

    // If a profileId is requested, include that profile's public data for share previews
    if (profileId && typeof profileId === "string") {
      const profile = (group.profiles as any).id(profileId);
      if (profile) {
        response.profile = {
          _id: profile._id,
          name: profile.name,
          description: profile.description,
          image: profile.image,
          respectors: profile.respectors,
          dispiters: profile.dispiters,
        };
      }
    }

    res.json(response);
  } catch {
    res.status(500).json({ error: "Failed to fetch group preview" });
  }
});
// List public groups — no auth required
groupsRouter.get("/public", async (req, res) => {
  try {
    const groups = await Group.find({ isPublic: true })
      .populate("createdBy", "username")
      .select("name code isPublic members profiles createdBy createdAt")
      .sort({ createdAt: -1 })
      .limit(50);

    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      code: g.code,
      isPublic: true,
      memberCount: g.members.length,
      profileCount: g.profiles.length,
      createdBy: (g.createdBy as any).username,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch public groups" });
  }
});

const MAX_PROFILES_PER_GROUP = 10;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

// All group routes require authentication
groupsRouter.use(requireAuth);

// Helper: get authenticated user ID from middleware
function getAuthUserId(req: any): string {
  return req.user._id.toString();
}

// Helper: check if a user is an admin (original creator OR promoted admin)
function isGroupAdmin(group: any, userId: string): boolean {
  if (group.createdBy.toString() === userId) return true;
  return group.admins.some((a: any) => a.toString() === userId);
}

// Create a group (max 4 per user)
groupsRouter.post("/create", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { name, isPublic } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Group name is required" });
      return;
    }

    if (name.trim().length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Group name must be ${MAX_NAME_LENGTH} characters or less` });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const createdCount = await Group.countDocuments({ createdBy: userId });
    if (createdCount >= MAX_GROUPS_PER_USER) {
      res
        .status(400)
        .json({ error: `You can only create up to ${MAX_GROUPS_PER_USER} groups` });
      return;
    }

    const code = crypto.randomBytes(3).toString("hex").toUpperCase();

    const group = await Group.create({
      name: name.trim(),
      code,
      isPublic: isPublic === true,
      createdBy: userId,
      members: [userId],
      profiles: [],
    });

    res.status(201).json(group);
  } catch {
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Join a group by code
groupsRouter.post("/join", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { code } = req.body;

    if (!code?.trim()) {
      res.status(400).json({ error: "Group code is required" });
      return;
    }

    const group = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const alreadyMember = group.members.some(
      (m: any) => m.toString() === userId,
    );
    if (alreadyMember) {
      res.status(400).json({ error: "You are already in this group" });
      return;
    }

    group.members.push(userId as any);
    await group.save();

    res.json(group);
  } catch {
    res.status(500).json({ error: "Failed to join group" });
  }
});

// Join a public group by ID (no code needed)
groupsRouter.post("/join/:groupId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (!group.isPublic) {
      res.status(403).json({ error: "This group is private. Use an invite code to join." });
      return;
    }

    const alreadyMember = group.members.some(
      (m: any) => m.toString() === userId,
    );
    if (alreadyMember) {
      res.status(400).json({ error: "You are already in this group" });
      return;
    }

    group.members.push(userId as any);
    await group.save();

    res.json(group);
  } catch {
    res.status(500).json({ error: "Failed to join group" });
  }
});

// Get groups for the authenticated user
groupsRouter.get("/my", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const groups = await Group.find({ members: userId })
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Keep the old route for backwards compatibility during frontend migration
groupsRouter.get("/my/:userId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const groups = await Group.find({ members: userId })
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Get a single group by ID (members only)
groupsRouter.get("/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");

    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Verify membership
    const isMember = group.members.some(
      (m: any) => (m._id || m).toString() === userId,
    );
    if (!isMember) {
      res.status(403).json({ error: "You are not a member of this group" });
      return;
    }

    res.json(group);
  } catch {
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

// Delete a group (original creator only)
groupsRouter.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (group.createdBy.toString() !== userId) {
      res.status(403).json({ error: "Only the original admin can delete the group" });
      return;
    }

    await Group.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// Leave a group
groupsRouter.post("/:id/leave", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const isMember = group.members.some((m: any) => m.toString() === userId);
    if (!isMember) {
      res.status(400).json({ error: "You are not a member of this group" });
      return;
    }

    const isOriginalCreator = group.createdBy.toString() === userId;

    if (isOriginalCreator) {
      if (group.admins.length === 0) {
        res.status(400).json({
          error: "You must promote a member to admin or delete the group before leaving",
        });
        return;
      }

      // Transfer ownership to the first promoted admin (earliest promotion).
      // Use findByIdAndUpdate with $set so Mongoose reliably persists the createdBy change.
      const newCreatorId = group.admins[0];
      await Group.findByIdAndUpdate(group._id, {
        $set: { createdBy: newCreatorId },
        $pull: {
          admins: newCreatorId,
          members: new mongoose.Types.ObjectId(userId),
        },
      });
      res.json({ success: true });
      return;
    }

    // Regular member or promoted admin leaving
    group.members = group.members.filter((m: any) => m.toString() !== userId);
    group.admins = group.admins.filter((a: any) => a.toString() !== userId);
    await group.save();

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to leave group" });
  }
});

// Remove a member (any admin can remove members, but no one can remove the original creator)
groupsRouter.delete("/:id/members/:memberId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { memberId } = req.params;
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (!isGroupAdmin(group, userId)) {
      res.status(403).json({ error: "Only admins can remove members" });
      return;
    }

    // Nobody can remove the original creator
    if (memberId === group.createdBy.toString()) {
      res.status(403).json({ error: "The original admin cannot be removed" });
      return;
    }

    // Promoted admins cannot remove other admins — only the original creator can
    const targetIsAdmin = group.admins.some((a: any) => a.toString() === memberId);
    if (targetIsAdmin && group.createdBy.toString() !== userId) {
      res.status(403).json({ error: "Only the original admin can remove other admins" });
      return;
    }

    group.members = group.members.filter((m: any) => m.toString() !== memberId);
    group.admins = group.admins.filter((a: any) => a.toString() !== memberId);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");
    res.json(populated);
  } catch {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// Promote a member to admin (any admin can promote, original creator cannot be re-promoted)
groupsRouter.post("/:id/admins/:memberId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { memberId } = req.params;
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (!isGroupAdmin(group, userId)) {
      res.status(403).json({ error: "Only admins can promote members" });
      return;
    }

    // Target must be a member of the group
    const targetIsMember = group.members.some((m: any) => m.toString() === memberId);
    if (!targetIsMember) {
      res.status(404).json({ error: "User is not a member of this group" });
      return;
    }

    // Already an admin?
    if (isGroupAdmin(group, memberId)) {
      res.status(400).json({ error: "User is already an admin" });
      return;
    }

    group.admins.push(memberId as any);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");
    res.json(populated);
  } catch {
    res.status(500).json({ error: "Failed to promote member" });
  }
});

// Demote an admin back to member (original creator only)
groupsRouter.delete("/:id/admins/:memberId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { memberId } = req.params;
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    // Only the original creator can demote admins
    if (group.createdBy.toString() !== userId) {
      res.status(403).json({ error: "Only the original admin can demote admins" });
      return;
    }

    // Cannot demote yourself (original creator)
    if (memberId === userId) {
      res.status(400).json({ error: "You cannot demote yourself" });
      return;
    }

    // Target must currently be a promoted admin
    const isPromoted = group.admins.some((a: any) => a.toString() === memberId);
    if (!isPromoted) {
      res.status(400).json({ error: "User is not a promoted admin" });
      return;
    }

    group.admins = group.admins.filter((a: any) => a.toString() !== memberId);
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");
    res.json(populated);
  } catch {
    res.status(500).json({ error: "Failed to demote admin" });
  }
});

// ========== PROFILES ==========

// Add a profile (admin only, max 10)
groupsRouter.post("/:id/profiles", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { name, description, image } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (!isGroupAdmin(group, userId)) {
      res.status(403).json({ error: "Only admins can add profiles" });
      return;
    }

    if (!name?.trim() || !description?.trim() || !image?.trim()) {
      res
        .status(400)
        .json({ error: "Name, description, and photo are required" });
      return;
    }

    if (name.trim().length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less` });
      return;
    }

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      res.status(400).json({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` });
      return;
    }

    if (group.profiles.length >= MAX_PROFILES_PER_GROUP) {
      res
        .status(400)
        .json({ error: `Maximum ${MAX_PROFILES_PER_GROUP} profiles per group` });
      return;
    }

    group.profiles.push({
      name: name.trim(),
      description: description.trim(),
      image: image.trim(),
      respectors: 0,
      dispiters: 0,
    });
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ error: "Failed to add profile" });
  }
});

// Delete a profile (admin only)
groupsRouter.delete("/:id/profiles/:profileId", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (!isGroupAdmin(group, userId)) {
      res.status(403).json({ error: "Only admins can delete profiles" });
      return;
    }

    group.profiles = group.profiles.filter(
      (p: any) => p._id.toString() !== req.params.profileId,
    ) as any;
    await group.save();

    const populated = await Group.findById(group._id)
      .populate("createdBy", "username")
      .populate("admins", "username")
      .populate("members", "username");
    res.json(populated);
  } catch {
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

// React to a profile (members only) — uses $inc to prevent arbitrary value setting
groupsRouter.patch("/:id/profiles/:profileId/reactions", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { type, count } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const isMember = group.members.some(
      (m: any) => m.toString() === userId,
    );
    if (!isMember) {
      res.status(403).json({ error: "Only group members can react" });
      return;
    }

    const profile = (group.profiles as any).id(req.params.profileId);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (type !== "respect" && type !== "dispite") {
      res.status(400).json({ error: 'Invalid reaction type. Use "respect" or "dispite"' });
      return;
    }

    // Cap delta to prevent abuse
    const delta = Math.min(Math.max(Math.floor(Number(count) || 1), 1), 50);
    const field = type === "respect" ? "respectors" : "dispiters";
    profile[field] += delta;

    await group.save();

    // Broadcast to all clients viewing this group
    getIO().emit("group-reaction", {
      groupId: req.params.id,
      profileId: req.params.profileId,
      respectors: profile.respectors,
      dispiters: profile.dispiters,
    });

    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to update reaction" });
  }
});

// Get group leaderboard (members only)
groupsRouter.get("/:id/leaderboard", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const isMember = group.members.some(
      (m: any) => m.toString() === userId,
    );
    if (!isMember) {
      res.status(403).json({ error: "Only group members can view the leaderboard" });
      return;
    }

    const sorted = [...group.profiles].sort(
      (a, b) => b.respectors - a.respectors,
    );

    res.json({ name: group.name, profiles: sorted });
  } catch {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});
