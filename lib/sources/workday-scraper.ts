import type { JobSearchParams } from '../job-service';
import type { Job } from '../types';
import {
  getMatchingWorkdayCompanies,
  type WorkdayCompany,
} from './workday-companies';
import {
  buildWorkdayJobUrl,
  getWorkdayCanonicalId,
  getWorkdayRequisitionId,
} from './workday-utils';
import { getWorkdayCountryId } from './workday-countries';

const WORKDAY_PAGE_SIZE = 20;
const WORKDAY_MAX_PAGES_PER_COMPANY = 2;
const WORKDAY_COMPANY_CONCURRENCY = 3;
const WORKDAY_REQUEST_ATTEMPTS = 2;
const WORKDAY_REQUEST_TIMEOUT_MS = 12000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface WorkdayJobPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdaySearchResponse {
  total?: number;
  jobPostings?: WorkdayJobPosting[];
}

interface WorkdaySearchBody {
  appliedFacets: Record<string, string[]>;
  limit: number;
  offset: number;
  searchText: string;
}

export async function fetchWorkdayJobs(search: Required<JobSearchParams>): Promise<Job[]> {
  const companies = getMatchingWorkdayCompanies(search.company);
  if (companies.length === 0) return [];

  const targetPerCompany = Math.min(
    WORKDAY_PAGE_SIZE * WORKDAY_MAX_PAGES_PER_COMPANY,
    Math.max(5, Math.ceil(search.resultLimit / companies.length) * 2)
  );
  const companyResults = await mapSettledWithConcurrency(
    companies,
    WORKDAY_COMPANY_CONCURRENCY,
    (company) => fetchCompanyJobs(company, search, targetPerCompany)
  );
  const successfulResults = companyResults.filter(
    (result): result is PromiseFulfilledResult<Job[]> => result.status === 'fulfilled'
  );

  if (successfulResults.length === 0) {
    const firstFailure = companyResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    throw new Error(
      `Workday company searches failed: ${getErrorMessage(firstFailure?.reason)}`
    );
  }

  return mergeJobsNewestFirst(
    successfulResults.flatMap((result) => result.value),
    search.resultLimit
  );
}

async function fetchCompanyJobs(
  company: WorkdayCompany,
  search: Required<JobSearchParams>,
  target: number
): Promise<Job[]> {
  const jobsById = new Map<string, Job>();

  for (
    let pageNumber = 0;
    pageNumber < WORKDAY_MAX_PAGES_PER_COMPANY && jobsById.size < target;
    pageNumber += 1
  ) {
    const offset = pageNumber * WORKDAY_PAGE_SIZE;
    const response = await fetchWorkdayPage(company, search, offset);
    const postings = response.jobPostings ?? [];

    for (const posting of postings) {
      const job = toJob(company, posting);
      if (job && matchesSearchFilters(job, search)) {
        jobsById.set(job.canonicalId ?? job.id, job);
      }
    }

    if (
      postings.length < WORKDAY_PAGE_SIZE ||
      offset + WORKDAY_PAGE_SIZE >= (response.total ?? postings.length)
    ) {
      break;
    }
  }

  return [...jobsById.values()]
    .sort(compareJobsNewestFirst)
    .slice(0, target);
}

async function fetchWorkdayPage(
  company: WorkdayCompany,
  search: Required<JobSearchParams>,
  offset: number
): Promise<WorkdaySearchResponse> {
  const url = `https://${company.host}/wday/cxs/${company.tenant}/${company.site}/jobs`;
  const countryId = getWorkdayCountryId(search.workdayCountry);
  const body: WorkdaySearchBody = {
    appliedFacets: countryId ? { locationCountry: [countryId] } : {},
    limit: WORKDAY_PAGE_SIZE,
    offset,
    searchText: buildSearchText(search),
  };
  let lastError: unknown;

  for (let attempt = 1; attempt <= WORKDAY_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'JobFinderLocal/0.1',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WORKDAY_REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });

      if (response.ok) return (await response.json()) as WorkdaySearchResponse;

      lastError = new Error(`${company.name} Workday request returned ${response.status}.`);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === WORKDAY_REQUEST_ATTEMPTS) {
        break;
      }

      await wait(response.status === 429 ? 1500 * attempt : 500 * attempt);
    } catch (error) {
      lastError = error;
      if (attempt === WORKDAY_REQUEST_ATTEMPTS) break;
      await wait(500 * attempt);
    }
  }

  throw new Error(`${company.name} Workday request failed: ${getErrorMessage(lastError)}`);
}

