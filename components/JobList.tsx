import type { Job } from '@/lib/types';
import { JobCard } from '@/components/JobCard';

interface Props {
  jobs: Job[];
}

export function JobList({ jobs }: Props) {
  if (jobs.length === 0) {
    return <p className="empty-state">No jobs were found. Try broadening the keywords, location, or one of the filters above.</p>;
  }

  return (
    <div className="job-grid">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
