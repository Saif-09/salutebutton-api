/**
 * Admin script for one-off celeb/party edits in prod.
 *
 * Usage:
 *   npm run celeb:add    -- <category-slug> "<name>" "<comment>" [imageUrl]
 *   npm run celeb:remove -- "<name>" [category-slug]
 *   npm run celeb:update -- "<name>" [--comment "<new>"] [--image <url>] [--rename "<newName>"] [--category <slug>]
 *
 * Examples:
 *   npm run celeb:add    -- politician "Test Person" "Some Comment"
 *   npm run celeb:remove -- "MK Stalin"
 *   npm run celeb:update -- "BJP" --comment "New comment text"
 *   npm run celeb:update -- "Test Person" --rename "Better Name" --image https://example.com/x.jpg
 *
 * Notes:
 *   - Never modifies respectors/dispiters counts (real user votes are sacred).
 *   - If imageUrl is omitted on `add`, tries Wikipedia, then falls back to a letter avatar.
 *   - If multiple celebs share a name, pass a category-slug to disambiguate.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Category } from "./models/category";
import { Celeb } from "./models/celeb";

const MONGODB_URI = process.env.MONGODB_URI!;

function avatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=500&background=random&bold=true&format=png`;
}

async function fetchWikiImage(name: string): Promise<string | null> {
  const headers = { "User-Agent": "SaluteButton/1.0 (celeb-admin)" };
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data: any = await res.json();
      const hit = data?.thumbnail?.source ?? data?.originalimage?.source;
      if (hit) return hit;
    }
  } catch { /* fall through */ }
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=pageimages&piprop=original|thumbnail&pithumbsize=500` +
      `&redirects=1&titles=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data: any = await res.json();
    const pages: any = data?.query?.pages ?? {};
    const first: any = Object.values(pages)[0];
    return first?.original?.source ?? first?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function resolveCategoryId(slug: string): Promise<string> {
  const cat = await Category.findOne({ slug });
  if (!cat) throw new Error(`Category '${slug}' not found. Add it to seed.ts CATEGORIES and run \`npm run seed\` first.`);
  return (cat as any)._id.toString();
}

async function findCelebByName(name: string, categorySlug?: string) {
  const filter: any = { name };
  if (categorySlug) {
    filter.category = await resolveCategoryId(categorySlug);
  }
  const matches = await Celeb.find(filter).populate("category", "slug name").lean();
  return matches as any[];
}

async function cmdAdd(args: string[]) {
  const [categorySlug, name, comment, imageUrl] = args;
  if (!categorySlug || !name || !comment) {
    console.error('Usage: npm run celeb:add -- <category-slug> "<name>" "<comment>" [imageUrl]');
    process.exit(1);
  }
  const categoryId = await resolveCategoryId(categorySlug);

  const existing = await Celeb.findOne({ name, category: categoryId });
  if (existing) {
    console.error(`❌ A celeb named "${name}" already exists in category '${categorySlug}'. Use \`celeb:update\` instead.`);
    process.exit(1);
  }

  let image = imageUrl;
  if (!image) {
    image = (await fetchWikiImage(name)) ?? avatar(name);
  }

  const doc = await Celeb.create({
    name,
    image,
    comment,
    respectors: 0,
    dispiters: 0,
    category: categoryId,
  });

  console.log(`✅ Added "${name}" to '${categorySlug}'`);
  console.log(`   id:      ${(doc as any)._id}`);
  console.log(`   image:   ${image}`);
  console.log(`   comment: ${comment}`);
}

async function cmdRemove(args: string[]) {
  const [name, categorySlug] = args;
  if (!name) {
    console.error('Usage: npm run celeb:remove -- "<name>" [category-slug]');
    process.exit(1);
  }
  const matches = await findCelebByName(name, categorySlug);
  if (matches.length === 0) {
    console.error(`❌ No celeb found with name "${name}"${categorySlug ? ` in '${categorySlug}'` : ""}.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`❌ Multiple celebs named "${name}" found. Disambiguate by passing a category slug:`);
    for (const m of matches) {
      console.error(`   - ${m.name} (category: ${(m.category as any)?.slug})`);
    }
    process.exit(1);
  }

  const target = matches[0];
  await Celeb.deleteOne({ _id: target._id });
  console.log(`🗑️  Removed "${target.name}" from '${(target.category as any)?.slug}'`);
  console.log(`   (had respectors=${target.respectors}, dispiters=${target.dispiters} — lost permanently)`);
}

async function cmdUpdate(args: string[]) {
  if (args.length === 0) {
    console.error('Usage: npm run celeb:update -- "<name>" [--comment "<new>"] [--image <url>] [--rename "<newName>"] [--category <slug>]');
    process.exit(1);
  }
  const name = args[0];

  // Parse named flags
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        console.error(`❌ Flag --${key} requires a value`);
        process.exit(1);
      }
      flags[key] = value;
      i++;
    }
  }

  if (Object.keys(flags).length === 0) {
    console.error("❌ Nothing to update. Pass at least one of --comment, --image, --rename, --category.");
    process.exit(1);
  }

  const matches = await findCelebByName(name, flags.category);
  if (matches.length === 0) {
    console.error(`❌ No celeb found with name "${name}"${flags.category ? ` in '${flags.category}'` : ""}.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`❌ Multiple celebs named "${name}". Pass --category <slug> to disambiguate:`);
    for (const m of matches) console.error(`   - ${m.name} (${(m.category as any)?.slug})`);
    process.exit(1);
  }

  const target = matches[0];
  const updates: any = {};
  if (flags.comment) updates.comment = flags.comment;
  if (flags.image) updates.image = flags.image;
  if (flags.rename) updates.name = flags.rename;
  if (flags.category && !flags.rename) {
    // category-only move: only if user explicitly passed a new category to move TO
    // (currently flags.category was used for disambiguation; treat as no-op for now)
  }

  await Celeb.updateOne({ _id: target._id }, { $set: updates });
  console.log(`🔁 Updated "${target.name}" in '${(target.category as any)?.slug}'`);
  for (const [k, v] of Object.entries(updates)) console.log(`   ${k}: ${v}`);
  console.log(`   (respectors=${target.respectors}, dispiters=${target.dispiters} — untouched)`);
}

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (!sub) {
    console.error("Usage: npm run celeb:<add|remove|update> -- <args>");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { bufferCommands: false });

  try {
    switch (sub) {
      case "add":    await cmdAdd(rest);    break;
      case "remove": await cmdRemove(rest); break;
      case "update": await cmdUpdate(rest); break;
      default:
        console.error(`Unknown subcommand: ${sub}. Use add | remove | update.`);
        process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err.message ?? err);
  process.exit(1);
});
