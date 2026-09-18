import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRunEvents } from '@/server/db/schema';
import { requireLease } from '@/server/pipeline/lease';
import { eventsRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

// Batched log lines, becoming the timeline the panel renders.
//
// `at` comes from the runner rather than defaulting to now(): events ship in
// batches after the fact, so arrival time is not the time they happened, and a
// timeline ordered by arrival would compress a two-hour run into the instants
// its batches landed.
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

  const parsed = eventsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const lease = await requireLease(id, parsed.data.runnerId);
  if (!lease.ok) return lease.response;

  await db.insert(pipelineRunEvents).values(
    parsed.data.events.map((event) => ({
      runId: id,
      at: event.at ? new Date(event.at) : new Date(),
      level: event.level,
      stage: event.stage ?? null,
      message: event.message,
      data: event.data ?? null
    }))
  );

  return NextResponse.json({ ok: true, stored: parsed.data.events.length });
}
