import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRuns } from '@/server/db/schema';
import { fenceFailure, requireLease } from '@/server/pipeline/lease';
import { recordCheckpoint } from '@/server/pipeline/queue';
import { CHECKPOINT_PART_MAX_BYTES, checkpointPartPath, getCheckpointPart, putCheckpointPart } from '@/server/storage/checkpoints';
import { checkpointRecordSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

// Three verbs, one resource — the run's checkpoint (server/storage/checkpoints.ts):
//
//   PUT  ?upload=<id>&part=<n>   raw bytes of one part (≤ 4 MB), lease holder only
//   POST {checkpoint}            record a finished upload as the run's checkpoint
//                                (a pause records it itself; this is for a
//                                checkpoint taken mid-session, before a risky step)
//   GET  ?part=<n>               download a part of the run's CURRENT checkpoint,
//                                lease holder only — i.e. the machine that just
//                                claimed the paused run.
//
// Identity for PUT/GET rides in headers (X-Runner-Id, X-Lease-Token) because
// the body is binary.

const UPLOAD_ID = /^[A-Za-z0-9-]{8,64}$/;

function holderFrom(request: NextRequest) {
  return { runnerId: request.headers.get('x-runner-id') ?? '', leaseToken: request.headers.get('x-lease-token') || null };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const holder = holderFrom(request);
  if (!holder.runnerId || !holder.leaseToken) {
    return NextResponse.json({ ok: false, error: 'X-Runner-Id and X-Lease-Token are required.' }, { status: 422 });
  }

  const uploadId = request.nextUrl.searchParams.get('upload') ?? '';
  const part = Number(request.nextUrl.searchParams.get('part') ?? '-1');
  if (!UPLOAD_ID.test(uploadId) || !Number.isInteger(part) || part < 0 || part > 63) {
    return NextResponse.json({ ok: false, error: 'upload must be an id and part an integer 0–63.' }, { status: 422 });
  }

  const lease = await requireLease(id, holder);
  if (!lease.ok) return lease.response;

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) return NextResponse.json({ ok: false, error: 'Empty part.' }, { status: 422 });
  if (bytes.length > CHECKPOINT_PART_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `A part may be at most ${CHECKPOINT_PART_MAX_BYTES} bytes.` }, { status: 413 });
  }

  try {
    const stored = await putCheckpointPart(checkpointPartPath(id, uploadId, part), bytes);
    return NextResponse.json({ ok: true, ...stored });
  } catch (error) {
    console.error(`[checkpoint] blob upload failed for run ${id}:`, error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        hint: 'BLOB_READ_WRITE_TOKEN missing/expired, or a public-only store (set CHECKPOINT_BLOB_ACCESS=public).'
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = checkpointRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const holder = { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken };
  const prefix = `checkpoints/${id}/`;
  if (parsed.data.checkpoint.parts.some((entry) => !entry.pathname.startsWith(prefix))) {
    return NextResponse.json({ ok: false, error: 'Every part must belong to this run.' }, { status: 422 });
  }

  const stored = await recordCheckpoint({ runId: id, holder, checkpoint: parsed.data.checkpoint });
  if (!stored) return fenceFailure(id, holder);

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const holder = holderFrom(request);
  const lease = await requireLease(id, holder);
  if (!lease.ok) return lease.response;

  const part = Number(request.nextUrl.searchParams.get('part') ?? '0');
  const [run] = await db.select({ checkpoint: pipelineRuns.checkpoint }).from(pipelineRuns).where(eq(pipelineRuns.id, id)).limit(1);
  const parts = (run?.checkpoint?.parts ?? []) as Array<{ pathname: string }>;
  const entry = Number.isInteger(part) ? parts[part] : undefined;

  if (!entry) return NextResponse.json({ ok: false, error: 'This run has no such checkpoint part.' }, { status: 404 });

  const stream = await getCheckpointPart(entry.pathname);
  if (!stream) return NextResponse.json({ ok: false, error: 'The checkpoint part is gone from storage.' }, { status: 410 });

  return new NextResponse(stream, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
}
