export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  posted: string;
  postedAt?: string;
  description: string;
  source?: string;
  url?: string;
}

export type JobPostingStatus = 'original' | 'reposted' | 'unknown';

export interface JobDetails {
  applicantCount: number | null;
  applicantCountIsLowerBound: boolean;
  applicantCountLabel: string;
  postingStatus: JobPostingStatus;
  postingStatusLabel: string;
}
