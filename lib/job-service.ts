import { fetchLinkedInJobs } from './sources/linkedin-scraper';
import type { Job } from './types';

export interface JobSearchParams {
  keywords?: string;
  location?: string;
  company?: string;
  datePosted?: 'any' | 'day' | 'week' | 'month';
  experienceLevel?: 'any' | 'internship' | 'entry' | 'associate' | 'mid-senior' | 'director' | 'executive';
  workplaceType?: 'any' | 'remote' | 'hybrid' | 'on-site';
  jobType?: 'any' | 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship';
}

const SOURCE_CONFIG = {
  linkedin: {
    label: 'LinkedIn',
    fetchJobs: fetchLinkedInJobs,
  },
} as const;

export type JobSourceKey = keyof typeof SOURCE_CONFIG;
export type JobSourceStatus = 'success' | 'empty' | 'error';

export interface JobSourceResult {
  key: JobSourceKey;
  label: string;
  status: JobSourceStatus;
  jobs: Job[];
  error?: string;
}

export interface JobsReport {
  requestedSources: JobSourceKey[];
  fallbackApplied: boolean;
  search: Required<JobSearchParams>;
  jobs: Job[];
  results: JobSourceResult[];
}

export const JOB_SOURCE_KEYS = Object.keys(SOURCE_CONFIG) as JobSourceKey[];
export const DEFAULT_JOB_SEARCH: Required<JobSearchParams> = {
  keywords: 'software engineer',
  location: 'Remote',
  company: '',
  datePosted: 'any',
  experienceLevel: 'any',
  workplaceType: 'any',
  jobType: 'any',
};

export function isJobSourceKey(value: string): value is JobSourceKey {
  return value in SOURCE_CONFIG;
}

export async function getJobsFromSources(sources?: JobSourceKey[], search?: JobSearchParams): Promise<Job[]> {
  const report = await getJobsReportFromSources(sources, search);
  return report.jobs;
}

export async function getJobsReportFromSources(
  sources?: JobSourceKey[],
  search?: JobSearchParams
): Promise<JobsReport> {
  const selectedSources: JobSourceKey[] = sources && sources.length > 0 ? sources : ['linkedin'];
  const normalizedSearch = normalizeSearchParams(search);
  const results: JobSourceResult[] = [];
  const jobs: Job[] = [];

  for (const source of selectedSources) {
    results.push(await getSourceResult(source, normalizedSearch));
  }

  for (const result of results) {
    jobs.push(...result.jobs);
  }

  return {
    requestedSources: selectedSources,
    fallbackApplied: sources === undefined || sources.length === 0,
    search: normalizedSearch,
    jobs,
    results,
  };
}

async function getSourceResult(
  source: JobSourceKey,
  search: Required<JobSearchParams>
): Promise<JobSourceResult> {
  const config = SOURCE_CONFIG[source];

  try {
    const jobs = await config.fetchJobs(search);

    return {
      key: source,
      label: config.label,
      status: jobs.length > 0 ? 'success' : 'empty',
      jobs,
    };
  } catch (error) {
    return {
      key: source,
      label: config.label,
      status: 'error',
      jobs: [],
      error: getErrorMessage(error),
    };
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown source error.';
}

function normalizeSearchParams(search?: JobSearchParams): Required<JobSearchParams> {
  return {
    keywords: search?.keywords?.trim() || DEFAULT_JOB_SEARCH.keywords,
    location: search?.location?.trim() || DEFAULT_JOB_SEARCH.location,
    company: search?.company?.trim() || DEFAULT_JOB_SEARCH.company,
    datePosted: search?.datePosted || DEFAULT_JOB_SEARCH.datePosted,
    experienceLevel: search?.experienceLevel || DEFAULT_JOB_SEARCH.experienceLevel,
    workplaceType: search?.workplaceType || DEFAULT_JOB_SEARCH.workplaceType,
    jobType: search?.jobType || DEFAULT_JOB_SEARCH.jobType,
  };
}
