import { load } from 'cheerio';
import type { Element } from 'domhandler';
import type { Job } from '../types';

export async function fetchLinkedInJobs(): Promise<Job[]> {
  const sampleUrl = 'https://www.linkedin.com/jobs/search?keywords=data%20science';
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
