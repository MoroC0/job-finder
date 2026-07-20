import { load } from 'cheerio';
import type { JobSearchParams } from '../job-service';
import type { Job } from '../types';

interface JobindexResult {
  companytext?: string;
  firstdate?: string;
  headline?: string;
  home_workplace?: boolean;
  html?: string;
  share_url?: string;
  tid?: string;
  area?: string;
}

interface JobindexStash {
  'jobsearch/result_app'?: {
    storeData?: {
      searchResponse?: {
        results?: JobindexResult[];
      };
    };
  };
}

export async function fetchJobindexJobs(search: Required<JobSearchParams>): Promise<Job[]> {
  const response = await fetch(buildJobindexSearchUrl(search), {
    headers: {
      'User-Agent': 'JobFinderLocal/0.1',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  }).catch((error: unknown) => {
    throw new Error(`Jobindex request failed: ${getErrorMessage(error)}`);
  });

  if (!response.ok) {
    throw new Error(`Jobindex request returned ${response.status}.`);
  }

  const results = parseJobindexResults(await response.text());
  return results
    .map(toJob)
    .filter((job): job is Job => job !== null)
    .filter((job) => matchesDatePosted(job.postedAt, search.datePosted))
    .sort(compareJobsNewestFirst)
    .slice(0, search.resultLimit);
}

function buildJobindexSearchUrl(search: Required<JobSearchParams>): string {
  const url = new URL('https://www.jobindex.dk/jobsoegning');
  const queryParts = [search.keywords, search.company];

  if (!isGenericJobindexLocation(search.location)) {
    queryParts.push(search.location);
  }

  url.searchParams.set('q', queryParts.filter(Boolean).join(' ').trim());

  for (const value of getWorkplaceValues(search)) {
    url.searchParams.append('employment_place', value);
  }

  for (const value of getEmploymentTypeValues(search.jobType)) {
    url.searchParams.append('employment_type', value);
  }

  return url.toString();
}

function parseJobindexResults(html: string): JobindexResult[] {
  const stashMatch = html.match(/var Stash = (\{[^\r\n]+\});/);
  if (!stashMatch?.[1]) {
    throw new Error('Jobindex search data was not found in the response.');
  }

  const stash = JSON.parse(stashMatch[1]) as JobindexStash;
  return stash['jobsearch/result_app']?.storeData?.searchResponse?.results ?? [];
}

function toJob(result: JobindexResult): Job | null {
  if (!result.tid || !result.headline || !result.companytext || !result.area) return null;

  const postedAt = result.firstdate ? `${result.firstdate}T00:00:00.000Z` : undefined;
  const description = extractDescription(result.html);

  return {
    id: `jobindex-${result.tid}`,
    title: result.headline,
    company: result.companytext,
    location: result.area,
    type: result.home_workplace ? 'Remote' : 'Unspecified',
    posted: result.firstdate ?? 'Unknown',
    postedAt,
    description: description || 'Details available on Jobindex.',
    source: 'Jobindex',
    url: result.share_url,
  };
}

function extractDescription(html?: string): string {
  if (!html) return '';
  const $ = load(html);
  return $('.PaidJob p, .jobsearch-result p')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
}

function getWorkplaceValues(search: Required<JobSearchParams>): string[] {
  if (search.workplaceType === 'remote' || search.location.trim().toLowerCase() === 'remote') return ['2', '3'];
  if (search.workplaceType === 'hybrid') return ['3'];
  if (search.workplaceType === 'on-site') return ['1'];
  return [];
}

function getEmploymentTypeValues(value: Required<JobSearchParams>['jobType']): string[] {
  switch (value) {
    case 'full-time':
      return ['1'];
    case 'contract':
      return ['2', '11'];
    case 'temporary':
      return ['2'];
    case 'internship':
      return ['6'];
    default:
      return [];
  }
}

function isGenericJobindexLocation(location: string): boolean {
  return ['remote', 'denmark', 'danmark'].includes(location.trim().toLowerCase());
}

function matchesDatePosted(postedAt: string | undefined, value: Required<JobSearchParams>['datePosted']): boolean {
  if (value === 'any') return true;
  if (!postedAt) return false;

  const maximumAge = value === 'day' ? 86400000 : value === 'week' ? 604800000 : 2592000000;
  return Date.now() - Date.parse(postedAt) <= maximumAge;
}

function compareJobsNewestFirst(left: Job, right: Job): number {
  const leftTime = left.postedAt ? Date.parse(left.postedAt) : Number.NaN;
  const rightTime = right.postedAt ? Date.parse(right.postedAt) : Number.NaN;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return rightTime - leftTime;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown network error.';
}
