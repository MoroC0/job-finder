import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { Job } from '../types';

export async function fetchIndeedJobs(): Promise<Job[]> {
  const sampleUrl = 'https://www.indeed.com/q-data-science-jobs.html';
  const response = await fetch(sampleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const $ = load(html);
  const jobs: Job[] = [];

  $('.slider_container, .jobsearch-SerpJobCard, .job_seen_beacon').each((_, element: Element) => {
    const title = $(element).find('h2.jobTitle, h2 > span.title').text().trim();
    const company = $(element).find('.companyName, .company').text().trim();
    const location = $(element).find('.companyLocation, .location').text().trim();
    const urlPath = $(element).find('a').attr('href');
    const url = urlPath ? new URL(urlPath, 'https://www.indeed.com').toString() : undefined;
    const posted = $(element).find('.date').text().trim() || 'Unknown';
    const description = $(element).find('.job-snippet').text().trim();

    if (title && company && location) {
      jobs.push({
        id: `indeed-${jobs.length}-${company}-${title}`.replace(/\s+/g, '-').toLowerCase(),
        title,
        company,
        location,
        type: 'Full-time',
        posted,
        description: description || 'Details available on Indeed.',
        source: 'Indeed',
        url,
      });
    }
  });

  return jobs.slice(0, 12);
}
