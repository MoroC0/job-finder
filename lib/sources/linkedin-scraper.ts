import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { JobSearchParams } from '../job-service';
import type { Job, JobDetails } from '../types';

const LINKEDIN_PAGE_SIZE = 10;
const LINKEDIN_REQUEST_TIMEOUT_MS = 12000;
const LINKEDIN_REQUEST_ATTEMPTS = 2;
const LINKEDIN_DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const LINKEDIN_DETAIL_CACHE_MAX_SIZE = 500;
const LINKEDIN_DETAIL_CONCURRENCY = 1;
const LINKEDIN_DETAIL_REQUEST_INTERVAL_MS = 1200;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface CachedJobDetails {
  details: JobDetails;
  expiresAt: number;
}

const detailCache = new Map<string, CachedJobDetails>();
const pendingDetailRequests = new Map<string, Promise<JobDetails>>();
const detailQueue: Array<() => void> = [];
let activeDetailRequests = 0;
let lastDetailRequestStartedAt = 0;

export async function fetchLinkedInJobDetails(linkedInId: string): Promise<JobDetails> {
  const cached = detailCache.get(linkedInId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.details;
  }

  if (cached) detailCache.delete(linkedInId);

  const pendingRequest = pendingDetailRequests.get(linkedInId);
  if (pendingRequest) return pendingRequest;

  const request = withDetailRequestSlot(async () => {
    const html = await fetchLinkedInHtml(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${linkedInId}`,
      'detail'
    );
    const $ = load(html);
    const applicantText = [
      '.num-applicants__caption',
      '.jobs-unified-top-card__applicant-count',
      '.job-details-jobs-unified-top-card__applicant-count',
      '.jobs-details-top-card__applicant-count',
    ]
      .map((selector) => normalizeText($(selector).first().text()))
      .find(Boolean) ?? '';
    const postedText = normalizeText(
      $('.posted-time-ago__text, .jobs-unified-top-card__posted-date, .job-details-jobs-unified-top-card__primary-description-container')
        .first()
        .text()
    );
    const applicantData = parseApplicantCount(applicantText);
    const isReposted = /\breposted\b/i.test(postedText);
    const details: JobDetails = {
      availability: 'available',
      ...applicantData,
      postingStatus: isReposted ? 'reposted' : postedText ? 'original' : 'unknown',
      postingStatusLabel: isReposted
        ? 'Reposted'
        : postedText
          ? 'Original posting'
          : 'Posting status unavailable',
    };

    cacheJobDetails(linkedInId, {
      details,
      expiresAt: Date.now() + LINKEDIN_DETAIL_CACHE_TTL_MS,
    });
    return details;
  }).finally(() => {
    pendingDetailRequests.delete(linkedInId);
  });

  pendingDetailRequests.set(linkedInId, request);
  return request;
}

export async function fetchLinkedInJobs(search: Required<JobSearchParams>): Promise<Job[]> {
  const jobsById = new Map<string, Job>();

  for (let start = 0; start < search.resultLimit; start += LINKEDIN_PAGE_SIZE) {
    let pageJobs: Job[];

    try {
      pageJobs = await fetchLinkedInPage(search, start);
    } catch (error) {
      if (jobsById.size === 0) {
        throw error;
      }

      break;
    }

    for (const job of pageJobs) {
      jobsById.set(job.id, job);
    }

    if (pageJobs.length < LINKEDIN_PAGE_SIZE) {
      break;
    }
  }

  return [...jobsById.values()]
    .sort(compareJobsNewestFirst)
    .slice(0, search.resultLimit);
}

async function fetchLinkedInPage(search: Required<JobSearchParams>, start: number): Promise<Job[]> {
  const searchUrl = buildLinkedInSearchUrl(search, start);
  const html = await fetchLinkedInHtml(searchUrl, 'search');
  const $ = load(html);
  const jobs: Job[] = [];

  $('li').each((_, element: Element) => {
    const title = $(element).find('h3.base-search-card__title, h3.result-card__title').text().trim();
    const company = $(element).find('h4.base-search-card__subtitle, h4.result-card__subtitle').text().trim();
    const location = $(element).find('.job-search-card__location, .result-card__meta .job-result-card__location').text().trim();
    const url = $(element).find('a.base-card__full-link, a.result-card__full-card-link, a').first().attr('href');
    const timeElement = $(element).find('time').first();
    const posted = timeElement.text().trim() || 'Unknown';
    const postedAt = timeElement.attr('datetime');
    const description = $(element).find('.job-search-card__snippet, .result-card__snippet').text().trim();
    const linkedInId = extractLinkedInJobId(url) ?? $(element).find('[data-entity-urn]').attr('data-entity-urn')?.split(':').pop();

    if (title && company && location) {
      jobs.push({
        id: linkedInId ? `linkedin-${linkedInId}` : createFallbackId(title, company, location),
        title,
        company,
        location,
        type: 'Full-time',
        posted,
        postedAt,
        description: description || 'Details available on LinkedIn.',
        source: 'LinkedIn',
        url,
      });
    }
  });

  return jobs;
}

function buildLinkedInSearchUrl(search: Required<JobSearchParams>, start: number): string {
  const url = new URL('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search');

  const keywordParts = [search.keywords, search.company].filter(Boolean);
  url.searchParams.set('keywords', keywordParts.join(' ').trim());
  url.searchParams.set('location', search.location);
  url.searchParams.set('sortBy', 'DD');
  url.searchParams.set('start', String(start));

  const timePosted = getLinkedInDatePostedValue(search.datePosted);
  const experienceLevel = getLinkedInExperienceValue(search.experienceLevel);
  const workplaceType = getLinkedInWorkplaceValue(search.workplaceType);
  const jobType = getLinkedInJobTypeValue(search.jobType);

  if (timePosted) {
    url.searchParams.set('f_TPR', timePosted);
  }

  if (experienceLevel) {
    url.searchParams.set('f_E', experienceLevel);
  }

  if (workplaceType) {
    url.searchParams.set('f_WT', workplaceType);
  }

  if (jobType) {
    url.searchParams.set('f_JT', jobType);
  }

  return url.toString();
}

function extractLinkedInJobId(url?: string): string | undefined {
  return url?.match(/(?:view|jobs)\/(?:[^/?]+-)?(\d+)/)?.[1];
}

function createFallbackId(title: string, company: string, location: string): string {
  return `linkedin-${company}-${title}-${location}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function compareJobsNewestFirst(left: Job, right: Job): number {
  const leftTime = left.postedAt ? Date.parse(left.postedAt) : Number.NaN;
  const rightTime = right.postedAt ? Date.parse(right.postedAt) : Number.NaN;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return rightTime - leftTime;
}

export function parseApplicantCount(applicantText: string): Pick<JobDetails, 'applicantCount' | 'applicantCountIsLowerBound' | 'applicantCountLabel'> {
  if (!applicantText) {
    return {
      applicantCount: null,
      applicantCountIsLowerBound: false,
      applicantCountLabel: 'Applicant count unavailable',
    };
  }

  const normalizedText = normalizeText(applicantText);
  const firstApplicantsMatch = normalizedText.match(
    /\b(?:among\s+)?(?:the\s+)?first\s+([\d,.]+)\s+applicants?\b/i
  );

  if (firstApplicantsMatch) {
    return {
      applicantCount: null,
      applicantCountIsLowerBound: false,
      applicantCountLabel: `Fewer than ${firstApplicantsMatch[1]} applicants`,
    };
  }

  const countMatch = normalizedText.match(/([\d,.]+)\s*\+?\s+applicants?\b/i);
  const applicantCount = countMatch ? parseApplicantNumber(countMatch[1]) : null;
  const applicantCountIsLowerBound = /\b(?:over|more than|at least)\b|\+/.test(normalizedText.toLowerCase());

  if (applicantCount === null) {
    return {
      applicantCount: null,
      applicantCountIsLowerBound: false,
      applicantCountLabel: /\bearly applicant\b/i.test(normalizedText)
        ? 'Early applicant; exact count unavailable'
        : 'Applicant count unavailable',
    };
  }

  return {
    applicantCount,
    applicantCountIsLowerBound,
    applicantCountLabel: normalizedText,
  };
}

function parseApplicantNumber(value: string): number | null {
  const applicantCount = Number(value.replace(/[,.]/g, ''));
  return Number.isSafeInteger(applicantCount) ? applicantCount : null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function fetchLinkedInHtml(url: string, requestType: 'search' | 'detail'): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LINKEDIN_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(LINKEDIN_REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });

      if (response.ok) return response.text();

      lastError = new Error(`LinkedIn ${requestType} request returned ${response.status}.`);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === LINKEDIN_REQUEST_ATTEMPTS) {
        throw lastError;
      }

      await wait(getRetryDelayMs(response, attempt));
    } catch (error) {
      lastError = error;
      if (attempt === LINKEDIN_REQUEST_ATTEMPTS || !isRetryableNetworkError(error)) {
        break;
      }

      await wait(400 * attempt);
    }
  }

  throw new Error(`LinkedIn ${requestType} request failed: ${getErrorMessage(lastError)}`);
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.min(5000, Math.max(0, retryAfterSeconds * 1000));
  }

  return response.status === 429 ? 2500 * attempt : 500 * attempt;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cacheJobDetails(linkedInId: string, cachedDetails: CachedJobDetails): void {
  if (detailCache.size >= LINKEDIN_DETAIL_CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [cachedId, cached] of detailCache) {
      if (cached.expiresAt <= now) detailCache.delete(cachedId);
    }
  }

  if (detailCache.size >= LINKEDIN_DETAIL_CACHE_MAX_SIZE) {
    const oldestCachedId = detailCache.keys().next().value;
    if (oldestCachedId) detailCache.delete(oldestCachedId);
  }

  detailCache.set(linkedInId, cachedDetails);
}

