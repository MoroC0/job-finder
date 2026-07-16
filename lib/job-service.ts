import { mockJobs } from './mock-data';
import { fetchIndeedJobs } from './sources/indeed-scraper';
import { fetchLinkedInJobs } from './sources/linkedin-scraper';
import type { Job } from './types';

export type JobSourceKey = 'mock' | 'indeed' | 'linkedin';

export async function getJobsFromSources(sources?: JobSourceKey[]): Promise<Job[]> {
  const selectedSources = sources && sources.length > 0 ? sources : ['mock'];

  const jobs: Job[] = [];

  for (const source of selectedSources) {
    switch (source) {
      case 'mock':
        jobs.push(...getMockJobs());
        break;
      case 'indeed':
        jobs.push(...(await getIndeedJobs()));
        break;
      case 'linkedin':
        jobs.push(...(await getLinkedInJobs()));
        break;
      default:
        jobs.push(...getMockJobs());
    }
  }

  return jobs;
}

function getMockJobs(): Job[] {
  return mockJobs;
}

async function getIndeedJobs(): Promise<Job[]> {
  return fetchIndeedJobs();
}

async function getLinkedInJobs(): Promise<Job[]> {
  return fetchLinkedInJobs();
}