function toJob(company: WorkdayCompany, posting: WorkdayJobPosting): Job | null {
  if (!posting.title || !posting.externalPath) return null;

  const url = buildWorkdayJobUrl(company, posting.externalPath);
  const requisitionId = getWorkdayRequisitionId(posting.externalPath);
  const postedAt = parsePostedAt(posting.postedOn);
  const type = getJobType(posting);

  return {
    id: `workday-${company.key}-${normalizeIdPart(requisitionId ?? posting.externalPath)}`,
    canonicalId: getWorkdayCanonicalId(url),
    title: normalizeText(posting.title),
    company: company.name,
    location: normalizeText(posting.locationsText ?? '') || 'Location unavailable',
    type,
    posted: normalizeText(posting.postedOn ?? '') || 'Unknown',
    postedAt,
    description: getDescription(company, posting, type),
    source: 'Workday',
    url,
  };
}

function buildSearchText(search: Required<JobSearchParams>): string {
  const queryParts = [search.keywords];
  const location = search.location.trim();

  if (
    search.workdayCountry === 'any' &&
    location &&
    !['any', 'worldwide'].includes(location.toLocaleLowerCase())
  ) {
    queryParts.push(location);
  }

  return queryParts.join(' ').trim();
}

function matchesSearchFilters(job: Job, search: Required<JobSearchParams>): boolean {
  if (!matchesDatePosted(job.postedAt, search.datePosted)) return false;
  if (!matchesKeywords(job.title, search.keywords)) return false;

  const searchableText = `${job.title} ${job.location} ${job.type}`.toLocaleLowerCase();
  const remoteRequested =
    search.workplaceType === 'remote' ||
    (
      search.workdayCountry === 'any' &&
      search.location.trim().toLocaleLowerCase() === 'remote'
    );

  if (remoteRequested && !/\b(remote|home office|work from home)\b/i.test(searchableText)) {
    return false;
  }

  if (
    !remoteRequested &&
    search.workdayCountry === 'any' &&
    !matchesLocation(job.location, search.location)
  ) {
    return false;
  }

  if (search.workplaceType === 'hybrid' && !/\b(hybrid|flex)\b/i.test(searchableText)) {
    return false;
  }

  if (
    search.workplaceType === 'on-site' &&
    /\b(remote|hybrid|flex|home office|work from home)\b/i.test(searchableText)
  ) {
    return false;
  }

  if (!matchesJobType(job, search.jobType)) return false;
  return matchesExperienceLevel(job.title, search.experienceLevel);
}

function matchesKeywords(title: string, keywords: string): boolean {
  const normalizedTitle = normalizeForMatching(title);
  const keywordTokens = normalizeForMatching(keywords)
    .split(' ')
    .filter((token) => token.length >= 2);

  return keywordTokens.length === 0 || keywordTokens.some((token) => normalizedTitle.includes(token));
}

function matchesLocation(jobLocation: string, requestedLocation: string): boolean {
  const normalizedRequest = normalizeForMatching(requestedLocation);
  if (!normalizedRequest || ['any', 'worldwide'].includes(normalizedRequest)) return true;

  const normalizedJobLocation = normalizeForMatching(jobLocation);
  if (/\b\d+\s+locations?\b/i.test(jobLocation)) return true;
  if (
    normalizedJobLocation.includes(normalizedRequest) ||
    normalizedRequest.includes(normalizedJobLocation)
  ) {
    return true;
  }

  if (['denmark', 'danmark'].includes(normalizedRequest)) {
    return [
      'aalborg',
      'aarhus',
      'ballerup',
      'billund',
      'copenhagen',
      'gentofte',
      'hellerup',
      'herlev',
      'kalundborg',
      'kobenhavn',
      'lyngby',
      'odense',
      'soborg',
      'vejle',
    ].some((location) => normalizedJobLocation.includes(location));
  }

  return false;
}

