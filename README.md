# Job Finder

A personal job aggregation prototype built with **Next.js**, **React**, and **TypeScript**.

## What this repo contains

- A Next.js app under `app/`
- Job components in `components/`
- A job service layer in `lib/`
- Sample job source adapters for mock, Indeed, and LinkedIn
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

## Workflow

1. Create a branch for each feature or experiment.
2. Make small, testable changes.
3. Commit often with clear messages.
4. Use the GitHub Actions CI workflow to verify builds.

## Next improvements

- Add job search and filter UI
- Enable a stable sample scraping adapter
- Add persistence for scraped jobs
- Add source management and deduplication
- Add NLP extraction for structured fields
