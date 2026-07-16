import type { Job } from '@/lib/types';

interface Props {
  job: Job;
}

export function JobCard({ job }: Props) {
  return (
    <article className="job-card">
      <h3>{job.title}</h3>
      <p>{job.company}</p>
      <div className="job-meta">
        <span className="badge">{job.location}</span>
        <span className="badge">{job.type}</span>
        <span className="badge">{job.posted}</span>
      </div>
      <p style={{ marginTop: '1rem' }}>{job.description}</p>
    </article>
  );
}