function matchesJobType(job: Job, jobType: Required<JobSearchParams>['jobType']): boolean {
  if (jobType === 'any') return true;

  const text = `${job.title} ${job.type}`.toLocaleLowerCase();
  switch (jobType) {
    case 'full-time':
      return /\bfull[ -]?time\b/.test(text);
    case 'part-time':
      return /\bpart[ -]?time\b/.test(text);
    case 'contract':
      return /\b(contract|contractor)\b/.test(text);
    case 'temporary':
      return /\b(temporary|fixed term|limited duration)\b/.test(text);
    case 'internship':
      return /\b(intern|internship|student)\b/.test(text);
  }
}

function matchesExperienceLevel(
  title: string,
  level: Required<JobSearchParams>['experienceLevel']
): boolean {
  if (level === 'any') return true;

  switch (level) {
    case 'internship':
      return /\b(intern|internship|student)\b/i.test(title);
    case 'entry':
      return /\b(entry|junior|graduate|new grad)\b/i.test(title);
    case 'associate':
      return /\bassociate\b/i.test(title);
    case 'mid-senior':
      return /\b(senior|sr\.?|lead|principal|staff)\b/i.test(title);
    case 'director':
      return /\b(director|head of)\b/i.test(title);
    case 'executive':
      return /\b(executive|vice president|vp|chief)\b/i.test(title);
  }
}

function getJobType(posting: WorkdayJobPosting): string {
  const bulletText = (posting.bulletFields ?? []).join(' ');

  if (/\bpart[ -]?time\b/i.test(bulletText)) return 'Part-time';
  if (/\bfull[ -]?time\b/i.test(bulletText)) return 'Full-time';
  if (/\btemporary\b|\bfixed term\b|\blimited duration\b/i.test(bulletText)) {
    return 'Temporary';
  }
  if (/\bcontract\b/i.test(bulletText)) return 'Contract';
  return 'Unspecified';
}

function getDescription(
  company: WorkdayCompany,
  posting: WorkdayJobPosting,
  type: string
): string {
  const details = (posting.bulletFields ?? [])
    .map(normalizeText)
    .filter(
      (value) =>
        value &&
        value.toLocaleLowerCase() !== type.toLocaleLowerCase() &&
        !/^(?:jr|r)[-_]?\d/i.test(value)
    );

  return details.length > 0
    ? details.join(' | ')
    : `Details available on ${company.name}'s Workday careers portal.`;
}

function parsePostedAt(postedOn?: string): string | undefined {
  if (!postedOn) return undefined;

  const normalized = normalizeText(postedOn).toLocaleLowerCase();
  let daysAgo: number | null = null;

  if (normalized === 'posted today' || normalized === 'today') {
    daysAgo = 0;
  } else if (normalized === 'posted yesterday' || normalized === 'yesterday') {
    daysAgo = 1;
  } else {
    const match = normalized.match(/posted\s+(\d+)\+?\s+days?\s+ago/);
    if (match) {
      const parsedDays = Number(match[1]);
      daysAgo = normalized.includes('+') ? parsedDays + 1 : parsedDays;
    }
  }

  if (daysAgo === null) return undefined;

  const postedAt = new Date();
  postedAt.setUTCHours(0, 0, 0, 0);
  postedAt.setUTCDate(postedAt.getUTCDate() - daysAgo);
  return postedAt.toISOString();
}

function matchesDatePosted(
  postedAt: string | undefined,
  value: Required<JobSearchParams>['datePosted']
): boolean {
  if (value === 'any') return true;
  if (!postedAt) return false;

  const maximumAge = value === 'day' ? 86400000 : value === 'week' ? 604800000 : 2592000000;
  return Date.now() - Date.parse(postedAt) <= maximumAge;
}

function mergeJobsNewestFirst(jobs: Job[], resultLimit: number): Job[] {
  const jobsById = new Map<string, Job>();

  for (const job of jobs) {
    const identity = job.canonicalId ?? job.id;
    if (!jobsById.has(identity)) jobsById.set(identity, job);
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
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, runWorker)
  );
  return results;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeIdPart(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown network error.';
}
