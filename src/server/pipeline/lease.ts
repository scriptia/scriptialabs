import 'server-only';

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { isTerminalPipelineRunStatus } from '@/content/internal';
import { db } from '@/server/db/client';
import { pipelineRuns } from '@/server/db/schema';
import type { PipelineRunRow } from '@/server/db/schema';

// Every runner callback goes through this.
//
// The rule: a callback is only honoured by the process that currently holds the
// lease. Without it, a run whose lease lapsed and was requeued to a second
// runner could still be written to by the first — the classic double-publish,
// where a laptop that woke from sleep finishes a job somebody else already
// redid. The reaper hands the lease on; this is what makes that safe.

export type LeaseCheck = { ok: true; run: PipelineRunRow } | { ok: false; response: NextResponse };

export async function requireLease(runId: string, runnerId: string): Promise<LeaseCheck> {
  const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).limit(1);

  if (!run) {
    return { ok: false, response: NextResponse.json({ ok: false, error: 'No such run.' }, { status: 404 }) };
  }

  if (isTerminalPipelineRunStatus(run.status)) {
    // 409 rather than 404: the run is real, the caller is just too late. A
    // runner seeing this should stop and NOT retry — its work has been
    // superseded, and reporting it now would overwrite a conclusion someone
    // else already drew.
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: `Run already finished (${run.status}).`, status: run.status }, { status: 409 })
    };
  }

  if (run.runnerId && run.runnerId !== runnerId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Lease is held by another runner.', heldBy: run.runnerId }, { status: 409 })
    };
  }

  return { ok: true, run };
}
