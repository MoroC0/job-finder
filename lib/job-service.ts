import { fetchLinkedInJobDetails, fetchLinkedInJobs } from './sources/linkedin-scraper';
import { fetchJobindexJobs } from './sources/jobindex-scraper';
import { fetchWorkindenmarkJobs } from './sources/workindenmark-scraper';
import type { Job, JobDetails } from './types';

export interface JobSearchParams {
  keywords?: string;
  location?: string;
  company?: string;
  datePosted?: 'any' | 'day' | 'week' | 'month';
  experienceLevel?: 'any' | 'internship' | 'entry' | 'associate' | 'mid-senior' | 'director' | 'executive';
  workplaceType?: 'any' | 'remote' | 'hybrid' | 'on-site';
  jobType?: 'any' | 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship';
  resultLimit?: number;
}

interface JobSourceConfig {
  label: string;
  fetchJobs: (search: Required<JobSearchParams>) => Promise<Job[]>;
  fetchJobDetails?: (sourceJobId: string) => Promise<JobDetails>;
  maxConcurrentKeywordQueries?: number;
}

const SOURCE_CONFIG = {
  linkedin: {
    label: 'LinkedIn',
    fetchJobs: fetchLinkedInJobs,
    fetchJobDetails: fetchLinkedInJobDetails,
    maxConcurrentKeywordQueries: 2,
  },
  jobindex: {
    label: 'Jobindex.dk',
    fetchJobs: fetchJobindexJobs,
    maxConcurrentKeywordQueries: 1,
  },
  workindenmark: {
    label: 'Workindenmark',
    fetchJobs: fetchWorkindenmarkJobs,
    maxConcurrentKeywordQueries: 1,
  },
} as const satisfies Record<string, JobSourceConfig>;

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
  keywordQueries: string[];
  jobs: Job[];
  results: JobSourceResult[];
}

export const MAX_KEYWORD_QUERIES = 5;
export const JOB_SOURCE_KEYS = Object.keys(SOURCE_CONFIG) as JobSourceKey[];
export const DEFAULT_JOB_SEARCH: Required<JobSearchParams> = {
  keywords: 'software engineer',
  location: 'Remote',
  company: '',
  datePosted: 'any',
  experienceLevel: 'any',
  workplaceType: 'any',
  jobType: 'any',
  resultLimit: 50,
};

export function isJobSourceKey(value: string): value is JobSourceKey {
  return value in SOURCE_CONFIG;
}

export async function getJobsFromSources(sources?: JobSourceKey[], search?: JobSearchParams): Promise<Job[]> {
  const report = await getJobsReportFromSources(sources, search);
  return report.jobs;
}

export async function getJobDetails(source: JobSourceKey, sourceJobId: string): Promise<JobDetails> {
  const config: JobSourceConfig = SOURCE_CONFIG[source];
  if (!config.fetchJobDetails) {
    throw new Error(`${config.label} does not provide applicant details.`);
  }

  return config.fetchJobDetails(sourceJobId);
}

export async function getJobsReportFromSources(
  sources?: JobSourceKey[],
  search?: JobSearchParams
): Promise<JobsReport> {
  const selectedSources: JobSourceKey[] = sources && sources.length > 0 ? sources : ['linkedin'];
  const normalizedSearch = normalizeSearchParams(search);
  const keywordQueries = parseKeywordQueries(normalizedSearch.keywords);
  const results = await Promise.all(
    selectedSources.map((source) => getSourceResult(source, normalizedSearch, keywordQueries))
  );
  const jobs = results.flatMap((result) => result.jobs);

  return {
    requestedSources: selectedSources,
    fallbackApplied: sources === undefined || sources.length === 0,
    search: normalizedSearch,
    keywordQueries,
    jobs: mergeJobsNewestFirst(jobs, normalizedSearch.resultLimit),
    results,
  };
}

async function getSourceResult(
  source: JobSourceKey,
  search: Required<JobSearchParams>,
  keywordQueries: string[]
): Promise<JobSourceResult> {
  const config = SOURCE_CONFIG[source];
  const resultLimitPerQuery = Math.ceil(search.resultLimit / keywordQueries.length);
  const queryResults = await mapSettledWithConcurrency(
    keywordQueries,
    config.maxConcurrentKeywordQueries ?? 1,
    (keywords) => config.fetchJobs({ ...search, keywords, resultLimit: resultLimitPerQuery })
  );
  const successfulJobs = queryResults.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  );
  const failedQueries = queryResults.filter((result) => result.status === 'rejected');

  if (failedQueries.length === queryResults.length) {
    const firstFailure = failedQueries[0];
    return {
      key: source,
      label: config.label,
      status: 'error',
      jobs: [],
      error: getErrorMessage(firstFailure?.status === 'rejected' ? firstFailure.reason : undefined),
    };
  }

  const jobs = mergeJobsNewestFirst(successfulJobs, search.resultLimit);
  return {
    key: source,
    label: config.label,
    status: jobs.length > 0 ? 'success' : 'empty',
    jobs,
    error: failedQueries.length > 0
      ? `${failedQueries.length} of ${keywordQueries.length} keyword searches failed; showing the successful results.`
      : undefined,
  };
}

async function mapSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => runWorker())
  );
  return results;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown source error.';
}

function normalizeSearchParams(search?: JobSearchParams): Required<JobSearchParams> {
  const keywordQueries = parseKeywordQueries(search?.keywords);

  return {
    keywords: keywordQueries.join(', '),
    location: search?.location?.trim() || DEFAULT_JOB_SEARCH.location,
    company: search?.company?.trim() || DEFAULT_JOB_SEARCH.company,
    datePosted: search?.datePosted || DEFAULT_JOB_SEARCH.datePosted,
    experienceLevel: search?.experienceLevel || DEFAULT_JOB_SEARCH.experienceLevel,
    workplaceType: search?.workplaceType || DEFAULT_JOB_SEARCH.workplaceType,
    jobType: search?.jobType || DEFAULT_JOB_SEARCH.jobType,
    resultLimit: normalizeResultLimit(search?.resultLimit),
  };
}

export function parseKeywordQueries(value?: string): string[] {
  const rawKeywords = value?.trim() || DEFAULT_JOB_SEARCH.keywords;
  const seen = new Set<string>();

  return rawKeywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => {
      const normalizedKeyword = keyword.toLocaleLowerCase();
      if (!keyword || seen.has(normalizedKeyword)) return false;
      seen.add(normalizedKeyword);
      return true;
    })
    .slice(0, MAX_KEYWORD_QUERIES);
}

function mergeJobsNewestFirst(jobs: Job[], resultLimit: number): Job[] {
  const jobsById = new Map<string, Job>();

  for (const job of jobs) {
    if (!jobsById.has(job.id)) jobsById.set(job.id, job);
  }

  return [...jobsById.values()]
    .sort(compareJobsNewestFirst)
    .slice(0, resultLimit);
}

function compareJobsNewestFirst(left: Job, right: Job): number {
  const leftTime = left.postedAt ? Date.parse(left.postedAt) : Number.NaN;
  const rightTime = right.postedAt ? Date.parse(right.postedAt) : Number.NaN;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return rightTime - leftTime;
}

function normalizeResultLimit(value?: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_JOB_SEARCH.resultLimit;
  }

  return Math.min(100, Math.max(1, Math.floor(value as number)));
}
