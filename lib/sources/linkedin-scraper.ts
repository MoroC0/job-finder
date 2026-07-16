import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { JobSearchParams } from '../job-service';
import type { Job } from '../types';

export async function fetchLinkedInJobs(search: Required<JobSearchParams>): Promise<Job[]> {
  const sampleUrl = buildLinkedInSearchUrl(search);
  const response = await fetch(sampleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(8000),
  }).catch((error: unknown) => {
    throw new Error(`LinkedIn request failed: ${getErrorMessage(error)}`);
  });

  if (!response.ok) {
    throw new Error(`LinkedIn request returned ${response.status}.`);
  }

  const html = await response.text();
  const $ = load(html);
  const jobs: Job[] = [];

  $('li.result-card, .base-card').each((_, element: Element) => {
    const title = $(element).find('h3.base-search-card__title, h3.result-card__title').text().trim();
    const company = $(element).find('h4.base-search-card__subtitle, h4.result-card__subtitle').text().trim();
    const location = $(element).find('.job-search-card__location, .result-card__meta .job-result-card__location').text().trim();
    const url = $(element).find('a').attr('href');
    const posted = $(element).find('time').text().trim() || 'Unknown';
    const description = $(element).find('.job-search-card__snippet, .result-card__snippet').text().trim();

    if (title && company && location) {
      jobs.push({
        id: `linkedin-${jobs.length}-${company}-${title}`.replace(/\s+/g, '-').toLowerCase(),
        title,
        company,
        location,
        type: 'Full-time',
        posted,
        description: description || 'Details available on LinkedIn.',
        source: 'LinkedIn',
        url,
      });
    }
  });

  return jobs.slice(0, 12);
}

function buildLinkedInSearchUrl(search: Required<JobSearchParams>): string {
  const url = new URL('https://www.linkedin.com/jobs/search');

  const keywordParts = [search.keywords, search.company].filter(Boolean);
  url.searchParams.set('keywords', keywordParts.join(' ').trim());
  url.searchParams.set('location', search.location);

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
