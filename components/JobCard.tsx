'use client';

import { useEffect, useRef } from 'react';
import type { Job, JobDetails } from '@/lib/types';

interface Props {
  job: Job;
  details: JobDetails | null | undefined;
  onRequestDetails: (job: Job) => Promise<JobDetails | null>;
}

export function JobCard({ job, details, onRequestDetails }: Props) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || details !== undefined) return;

    if (!('IntersectionObserver' in window)) {
      void onRequestDetails(job);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void onRequestDetails(job);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [details, job, onRequestDetails]);

  return (
    <article className="job-card" ref={cardRef}>
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
      <div className="job-card-details" aria-live="polite">
        <div className="job-detail">
          <span className="job-detail-label">Applicants</span>
          <strong>{details === undefined ? 'Checking...' : details?.applicantCountLabel ?? 'Unavailable'}</strong>
        </div>
        <div className="job-detail">
          <span className="job-detail-label">Listing</span>
          <strong>{details === undefined ? 'Checking...' : details?.postingStatusLabel ?? 'Unavailable'}</strong>
        </div>
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
