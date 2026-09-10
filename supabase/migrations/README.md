# Database migrations

Run these against the Supabase project in order. Each file is idempotent
(safe to re-run). Apply via **Supabase Dashboard → SQL Editor** (paste + Run),
or with the Supabase CLI (`supabase db push`) once the project is linked.

| # | File | What it does |
|---|------|--------------|
| 001 | `001_initial_schema.sql` | Base schema — profiles, trips, badges, user_badges, marketplace_items, redemptions, friendships, RLS policies, seed data. Run once when setting up a fresh project. |
| 002 | `002_marketplace_partners.sql` | Adds `lat` / `lng` / `value_usd` / `color` to `marketplace_items` and reseeds the partner catalog. Also makes `redemptions.item_id` `ON DELETE SET NULL` so the catalog can be refreshed. |
| 003 | `003_badges.sql` | Final badge set — the original seven plus **Social Butterfly** (5+ friends). Adds a `color` column and a `friends` threshold type; drops the old `threshold_type` CHECK constraint. |

## Badge history (for reference)

The badge set went through a few iterations:

1. **Original 7** — First Step, Green Streak, Eco Warrior, CO2 Saver, Climate Hero,
   Point Collector, Point Master. Types: green-trip count, CO₂ saved, points.
2. Briefly expanded to a 14-badge set matching the hackathon mock (added Green
   Commuter, Subway Streak, Bike Hero, Tree Planter, Carbon Crusher, Early
   Adopter, Social Butterfly).
3. **Final (003)** — reverted to the original 7 + Social Butterfly. The others
   were dropped as too granular / redundant. The badge engine
   (`server/lib/badges.js`) still tolerates the retired threshold types
   (`bike_km`, `subway_streak`, `signup`) if any are re-added later.
