import { NextResponse } from 'next/server';
import { getJobDetails, isJobSourceKey } from '@/lib/job-service';

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job details.' },
      { status: 502 }
    );
  }
}
