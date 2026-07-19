import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { JobSearchParams } from '../job-service';
import type { Job, JobDetails } from '../types';

const LINKEDIN_PAGE_SIZE = 10;

export async function fetchLinkedInJobDetails(linkedInId: string): Promise<JobDetails> {
  const response = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${linkedInId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  }).catch((error: unknown) => {
    throw new Error(`LinkedIn detail request failed: ${getErrorMessage(error)}`);
  });

  if (!response.ok) {
    throw new Error(`LinkedIn detail request returned ${response.status}.`);
  }

  const $ = load(await response.text());
  const applicantText = normalizeText($('.num-applicants__caption').first().text());
  const postedText = normalizeText($('.posted-time-ago__text').first().text());
  const applicantData = parseApplicantCount(applicantText);
  const isReposted = /\breposted\b/i.test(postedText);

  return {
    ...applicantData,
    postingStatus: isReposted ? 'reposted' : postedText ? 'original' : 'unknown',
    postingStatusLabel: isReposted
      ? 'Reposted'
      : postedText
        ? 'Original posting'
        : 'Posting status unavailable',
  };
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
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  }).catch((error: unknown) => {
    throw new Error(`LinkedIn request failed: ${getErrorMessage(error)}`);
  });

  if (!response.ok) {
    throw new Error(`LinkedIn request returned ${response.status}.`);
  }

  const html = await response.text();
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

function parseApplicantCount(applicantText: string): Pick<JobDetails, 'applicantCount' | 'applicantCountIsLowerBound' | 'applicantCountLabel'> {
  if (!applicantText) {
    return {
      applicantCount: null,
      applicantCountIsLowerBound: false,
      applicantCountLabel: 'Applicant count unavailable',
    };
  }

  const countMatch = applicantText.match(/[\d,.]+/);
  const applicantCount = countMatch ? Number(countMatch[0].replace(/[,.]/g, '')) : null;
  const applicantCountIsLowerBound = /\bover\b|\+/.test(applicantText.toLowerCase());

  return {
    applicantCount: Number.isFinite(applicantCount) ? applicantCount : null,
    applicantCountIsLowerBound,
    applicantCountLabel: applicantText,
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
