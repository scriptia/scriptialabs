import 'server-only';

import { NextResponse } from 'next/server';
import { eq, sql, type SQL } from 'drizzle-orm';

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
//
// Two layers:
//
//   * `leaseFence()` — the SQL predicate every runner WRITE carries, in the same
//     statement as the write. This is the one that actually closes the race: a
//     check followed by a separate UPDATE leaves a window in which the reaper
//     can hand the run to another machine, and the old process then writes over
//     the new one. With the fence in the UPDATE's own WHERE clause there is no
//     window — a stale token matches zero rows.
//   * `requireLease()` — a read-only check, for routes that write somewhere
//     other than the run row (assets to Blob, events to their own table) and to
//     turn a zero-row fenced write into a useful 404/409.
//
// The token is `lease_token`, fresh on every claim. A legacy runner (the old
// per-agent runner.py) never received one, so for it the fence falls back to
// runner_id — the old behaviour, now at least inside the same statement.

export type LeaseCheck = { ok: true; run: PipelineRunRow } | { ok: false; response: NextResponse };

export type LeaseHolder = { runnerId: string; leaseToken?: string | null };

/**
 * `status IN ('claimed','running') AND lease still valid AND token matches`.
 *
 * `lease_expires_at > now()` is part of the fence on purpose. A lease that has
 * lapsed may already have had its accounts released by the reaper; letting its
 * holder keep writing would let two jobs believe they own one account. A
 * laptop that slept through its lease gets a 409, stops, and the run resumes
 * from its checkpoint on the next claim — usually on the same machine.
 */
export function leaseFence(holder: LeaseHolder, alias?: string): SQL {
  const column = (name: string) => sql.raw(alias ? `${alias}.${name}` : name);
  const token = holder.leaseToken ?? null;

  return sql`(${column('status')} in ('claimed', 'running')
    and ${column('lease_expires_at')} > now()
    and (${column('lease_token')} = ${token}::uuid or (${token}::uuid is null and ${column('runner_id')} = ${holder.runnerId})))`;
}

export async function requireLease(runId: string, holder: LeaseHolder | string): Promise<LeaseCheck> {
  const { runnerId, leaseToken } = typeof holder === 'string' ? { runnerId: holder, leaseToken: null } : holder;
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

  if (leaseToken) {
    if (run.leaseToken !== leaseToken || (run.status !== 'claimed' && run.status !== 'running')) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'This lease is no longer valid; the run was reassigned or paused.', status: run.status, heldBy: run.runnerId },
          { status: 409 }
        )
      };
    }
  } else if (run.runnerId && run.runnerId !== runnerId) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Lease is held by another runner.', heldBy: run.runnerId }, { status: 409 })
    };
  }

  if (run.leaseExpiresAt && run.leaseExpiresAt <= new Date() && (run.status === 'claimed' || run.status === 'running')) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'The lease expired; stop and let the run be re-claimed.', status: run.status }, { status: 409 })
    };
  }

  return { ok: true, run };
}

/**
 * Why a fenced write matched nothing, as the response the runner should get.
 * Only called on the failure path, so the extra read costs nothing normally.
 */
export async function fenceFailure(runId: string, holder: LeaseHolder): Promise<NextResponse> {
  const check = await requireLease(runId, holder);
  if (!check.ok) return check.response;

  // The check passed a moment after the write failed: the lease changed hands
  // in between (or expired exactly then). Still a 409 — the write did not land.
  return NextResponse.json({ ok: false, error: 'The lease changed while this request was in flight.' }, { status: 409 });
}
