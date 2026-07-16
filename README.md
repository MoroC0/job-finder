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

This repository is primarily for learning and experimentation. Use the workflow below to keep changes small and easy to review.

1. Create a new branch for each feature, experiment, or learning task.
2. Work on one thing at a time.
3. Commit often with clear messages.
4. Run `npm run build` and `npm run typecheck` before pushing.
5. Use the GitHub Actions CI workflow in `.github/workflows/ci.yml` to verify builds.

## Learning notes

- Treat this repo as a personal sandbox.
- Experiment with one concept per branch.
- Record what you learn in commit messages or issue notes.

## Next improvements

- Add job search and filter UI
- Enable a stable sample scraping adapter
- Add persistence for scraped jobs
- Add source management and deduplication
- Add NLP extraction for structured fields
