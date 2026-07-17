import type { Job } from '@/lib/types';

interface Props {
  job: Job;
}

export function JobCard({ job }: Props) {
  return (
    <article className="job-card">
      <div className="job-card-header">
        <div>
          <p className="job-card-company">{job.company}</p>
          <h3>{job.title}</h3>
        </div>
        {job.source ? <span className="badge">{job.source}</span> : null}
      </div>
      <div className="job-meta">
        <span className="badge">{job.location}</span>
        <span className="badge">{job.type}</span>
        <span className="badge">{job.posted}</span>
      </div>
      <p className="job-description">{job.description}</p>
      {job.url ? (
        <p className="job-link-row">
          <a href={job.url} target="_blank" rel="noreferrer" className="job-link">
            View original job posting
          </a>
        </p>
      ) : null}
    </article>
  );
}
