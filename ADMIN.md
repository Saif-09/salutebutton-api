# Admin Commands — Cheatsheet

Quick reference for managing the salutebutton-api database in **prod** and **local dev**.

All commands are run from inside `salutebutton-api/`:

```bash
cd salutebutton-api
```

---

## Prod-Safe Commands

These commands **never wipe accumulated `respectors`/`dispiters` counts** from real users. Safe to run against production.

### `npm run seed` — idempotent upsert

Re-runs the seed list with **upsert** semantics:

- Upserts categories by `slug` (creates new ones, updates name/order on existing).
- Upserts celebs by `(name + category)`:
  - Existing entry → updates `image` + `comment` only. **Vote counts are preserved.**
  - New entry → inserts with `respectors: 0`, `dispiters: 0`.
- **Never deletes** entries that are missing from the seed list (use `celeb:remove` for that).

```bash
npm run seed
```

Use whenever you've edited `src/seed.ts` to add new entries or change images/comments.

---

### `npm run celeb:add` — add one celeb

```bash
npm run celeb:add -- <category-slug> "<name>" "<comment>" [imageUrl]
```

- `<category-slug>` must already exist (e.g. `politician`, `political-party`, `cricketer`, `ipl-team`, `actor`).
- `<name>` is unique within a category. Errors if duplicate.
- `<comment>` is the description shown on the card.
- `[imageUrl]` is optional. If omitted, tries Wikipedia summary → action API → letter-avatar fallback.
- New celebs start at **0 votes**.

```bash
# Auto-fetch image from Wikipedia
npm run celeb:add -- politician "Test Person" "Some short bio"

# With explicit image
npm run celeb:add -- political-party "TEST" "Test party" "https://example.com/logo.png"
```

---

### `npm run celeb:update` — edit one celeb

```bash
npm run celeb:update -- "<name>" [--comment "<new>"] [--image <url>] [--rename "<newName>"] [--category <slug>]
```

- `<name>` is the current name. Pass `--category <slug>` if the same name exists in multiple categories.
- Any combination of `--comment` / `--image` / `--rename` updates only those fields.
- **`respectors` and `dispiters` are never touched.**

```bash
npm run celeb:update -- "BJP" --comment "Bharatiya Janata Party — Lotus 🪷 | Updated 2026"
npm run celeb:update -- "Some Old Name" --rename "Better Name" --image https://example.com/x.jpg
npm run celeb:update -- "Vijay" --category political-party --comment "Updated CM bio"
```

---

### `npm run celeb:remove` — delete one celeb

```bash
npm run celeb:remove -- "<name>" [category-slug]
```

- Deletes exactly one entry. Errors if multiple matches and no category passed.
- **All accumulated votes on that entry are lost permanently** — the command logs them so you can see what's being discarded.

```bash
npm run celeb:remove -- "Some Test Entry"
npm run celeb:remove -- "Vijay" actor  # disambiguate when name exists in two categories
```

---

## Dev-Only Commands (DESTRUCTIVE)

⚠️ **Never run these against production.** They wipe data or modify counts in bulk.

### `npm run seed:fresh` — wipe and reseed

Deletes the entire `celebs` and `categories` collections, then re-inserts everything from `src/seed.ts` with **tier-based seeded vote counts** (so the local DB looks populated).

```bash
npm run seed:fresh
```

Use only when bootstrapping a fresh local DB.

---

### `npm run seed -- --seed-votes` — upsert with seeded votes for new inserts

Same as `npm run seed`, but new entries (inserts) get tier-based vote counts instead of `0`. Existing entries are still untouched.

```bash
npm run seed -- --seed-votes
```

Useful for populating a new category locally without nuking everything else.

---

### `npm run reset:party-votes` — zero out party votes

Sets `respectors = 0` and `dispiters = 0` for every celeb in the `political-party` category. Names/images/comments untouched.

```bash
npm run reset:party-votes
```

Used before launch to clear any test taps.

---

### `npm run reseed:party-votes` — randomize party votes

Re-rolls every party's `respectors`/`dispiters` based on its tier in `PARTY_TIERS` (BJP/INC at 12k–20k, mid-tier regionals at 5k–10k, etc.). Names/images/comments untouched.

```bash
npm run reseed:party-votes
```

Used for demo / screenshot setups.

---

## Typical Prod Workflow

1. **Add new entries** → edit `src/seed.ts`'s `CELEBS` array, then `npm run seed`.
2. **Fix a typo / update an image** → either edit `src/seed.ts` and run `npm run seed`, or use `npm run celeb:update` for a one-off.
3. **Remove an entry** → `npm run celeb:remove -- "<name>"`. Don't rely on deleting from the seed file — the upsert mode never deletes.
4. **Never wire `seed:fresh`, `reset:party-votes`, or `reseed:party-votes` into CI/deploy hooks.**

---

## Ad-Hoc DB Queries

For one-off inspections (counts, dumps, etc.), use `tsx -e` directly:

```bash
npx tsx -e '
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
import { Celeb } from "./src/models/celeb";
(async () => {
  await mongoose.connect(process.env.MONGODB_URI!, { bufferCommands: false });
  console.log("Total celebs:", await Celeb.countDocuments());
  await mongoose.disconnect();
})();
'
```

---

## File Map

| Script                          | Source                          |
| ------------------------------- | ------------------------------- |
| `seed` / `seed:fresh`           | `src/seed.ts`                   |
| `celeb:add/remove/update`       | `src/celebAdmin.ts`             |
| `reset:party-votes`             | `src/resetPartyVotes.ts`        |
| `reseed:party-votes`            | `src/reseedPartyVotes.ts`       |
