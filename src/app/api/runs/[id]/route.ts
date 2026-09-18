import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { buildJobDescriptor } from '@/server/pipeline/descriptor';

export const runtime = 'nodejs';

// The job descriptor for one run. Byte-identical to what POST /api/runs/claim
// returned, so a runner that restarts can re-fetch its instructions instead of
// having had to persist them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const descriptor = await buildJobDescriptor(id);

  if (!descriptor) {
    return NextResponse.json({ ok: false, error: 'No such run.' }, { status: 404 });
  }

  return NextResponse.json(descriptor);
}
