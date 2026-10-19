# Job Finder

A multi-source job search prototype built with **Next.js**, **React**, and **TypeScript**.

## What this repo contains

- A Next.js app under `app/`
- Job components in `components/`
- A job service layer in `lib/`
- A reusable source-adapter layer with LinkedIn, Jobindex.dk, Workindenmark, and multi-company Workday implementations
- Newest-first LinkedIn pagination with configurable result limits
- Concurrent comma-separated role searches merged into one newest-first feed
- Concurrent LinkedIn searches across up to five semicolon-separated locations
- Combined location results sorted globally by posting date, with equal-date queries interleaved and per-location search status
- A configurable Workday company registry with bounded tenant concurrency and cross-source deduplication
- A Workday-only country filter backed by normalized country facets shared across company tenants
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

- `npm test` — run deterministic multi-location regression tests (no live source requests)

- `npm run dev` — start the development server
- `npm run build` — build the app for production
- `npm run start` — run the production server after build
- `npm run lint` — run Next.js lint checks
- `npm run typecheck` — run TypeScript type checking

## Product direction

Multiple LinkedIn locations use semicolons, for example `Copenhagen; Switzerland`.
Each role/location query fetches up to the selected result limit before candidates
are deduplicated, ordered newest first, and capped to the combined limit. Searching
more roles or locations can therefore take longer. The location status list shows
candidate counts before deduplication and the final limit; a location can return
jobs without appearing in the final shortlist when other candidates are newer.
Posting-time and applicant-count sort controls apply to the combined shortlist.

This repository is moving from a sandbox into a working product:

1. Stabilize the LinkedIn and Jobindex.dk search flows.
2. Improve extraction quality and scraper observability.
3. Add persistence, saved searches, and deduplication.
4. Reuse the same adapter contract to add more websites safely.
