import type { Job } from '@/lib/types';
import { JobCard } from '@/components/JobCard';

interface Props {
  jobs: Job[];
}

export function JobList({ jobs }: Props) {
  return (
    <div className="job-grid">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
