# Job Finder

A LinkedIn-first job search prototype built with **Next.js**, **React**, and **TypeScript**.

## What this repo contains

- A Next.js app under `app/`
- Job components in `components/`
- A job service layer in `lib/`
- A reusable source-adapter layer with a live LinkedIn implementation
- A small API route at `app/api/jobs/route.ts`

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

1. Stabilize the LinkedIn search flow.
2. Improve extraction quality and scraper observability.
3. Add persistence, saved searches, and deduplication.
4. Reuse the same adapter contract to add more websites later.
