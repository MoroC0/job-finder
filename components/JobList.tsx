'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { JobCard } from '@/components/JobCard';
import type { Job, JobDetails } from '@/lib/types';

interface Props {
  jobs: Job[];
}

type SortKey = 'postedAt' | 'applicants';
type PostedOrder = 'off' | 'newest' | 'oldest';
type ApplicantOrder = 'off' | 'fewest' | 'most';
type JobDetailsState = Record<string, JobDetails | null | undefined>;

const DETAIL_CONCURRENCY = 2;
const DETAIL_REQUEST_ATTEMPTS = 2;

export function JobList({ jobs }: Props) {
  const [postedOrder, setPostedOrder] = useState<PostedOrder>('off');
  const [applicantOrder, setApplicantOrder] = useState<ApplicantOrder>('off');
  const [sortPriority, setSortPriority] = useState<SortKey[]>([]);
  const [detailsByJobId, setDetailsByJobId] = useState<JobDetailsState>({});
  const [loadingAllDetails, setLoadingAllDetails] = useState(false);
  const [applicantSortReady, setApplicantSortReady] = useState(false);
  const detailRequests = useRef(new Map<string, Promise<JobDetails | null>>());
  const applicantSortActive = applicantOrder !== 'off';

  const requestJobDetails = useCallback(async (job: Job): Promise<JobDetails | null> => {
    const existingRequest = detailRequests.current.get(job.id);
    if (existingRequest) return existingRequest;

    const sourceJobId = getLinkedInId(job);
    if (!sourceJobId) {
      setDetailsByJobId((current) => ({ ...current, [job.id]: null }));
      return null;
    }

    const request = fetchJobDetails(sourceJobId).then((details) => {
      setDetailsByJobId((current) => ({ ...current, [job.id]: details }));
      return details;
    });

    detailRequests.current.set(job.id, request);
    return request;
  }, []);

  useEffect(() => {
    if (!applicantSortActive) {
      setLoadingAllDetails(false);
      setApplicantSortReady(false);
      return;
    }

    let cancelled = false;
    setApplicantSortReady(false);
    setLoadingAllDetails(true);

    void runWithConcurrency(jobs, DETAIL_CONCURRENCY, requestJobDetails).finally(() => {
      if (!cancelled) {
        setLoadingAllDetails(false);
        setApplicantSortReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applicantSortActive, jobs, requestJobDetails]);

  function handlePostedSort() {
    const nextOrder = getNextPostedOrder(postedOrder);
    setPostedOrder(nextOrder);
    setSortPriority((current) => updateSortPriority(current, 'postedAt', nextOrder !== 'off'));
  }

  function handleApplicantSort() {
    const nextOrder = getNextApplicantOrder(applicantOrder);
    setApplicantOrder(nextOrder);
    if (nextOrder === 'off') setApplicantSortReady(false);
    setSortPriority((current) => updateSortPriority(current, 'applicants', nextOrder !== 'off'));
  }

  const sortedJobs = sortJobs(
    jobs,
    sortPriority,
    postedOrder,
    applicantOrder,
    applicantSortReady,
    detailsByJobId
  );

  if (jobs.length === 0) {
    return <p className="empty-state">No jobs were found. Try broadening the keywords, location, or one of the filters above.</p>;
  }

  return (
    <div className="job-results">
      <div className="sort-panel" aria-label="Job sorting controls">
        <div>
          <p className="sort-label">Order results</p>
          <p className="sort-helper">Enable either sort alone, or enable both. The first enabled option is the primary order.</p>
        </div>
        <div className="sort-actions">
          <button
            type="button"
            className={postedOrder === 'off' ? 'sort-button' : 'sort-button is-active'}
            onClick={handlePostedSort}
            aria-pressed={postedOrder !== 'off'}
          >
            {getSortPosition(sortPriority, 'postedAt') ? <span>{getSortPosition(sortPriority, 'postedAt')}</span> : null}
            {getPostedButtonLabel(postedOrder)}
          </button>
          <button
            type="button"
            className={applicantOrder === 'off' ? 'sort-button' : 'sort-button is-active'}
            onClick={handleApplicantSort}
            aria-pressed={applicantOrder !== 'off'}
          >
            {getSortPosition(sortPriority, 'applicants') ? <span>{getSortPosition(sortPriority, 'applicants')}</span> : null}
            {getApplicantButtonLabel(applicantOrder)}
          </button>
        </div>
        {loadingAllDetails ? <p className="sort-progress">Loading applicant counts before applying the complete order...</p> : null}
      </div>

      <div className="job-grid">
        {sortedJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            details={detailsByJobId[job.id]}
            onRequestDetails={requestJobDetails}
          />
        ))}
      </div>
    </div>
  );
}

async function fetchJobDetails(sourceJobId: string): Promise<JobDetails | null> {
  const params = new URLSearchParams({ source: 'linkedin', id: sourceJobId });

  for (let attempt = 1; attempt <= DETAIL_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`/api/jobs/details?${params.toString()}`);
      if (response.ok) return (await response.json()) as JobDetails;
      if (attempt === DETAIL_REQUEST_ATTEMPTS || ![429, 502, 503, 504].includes(response.status)) {
        return null;
      }

      const retryAfter = response.headers.get('retry-after');
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
      await wait(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 500 * attempt);
    } catch {
      if (attempt === DETAIL_REQUEST_ATTEMPTS) return null;
      await wait(500 * attempt);
    }
  }

  return null;
}

