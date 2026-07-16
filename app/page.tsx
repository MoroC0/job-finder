import { JobSourcePanel } from '@/components/JobSourcePanel';
import { ThemeControls } from '@/components/ThemeControls';
import { DEFAULT_JOB_SEARCH, getJobsFromSources } from '@/lib/job-service';

export default async function HomePage() {
  const jobs = await getJobsFromSources(['linkedin'], DEFAULT_JOB_SEARCH);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-topbar">
          <div>
            <p className="eyebrow">Job Finder</p>
            <h1>Find sharper job matches with a cleaner LinkedIn search flow</h1>
            <p className="description">
              Search live LinkedIn listings by role, location, company, and a few practical filters, then review the latest jobs found below.
            </p>
          </div>
          <ThemeControls />
        </div>
        <div className="hero-highlights">
          <div className="hero-stat">
            <span>Active source</span>
            <strong>LinkedIn</strong>
          </div>
          <div className="hero-stat">
            <span>Default role</span>
            <strong>{DEFAULT_JOB_SEARCH.keywords}</strong>
          </div>
          <div className="hero-stat">
            <span>Default location</span>
            <strong>{DEFAULT_JOB_SEARCH.location}</strong>
          </div>
        </div>
      </section>

      <section className="content-section search-section">
        <JobSourcePanel initialJobs={jobs} />
      </section>

      <section className="content-section results-section">
        <div className="section-header">
          <h2>Buildable next steps</h2>
          <p>
            The search model is now ready for future sources too, so the next product work can focus on result quality, deduplication, and saved searches.
          </p>
        </div>
        <div className="next-steps-grid">
          <article className="next-step-card">
            <h3>Improve extraction</h3>
            <p>Parse more metadata from each card and normalize fields like seniority, recency, and job type more reliably.</p>
          </article>
          <article className="next-step-card">
            <h3>Add saved searches</h3>
            <p>Persist useful combinations of keywords, company, and location so this becomes a repeatable daily workflow.</p>
          </article>
          <article className="next-step-card">
            <h3>Prepare more adapters</h3>
            <p>Reuse the same search contract when we add more websites, instead of redesigning filters source by source.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
