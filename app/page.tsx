import { JobList } from '@/components/JobList';
import { JobSourcePanel } from '@/components/JobSourcePanel';
import { getJobsFromSources } from '@/lib/job-service';

export default async function HomePage() {
  const jobs = await getJobsFromSources();

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Job Finder</p>
          <h1>Personalized job aggregation built with Next.js</h1>
          <p className="description">
            Discover, filter, and save jobs from multiple sources in one place. Start by building the backend integration and then connect live sources.
          </p>
        </div>
      </section>

      <section className="content-section">
        <div className="section-header">
          <h2>Latest jobs</h2>
          <p>Showing the default mock data. Use the source panel below to test live source adapters.</p>
        </div>
        <JobList jobs={jobs} />
      </section>

      <section className="content-section">
        <div className="section-header">
          <h2>Scrape a live source</h2>
          <p>Use this panel to fetch jobs from sample career pages and inspect the results.</p>
        </div>
        <JobSourcePanel />
      </section>
    </main>
  );
}