async function runWithConcurrency(
  jobs: Job[],
  concurrency: number,
  worker: (job: Job) => Promise<JobDetails | null>
): Promise<void> {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex];
      nextIndex += 1;
      await worker(job);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, runWorker));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function sortJobs(
  jobs: Job[],
  priority: SortKey[],
  postedOrder: PostedOrder,
  applicantOrder: ApplicantOrder,
  applicantSortReady: boolean,
  detailsByJobId: JobDetailsState
): Job[] {
  return jobs
    .map((job, originalIndex) => ({ job, originalIndex }))
    .sort((left, right) => {
      for (const key of priority) {
        if (key === 'applicants' && !applicantSortReady) continue;

        const comparison = key === 'postedAt'
          ? compareOptionalNumbers(getPostedTimestamp(left.job), getPostedTimestamp(right.job), postedOrder === 'oldest')
          : compareOptionalNumbers(
              detailsByJobId[left.job.id]?.applicantCount ?? null,
              detailsByJobId[right.job.id]?.applicantCount ?? null,
              applicantOrder === 'fewest'
            );

        if (comparison !== 0) return comparison;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ job }) => job);
}

function compareOptionalNumbers(left: number | null, right: number | null, ascending: boolean): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return ascending ? left - right : right - left;
}

function getPostedTimestamp(job: Job): number | null {
  if (!job.postedAt) return null;
  const timestamp = Date.parse(job.postedAt);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLinkedInId(job: Job): string | null {
  if (job.source !== 'LinkedIn') return null;
  return job.id.match(/^linkedin-(\d+)$/)?.[1] ?? null;
}

function updateSortPriority(current: SortKey[], key: SortKey, enabled: boolean): SortKey[] {
  if (!enabled) return current.filter((item) => item !== key);
  return current.includes(key) ? current : [...current, key];
}

function getSortPosition(priority: SortKey[], key: SortKey): number | null {
  const index = priority.indexOf(key);
  return index === -1 ? null : index + 1;
}

function getNextPostedOrder(current: PostedOrder): PostedOrder {
  if (current === 'off') return 'newest';
  if (current === 'newest') return 'oldest';
  return 'off';
}

function getNextApplicantOrder(current: ApplicantOrder): ApplicantOrder {
  if (current === 'off') return 'fewest';
  if (current === 'fewest') return 'most';
  return 'off';
}

function getPostedButtonLabel(order: PostedOrder): string {
  if (order === 'newest') return 'Newest first';
  if (order === 'oldest') return 'Oldest first';
  return 'Sort by posting time';
}

function getApplicantButtonLabel(order: ApplicantOrder): string {
  if (order === 'fewest') return 'Fewest applicants';
  if (order === 'most') return 'Most applicants';
  return 'Sort by applicants';
}
