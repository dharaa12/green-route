# GreenRoute

**A Google Maps alternative that rewards low-carbon route choices.**

🔗 **Live app:** [greenroute-nyc.vercel.app](https://greenroute-nyc.vercel.app)

Search a route the way you would in any maps app, but GreenRoute compares driving, biking, and public transit side by side — each annotated with its estimated CO₂ impact — and rewards you with "climate points" for choosing the greener option. Points are redeemable in a rewards marketplace, and progress is tracked through badges and a leaderboard.

This is a full-stack rebuild of a hackathon prototype (built during NYC Tech Week), taken from a frontend-only demo to a real, working product with a live backend, a real database, and real routing and transit data — no mocked routing or transit responses.

## Features

- **Real multi-modal routing** — driving and cycling routes via [OSRM](http://project-osrm.org/), and actual NYC subway/bus routing from real MTA transit data (through [Transitous](https://transitous.org/)), not a simulated approximation
- **Carbon-aware route comparison** — every option is tagged as fastest or greenest, with an estimated % reduction in emissions and real-world equivalents (tree-days, phone charges, driving miles offset)
- **Climate points & badges** — a self-healing badge engine that re-evaluates achievements on every relevant action (a trip, adding a friend, visiting your profile), so progress never gets stuck out of sync
- **Marketplace** — a rewards catalog modeled on NYC businesses, browsable without an account so you can see what's on offer before signing up (illustrative seed data; see below)
- **Leaderboards** — global (public) and friends-only (signed in), ranked by total CO₂ saved
- **Responsive & installable** — works across phone/tablet/desktop and installs as a PWA

## What's real and what's seeded

**Real:** routing, transit, geocoding, accounts and auth, the database, and the deployment.

**Seeded or simulated:** the leaderboard users and the rewards catalog are demo data. The business names in the catalog are illustrative, with no actual partnerships. Redeeming a reward deducts points but doesn't produce anything a business could honor.

## Why NYC-first

GreenRoute launched NYC-first by design, not as a technical limitation — it's a deliberate beachhead-market choice. The city's dense transit network, real MTA data, and the seeded partner/community data all live there today, making it the right place to validate the core loop (route → carbon savings → reward) before expanding coverage. The underlying routing and geocoding already work anywhere in the world, the same way Google Maps biases toward your location without locking you to it.

## Tech stack

**Frontend** — React, React Router, Tailwind CSS, Leaflet + MapLibre GL (vector tiles via [OpenFreeMap](https://openfreemap.org/))

**Backend** — Node.js, Express, [Supabase](https://supabase.com/) (Postgres, Auth). The API enforces access in server code using a service-role key; row-level security policies are defined in the schema as a backstop, but the browser never queries the database directly

**Routing & geocoding** — [OSRM](http://project-osrm.org/) (drive/bike), [Nominatim](https://nominatim.org/) (geocoding), [Transitous/MOTIS](https://transitous.org/) (transit)

**Deployment** — Vercel (separate projects for the React frontend and the Express API, both auto-deploying from `main`)

## Project structure

```
client/    React app
server/    Express API
supabase/  Database schema (SQL migrations)
```

The frontend and backend deploy as two independent Vercel projects from this one repo, with the backend running as a Vercel serverless function.

## Running it locally

**Backend**
```bash
cd server
npm install
cp .env.example .env   # fill in your Supabase project's keys
npm run dev
```

**Frontend** (in a separate terminal)
```bash
cd client
npm install
cp .env.example .env   # fill in your Supabase keys + API URL
npm start
```

Database schema lives in `supabase/migrations/` — run those in order against a fresh Supabase project before starting the backend.
