import { NextResponse } from 'next/server';
import { getJobDetails, isJobSourceKey } from '@/lib/job-service';
import type { JobDetails } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const sourceJobId = searchParams.get('id');

  if (!source || !isJobSourceKey(source)) {
    return NextResponse.json({ error: 'A supported job source is required.' }, { status: 400 });
  }

  if (!sourceJobId || !/^\d{6,20}$/.test(sourceJobId)) {
    return NextResponse.json({ error: 'A valid source job ID is required.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getJobDetails(source, sourceJobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const rateLimited = message.includes('429');
    const unavailableDetails: JobDetails = {
      availability: 'temporarily-unavailable',
      applicantCount: null,
      applicantCountIsLowerBound: false,
      applicantCountLabel: rateLimited
        ? 'Temporarily unavailable (LinkedIn rate limit)'
        : 'Applicant count temporarily unavailable',
      postingStatus: 'unknown',
      postingStatusLabel: 'Listing status temporarily unavailable',
    };

    return NextResponse.json(unavailableDetails);
  }
}
