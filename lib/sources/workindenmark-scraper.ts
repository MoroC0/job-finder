import type { JobSearchParams } from '../job-service';
import type { Job } from '../types';

const WORKINDENMARK_API_URL = 'https://workindenmark.jobnet.dk/bff/FindJob/Search';
const WORKINDENMARK_PAGE_SIZE = 10;
const WORKINDENMARK_MAX_PAGES = 10;
const WORKINDENMARK_MAX_ATTEMPTS = 2;
const WORKINDENMARK_REQUEST_TIMEOUT_MS = 12000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface WorkindenmarkJobAd {
  country?: string;
  municipality?: string;
  postalCode?: number;
  postalDistrictName?: string;
  hiringOrgName?: string;
  occupation?: string;
  workHourPartTime?: boolean;
  jobAdId?: string;
  jobAdUrl?: string;
  title?: string;
  description?: string;
  isExternal?: boolean;
  publicationDate?: string;
}

interface WorkindenmarkSearchResponse {
  jobAds?: WorkindenmarkJobAd[];
  totalJobAdCount?: number;
}

export async function fetchWorkindenmarkJobs(search: Required<JobSearchParams>): Promise<Job[]> {
  const jobsById = new Map<string, Job>();

  for (
    let pageNumber = 1;
    jobsById.size < search.resultLimit && pageNumber <= WORKINDENMARK_MAX_PAGES;
    pageNumber += 1
  ) {
    const response = await fetchWorkindenmarkPage(search, pageNumber);
    const jobAds = response.jobAds ?? [];

    for (const jobAd of jobAds) {
      const job = toJob(jobAd);
      if (job && matchesSearchFilters(job, jobAd, search)) {
        jobsById.set(job.id, job);
      }
    }

    const totalPages = Math.ceil((response.totalJobAdCount ?? jobAds.length) / WORKINDENMARK_PAGE_SIZE);
    if (
      jobAds.length < WORKINDENMARK_PAGE_SIZE ||
      pageNumber >= totalPages ||
      hasReachedDateBoundary(jobAds, search.datePosted)
    ) {
      break;
    }
  }

  return [...jobsById.values()]
    .sort(compareJobsNewestFirst)
    .slice(0, search.resultLimit);
}

async function fetchWorkindenmarkPage(
  search: Required<JobSearchParams>,
  pageNumber: number
): Promise<WorkindenmarkSearchResponse> {
  const url = buildWorkindenmarkSearchUrl(search, pageNumber);
  let lastError: unknown;

  for (let attempt = 1; attempt <= WORKINDENMARK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'JobFinderLocal/0.1',
          Accept: 'application/json',
          'x-csrf': '1',
          Referer: 'https://workindenmark.jobnet.dk/find-job',
        },
        signal: AbortSignal.timeout(WORKINDENMARK_REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });

      if (response.ok) return (await response.json()) as WorkindenmarkSearchResponse;

      lastError = new Error(`Workindenmark request returned ${response.status}.`);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === WORKINDENMARK_MAX_ATTEMPTS) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (attempt === WORKINDENMARK_MAX_ATTEMPTS) break;
    }

    await wait(500 * attempt);
  }

  throw new Error(`Workindenmark request failed: ${getErrorMessage(lastError)}`);
}

function buildWorkindenmarkSearchUrl(
  search: Required<JobSearchParams>,
  pageNumber: number
): string {
  const url = new URL(WORKINDENMARK_API_URL);
  const queryParts = [search.keywords, search.company];

  if (!isGenericDanishLocation(search.location)) {
    queryParts.push(search.location);
  }

  url.searchParams.set('resultsPerPage', String(WORKINDENMARK_PAGE_SIZE));
  url.searchParams.set('pageNumber', String(pageNumber));
  url.searchParams.set('orderType', 'PublicationDate');
  url.searchParams.set('searchString', queryParts.filter(Boolean).join(' ').trim());

  const workHoursType = getWorkHoursType(search.jobType);
  const employmentDurationType = getEmploymentDurationType(search.jobType);
  if (workHoursType) url.searchParams.set('workHoursType', workHoursType);
  if (employmentDurationType) {
    url.searchParams.set('employmentDurationType', employmentDurationType);
  }

  return url.toString();
}

