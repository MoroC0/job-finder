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
            <h1>Find sharper job matches across sources in one clean search flow</h1>
            <p className="description">
              Search LinkedIn, Jobindex.dk, Workindenmark, and company Workday portals by role, location, company, and practical filters, then review one merged feed of the newest jobs.
            </p>
          </div>
          <ThemeControls />
        </div>
        <div className="hero-highlights">
          <div className="hero-stat">
            <span>Available sources</span>
            <strong>LinkedIn + Jobindex.dk + Workindenmark + Workday</strong>
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
            The multi-source search model is working, so the next product work can focus on persistence, scheduled searches, and richer extraction.
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
            <h3>Normalize more sources</h3>
            <p>Add more adapters through the shared contract while making source capabilities and limitations visible.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
