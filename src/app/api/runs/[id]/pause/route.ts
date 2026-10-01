import { NextResponse, type NextRequest } from 'next/server';

import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRunEvents } from '@/server/db/schema';
import { fenceFailure } from '@/server/pipeline/lease';
import { pauseRun } from '@/server/pipeline/queue';
import { pauseRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

// When a Claude session hits its window and the CLI prints no readable reset,
// assume one hour: long enough not to thrash the account, short enough that a
// wrong guess costs one window rather than a day.
const DEFAULT_LIMIT_SECONDS = 60 * 60;

/**
 * A session ended on a limit. Called by idion-orchestrator, never by a human.
 *
 * In ONE statement (server/pipeline/queue.ts): the run becomes `paused` with the
 * checkpoint the orchestrator just uploaded, the account that ran out is marked
 * limited until its reset, every lease the run held is released, and the
 * session is closed with end_reason `limit`.
 *
 * Nothing waits for a human after this. The run is claimable again at once;
 * the next claim that finds a free account — on this machine or another — gets
 * it with that account, restores the checkpoint, and continues the same Claude
 * conversations with --resume. The board shows "Paused ×N" until then.
 */
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

  const parsed = pauseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;
  const holder = { runnerId: data.runnerId, leaseToken: data.leaseToken };
  const limitedUntil = data.limitedUntilEpoch ? new Date(data.limitedUntilEpoch * 1000) : new Date(Date.now() + DEFAULT_LIMIT_SECONDS * 1000);
  const resumeAfter = data.resumeAfterEpoch ? new Date(data.resumeAfterEpoch * 1000) : null;

  const progress = {
    ...(data.stage !== undefined ? { stage: data.stage } : {}),
    ...(data.stageIndex !== undefined ? { stageIndex: data.stageIndex } : {}),
    ...(data.stageCount !== undefined ? { stageCount: data.stageCount } : {}),
    note: data.reason
  };

  const paused = await pauseRun({
    runId: id,
    holder,
    reason: data.reason,
    limitedAccount: data.accountId ? { accountId: data.accountId, until: limitedUntil } : null,
    resumeAfter,
    checkpoint: data.checkpoint ?? null,
    progress,
    usage: data.usage
  });

  if (!paused) return fenceFailure(id, holder);

  const until = paused.limitedUntil ?? resumeAfter;
  const message = [
    `Paused ×${paused.sessionCount}: ${data.reason}`,
    paused.limitedLabel ? ` — account "${paused.limitedLabel}" limited until ${until?.toISOString() ?? 'unknown'}` : '',
    resumeAfter ? ` — resumes after ${resumeAfter.toISOString()}` : ' — resumes on the next free account',
    data.checkpoint ? '. Checkpoint saved.' : '.'
  ].join('');

  await db.insert(pipelineRunEvents).values({
    runId: id,
    level: 'warn',
    stage: data.stage ?? null,
    message,
    data: { sessionCount: paused.sessionCount, accountId: data.accountId ?? null, limitedUntil: until?.toISOString() ?? null }
  });

  await recordAudit({ actorId: null, entity: 'pipeline_run', entityId: id, action: 'update', diff: { status: { from: 'running', to: 'paused' } } });

  return NextResponse.json({
    ok: true,
    run: { id, status: 'paused', sessionCount: paused.sessionCount },
    account: paused.limitedLabel ? { label: paused.limitedLabel, limitedUntil: until?.toISOString() ?? null } : null
  });
}
