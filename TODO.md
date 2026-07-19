# Job Finder Roadmap

The goal is a source-independent job-finding agent that prioritizes the user's criteria instead of a job board's recommendations. It should remain inexpensive, portable, and usable without maintaining a paid server.

## 1. Newest-first, deeper searches

- [x] Request LinkedIn results in newest-first order.
- [x] Fetch multiple LinkedIn result pages instead of stopping at 12 jobs.
- [x] Let the user choose a bounded result count (25-100).
- [x] Deduplicate jobs across fetched pages.
- [x] Preserve posting timestamps and sort the combined result set newest-first.
- [ ] Add clear progress feedback while multiple pages are being fetched.
- [ ] Detect LinkedIn throttling and retry temporary failures with backoff.
- [ ] Add tests using saved HTML fixtures so parser changes are safe.
- [ ] Improve extraction of job type, description, and other metadata.
- [x] Lazy-load applicant counts and original/reposted status for visible LinkedIn jobs.
- [x] Add composable posting-time and applicant-count ordering.
- [x] Run comma-separated keyword searches concurrently and merge them newest-first.

## 2. Local job history and exports

- [ ] Define a persistent job record with first-seen, last-seen, application status, and notes.
- [ ] Store results locally, starting with IndexedDB or SQLite depending on the deployment model.
- [ ] Merge new searches into history without duplicating existing postings.
- [ ] Add a table view with sorting, filtering, and application tracking.
- [ ] Export selected or filtered jobs to CSV and Excel.
- [ ] Consider generated reports only after the searchable table workflow is useful.

## 3. Portable, serverless usage

- [ ] Decide between a local desktop app/PWA and a free-tier hosted frontend with a local companion process.
- [ ] Make saved searches and preferences portable through import/export.
- [ ] Add installable PWA support for desktop and mobile access.
- [ ] Investigate browser restrictions around direct job-board requests before choosing deployment architecture.
- [ ] Avoid requiring an always-on paid server; document any free-tier or local runtime tradeoffs.

## Later expansions

- [ ] Add saved searches and one-click reruns.
- [ ] Compare current results with previous runs and highlight newly discovered jobs.
- [ ] Add optional scheduled searches and notifications when the chosen runtime supports them.
- [ ] Introduce additional job-board adapters behind the shared search contract.
- [x] Add Jobindex.dk using its structured public first-page search data.
- [ ] Normalize source-specific fields into one consistent job model.
- [ ] Add ranking based only on explicit user preferences, with transparent scoring.
