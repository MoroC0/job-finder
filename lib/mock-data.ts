import type { Job } from '@/lib/types';

export const mockJobs: Job[] = [
  {
    id: 'job-001',
    title: 'Frontend Engineer',
    company: 'Remote Labs',
    location: 'Remote',
    type: 'Full-time',
    posted: '2 days ago',
    description: 'Build modern job search experiences with React, TypeScript and server-driven data.',
    source: 'Mock',
    url: 'https://example.com/jobs/job-001',
  },
  {
    id: 'job-002',
    title: 'Product Design Lead',
    company: 'Workday Ventures',
    location: 'New York, NY',
    type: 'Contract',
    posted: '1 week ago',
    description: 'Design beautiful product experiences for job seekers and hiring teams.',
    source: 'Mock',
    url: 'https://example.com/jobs/job-002',
  },
  {
    id: 'job-003',
    title: 'Data Engineer',
    company: 'Gridflow',
    location: 'Austin, TX',
    type: 'Full-time',
    posted: 'Today',
    description: 'Create data pipelines for aggregating listings from multiple job boards.',
    source: 'Mock',
    url: 'https://example.com/jobs/job-003',
  },
];
