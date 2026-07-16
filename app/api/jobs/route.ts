import { NextResponse } from 'next/server';
import {
  DEFAULT_JOB_SEARCH,
  getJobsReportFromSources,
  isJobSourceKey,
  JOB_SOURCE_KEYS,
  type JobSearchParams,
  type JobSourceKey,
} from '@/lib/job-service';

const DATE_POSTED_VALUES = ['any', 'day', 'week', 'month'] as const;
const EXPERIENCE_LEVEL_VALUES = ['any', 'internship', 'entry', 'associate', 'mid-senior', 'director', 'executive'] as const;
const WORKPLACE_TYPE_VALUES = ['any', 'remote', 'hybrid', 'on-site'] as const;
const JOB_TYPE_VALUES = ['any', 'full-time', 'part-time', 'contract', 'temporary', 'internship'] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get('source');
  const keywordsParam = searchParams.get('keywords');
  const locationParam = searchParams.get('location');
  const companyParam = searchParams.get('company');
  const datePostedParam = searchParams.get('datePosted');
  const experienceLevelParam = searchParams.get('experienceLevel');
  const workplaceTypeParam = searchParams.get('workplaceType');
  const jobTypeParam = searchParams.get('jobType');

  if (sourceParam && !isJobSourceKey(sourceParam)) {
    return NextResponse.json(
      {
        error: `Unsupported source "${sourceParam}".`,
        validSources: JOB_SOURCE_KEYS,
      },
      { status: 400 }
    );
  }

  const requestedSources: JobSourceKey[] | undefined = sourceParam
    ? [sourceParam as JobSourceKey]
    : undefined;
  const search: JobSearchParams = {
    keywords: keywordsParam ?? DEFAULT_JOB_SEARCH.keywords,
    location: locationParam ?? DEFAULT_JOB_SEARCH.location,
    company: companyParam ?? DEFAULT_JOB_SEARCH.company,
    datePosted: normalizeEnumValue(datePostedParam, DATE_POSTED_VALUES, DEFAULT_JOB_SEARCH.datePosted),
    experienceLevel: normalizeEnumValue(
      experienceLevelParam,
      EXPERIENCE_LEVEL_VALUES,
      DEFAULT_JOB_SEARCH.experienceLevel
    ),
    workplaceType: normalizeEnumValue(workplaceTypeParam, WORKPLACE_TYPE_VALUES, DEFAULT_JOB_SEARCH.workplaceType),
    jobType: normalizeEnumValue(jobTypeParam, JOB_TYPE_VALUES, DEFAULT_JOB_SEARCH.jobType),
  };
  const report = await getJobsReportFromSources(requestedSources, search);
  return NextResponse.json(report);
}

function normalizeEnumValue<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
