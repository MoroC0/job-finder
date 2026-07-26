# Job Finder

A multi-source job search prototype built with **Next.js**, **React**, and **TypeScript**.

## What this repo contains

- A Next.js app under `app/`
- Job components in `components/`
- A job service layer in `lib/`
- A reusable source-adapter layer with LinkedIn, Jobindex.dk, and Workindenmark implementations
- Newest-first LinkedIn pagination with configurable result limits
- Concurrent comma-separated role searches merged into one newest-first feed
- Lazy-loaded applicant counts and original/reposted listing status
- A small API route at `app/api/jobs/route.ts`
- A product roadmap in `TODO.md`

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the dev server starts.

## Project commands

- `npm run dev` — start the development server
- `npm run build` — build the app for production
- `npm run start` — run the production server after build
- `npm run lint` — run Next.js lint checks
- `npm run typecheck` — run TypeScript type checking

## Product direction

This repository is moving from a sandbox into a working product:

1. Stabilize the LinkedIn and Jobindex.dk search flows.
2. Improve extraction quality and scraper observability.
3. Add persistence, saved searches, and deduplication.
4. Reuse the same adapter contract to add more websites safely.