function toJob(jobAd: WorkindenmarkJobAd): Job | null {
  if (!jobAd.jobAdId || !jobAd.title || !jobAd.hiringOrgName) return null;

  const postedAt = normalizeDate(jobAd.publicationDate);
  return {
    id: `workindenmark-${jobAd.jobAdId}`,
    title: normalizeText(jobAd.title),
    company: normalizeText(jobAd.hiringOrgName),
    location: getLocationLabel(jobAd),
    type: jobAd.workHourPartTime ? 'Part-time' : 'Full-time',
    posted: postedAt ? formatPostedDate(postedAt) : 'Unknown',
    postedAt,
    description: getDescription(jobAd),
    source: 'Workindenmark',
    url: jobAd.isExternal && jobAd.jobAdUrl
      ? jobAd.jobAdUrl
      : `https://workindenmark.jobnet.dk/find-job/${jobAd.jobAdId}`,
  };
}

function matchesSearchFilters(
  job: Job,
  jobAd: WorkindenmarkJobAd,
  search: Required<JobSearchParams>
): boolean {
  if (!matchesDatePosted(job.postedAt, search.datePosted)) return false;

  const searchableText = `${job.title} ${job.description} ${jobAd.occupation ?? ''}`.toLowerCase();
  const remoteRequested =
    search.location.trim().toLowerCase() === 'remote' || search.workplaceType === 'remote';

  if (remoteRequested && !/\b(remote|remote-first|work from home)\b/i.test(searchableText)) {
    return false;
  }

  if (search.workplaceType === 'hybrid' && !/\bhybrid\b/i.test(searchableText)) {
    return false;
  }

  return true;
}

function getLocationLabel(jobAd: WorkindenmarkJobAd): string {
  const postalDistrict = [jobAd.postalCode, normalizeText(jobAd.postalDistrictName ?? '')]
    .filter(Boolean)
    .join(' ');
  const locationParts = [postalDistrict, normalizeText(jobAd.municipality ?? '')]
    .filter((value, index, values) => value && values.indexOf(value) === index);

  return locationParts.join(', ') || normalizeText(jobAd.country ?? '') || 'Denmark';
}

function getDescription(jobAd: WorkindenmarkJobAd): string {
  const occupation = normalizeText(jobAd.occupation ?? '');
  const description = normalizeText(jobAd.description ?? '');
  const containsImportedPageChrome =
    /\b(skip to main content|page is loaded|accept cookies|decline cookies)\b/i.test(description);

  if (!description || containsImportedPageChrome) {
    return occupation ? `Occupation: ${occupation}.` : 'Details available on Workindenmark.';
  }

  const normalizedTitle = normalizeText(jobAd.title ?? '');
  const withoutRepeatedTitle = description.startsWith(normalizedTitle)
    ? description.slice(normalizedTitle.length).trim()
    : description;
  const excerpt = withoutRepeatedTitle.slice(0, 360).trim();
  if (excerpt) return `${excerpt}${withoutRepeatedTitle.length > excerpt.length ? '...' : ''}`;
  return occupation ? `Occupation: ${occupation}.` : 'Details available on Workindenmark.';
}

function getWorkHoursType(
  jobType: Required<JobSearchParams>['jobType']
): 'FullTime' | 'PartTime' | null {
  if (jobType === 'full-time') return 'FullTime';
  if (jobType === 'part-time') return 'PartTime';
  return null;
}

function getEmploymentDurationType(
  jobType: Required<JobSearchParams>['jobType']
): 'Temporary' | null {
  return jobType === 'temporary' ? 'Temporary' : null;
}

function isGenericDanishLocation(location: string): boolean {
  return ['remote', 'denmark', 'danmark'].includes(location.trim().toLowerCase());
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

function hasReachedDateBoundary(
  jobAds: WorkindenmarkJobAd[],
  value: Required<JobSearchParams>['datePosted']
): boolean {
  if (value === 'any') return false;

  const maximumAge = value === 'day' ? 86400000 : value === 'week' ? 604800000 : 2592000000;
  const cutoff = Date.now() - maximumAge;
  const publicationTimes = jobAds
    .map((jobAd) => Date.parse(jobAd.publicationDate ?? ''))
    .filter((timestamp) => !Number.isNaN(timestamp));

  return publicationTimes.length > 0 && Math.min(...publicationTimes) < cutoff;
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function formatPostedDate(postedAt: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Copenhagen',
  }).format(new Date(postedAt));
}

function compareJobsNewestFirst(left: Job, right: Job): number {
  const leftTime = left.postedAt ? Date.parse(left.postedAt) : Number.NaN;
  const rightTime = right.postedAt ? Date.parse(right.postedAt) : Number.NaN;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return rightTime - leftTime;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown network error.';
}
