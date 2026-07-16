import { NextResponse } from 'next/server';
import { getJobsFromSources, type JobSourceKey } from '@/lib/job-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get('source');
  const sources = sourceParam ? [sourceParam as JobSourceKey] : undefined;
  const jobs = await getJobsFromSources(sources);
  return NextResponse.json({ jobs });
}