async function withDetailRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeDetailRequests >= LINKEDIN_DETAIL_CONCURRENCY) {
    await new Promise<void>((resolve) => detailQueue.push(resolve));
  }

  activeDetailRequests += 1;
  try {
    const intervalRemaining = LINKEDIN_DETAIL_REQUEST_INTERVAL_MS - (Date.now() - lastDetailRequestStartedAt);
    if (intervalRemaining > 0) await wait(intervalRemaining);
    lastDetailRequestStartedAt = Date.now();
    return await task();
  } finally {
    activeDetailRequests -= 1;
    detailQueue.shift()?.();
  }
}

function getLinkedInDatePostedValue(value: Required<JobSearchParams>['datePosted']): string | null {
  switch (value) {
    case 'day':
      return 'r86400';
    case 'week':
      return 'r604800';
    case 'month':
      return 'r2592000';
    default:
      return null;
  }
}

function getLinkedInExperienceValue(value: Required<JobSearchParams>['experienceLevel']): string | null {
  switch (value) {
    case 'internship':
      return '1';
    case 'entry':
      return '2';
    case 'associate':
      return '3';
    case 'mid-senior':
      return '4';
    case 'director':
      return '5';
    case 'executive':
      return '6';
    default:
      return null;
  }
}

function getLinkedInWorkplaceValue(value: Required<JobSearchParams>['workplaceType']): string | null {
  switch (value) {
    case 'on-site':
      return '1';
    case 'remote':
      return '2';
    case 'hybrid':
      return '3';
    default:
      return null;
  }
}

function getLinkedInJobTypeValue(value: Required<JobSearchParams>['jobType']): string | null {
  switch (value) {
    case 'full-time':
      return 'F';
    case 'part-time':
      return 'P';
    case 'contract':
      return 'C';
    case 'temporary':
      return 'T';
    case 'internship':
      return 'I';
    default:
      return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown network error.';
}
