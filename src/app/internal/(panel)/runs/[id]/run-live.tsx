'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/feedback';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isActivePipelineRunStatus, pipelineRunStatusLabel, type PipelineRunEventLevel, type PipelineRunStatus } from '@/content/internal';
import { cn } from '@/lib/utils';
import { getRunSnapshot } from '@/server/actions/pipeline-runs';

import { CancelRunButton } from '../../bets/[slug]/cancel-run-button';

type EventRow = { id: string; at: string; level: PipelineRunEventLevel; stage: string | null; message: string };

type SessionRow = {
  id: string;
  seq: number;
  accountLabel: string | null;
  runnerId: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  usage: Record<string, unknown> | null;
};

export type RunSnapshot = {
  status: PipelineRunStatus;
  sessionCount: number;
  pausedReason: string | null;
  retryAfter: string | null;
  progress: Record<string, unknown>;
  error: string | null;
  attempt: number;
  runnerId: string | null;
  sessions: SessionRow[];
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  cancelRequested: boolean;
  events: EventRow[];
};

const POLL_MS = 5000;

const levelClass: Record<PipelineRunEventLevel, string> = {
  info: 'text-text-secondary',
  warn: 'text-warning',
  error: 'text-error'
};

const endReasonLabel: Record<string, string> = {
  completed: 'Finished',
  limit: 'Hit account limit',
  failed: 'Failed',
  cancelled: 'Stopped',
  lease_lost: 'Machine stopped reporting',
  released: 'Released'
};

function elapsed(from: string, to: string | null): string {
  const seconds = Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function money(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
}

// Polls a server action rather than opening an SSE stream or adding an API
// route: ADR-010 keeps the panel's whole surface in server actions, and a
// 5-second poll against a job that runs for hours is free. It only polls while
// the run is active, and `since` means each tick fetches only new events.
export function RunLive({ runId, initial }: Readonly<{ runId: string; initial: RunSnapshot }>) {
  const [snapshot, setSnapshot] = useState<RunSnapshot>(initial);
  const [level, setLevel] = useState<'all' | 'warn'>('all');
  const [stageFilter, setStageFilter] = useState<string>('');

  useEffect(() => {
    if (!isActivePipelineRunStatus(snapshot.status)) return;

    let cancelled = false;
    const tick = async () => {
      const since = snapshot.events.at(-1)?.at;
      const next = await getRunSnapshot(runId, since);
      if (cancelled || !next) return;

      setSnapshot((current) => ({
        ...next,
        // Append rather than replace: the fetch only returned events after
        // `since`, so the ones already on screen would otherwise vanish.
        events: [...current.events, ...next.events]
      }));
    };

    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId, snapshot.status, snapshot.events]);

  const progress = snapshot.progress as { stage?: string; stageIndex?: number; stageCount?: number; note?: string };
  const active = isActivePipelineRunStatus(snapshot.status);
  const pct = progress?.stageCount ? Math.round((((progress.stageIndex ?? 0) + 1) / progress.stageCount) * 100) : null;
  const stages = useMemo(() => [...new Set(snapshot.events.map((event) => event.stage).filter(Boolean))] as string[], [snapshot.events]);
  const events = snapshot.events.filter((event) => (level === 'all' || event.level !== 'info') && (!stageFilter || event.stage === stageFilter));

  return (
    <Stack gap="lg">
      <Surface className="p-5">
        <Stack gap="sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3}>
              {pipelineRunStatusLabel(snapshot.status, snapshot.sessionCount)}
              {progress?.stage ? ` · ${progress.stage}` : ''}
            </Heading>
            {active && !snapshot.cancelRequested ? <CancelRunButton runId={runId} size="md" /> : null}
          </div>

          {pct !== null ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-subtle">
                <div className={cn('h-full rounded-pill transition-all', snapshot.status === 'paused' ? 'bg-warning' : 'bg-brand')} style={{ width: `${pct}%` }} />
              </div>
              <Body size="small" className="mt-1 text-text-tertiary">
                Stage {(progress.stageIndex ?? 0) + 1} of {progress.stageCount}
                {progress.note ? ` · ${progress.note}` : ''}
              </Body>
            </div>
          ) : null}

          {snapshot.status === 'paused' ? (
            <Alert tone="warning" title={`Paused after session ${snapshot.sessionCount}`}>
              {snapshot.pausedReason ?? 'An account limit ended the session.'} It continues by itself — from its checkpoint, on the next Claude account that is free, on
              whichever machine claims it first.
              {snapshot.retryAfter ? ` Not before ${new Date(snapshot.retryAfter).toLocaleString()}.` : ''} Nothing to do here unless you want to stop it.
            </Alert>
          ) : null}
          {snapshot.cancelRequested && active ? <Alert tone="warning">Stop requested. The orchestrator stops the agent within a minute.</Alert> : null}
          {snapshot.error ? (
            <Alert tone="error">
              <pre className="whitespace-pre-wrap break-words text-caption">{snapshot.error}</pre>
            </Alert>
          ) : null}
          {active ? (
            <Body size="small" className="text-text-tertiary">
              Live · refreshing every {POLL_MS / 1000}s · last heartbeat {snapshot.heartbeatAt ? new Date(snapshot.heartbeatAt).toLocaleTimeString() : 'never'}
              {snapshot.runnerId ? ` · ${snapshot.runnerId}` : ''}
            </Body>
          ) : null}
        </Stack>
      </Surface>

      {snapshot.sessions.length > 0 ? (
        <Stack gap="sm">
          <Heading level={3}>Sessions</Heading>
          <Body size="small" className="text-text-tertiary">
            One row per claim. A session ends when the job finishes, when its account hits a limit (the next session picks up where it stopped), or when its machine goes
            quiet.
          </Body>
          <ol className="space-y-1">
            {snapshot.sessions.map((session) => {
              const cost = money(session.usage?.costUsd);
              return (
                <li key={session.id} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md border border-border px-3 py-2 text-body-small sm:grid-cols-[3rem_10rem_1fr_8rem_auto]">
                  <span className="font-mono text-caption text-text-tertiary">#{session.seq}</span>
                  <span className="truncate font-medium text-text-primary">{session.accountLabel ?? 'machine login'}</span>
                  <span className="hidden truncate text-text-secondary sm:block">{session.runnerId}</span>
                  <span className="hidden text-text-tertiary sm:block">
                    {new Date(session.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {elapsed(session.startedAt, session.endedAt)}
                  </span>
                  <span className={cn('text-right', session.endReason === 'limit' ? 'text-warning' : session.endReason === 'failed' ? 'text-error' : 'text-text-secondary')}>
                    {session.endedAt ? (endReasonLabel[session.endReason ?? ''] ?? session.endReason) : 'Running'}
                    {cost ? ` · ${cost}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </Stack>
      ) : null}

      <Stack gap="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level={3}>Timeline</Heading>
          <div className="flex flex-wrap items-center gap-2 text-body-small">
            <select
              aria-label="Filter by level"
              className="h-8 rounded-md border border-border bg-surface px-2 text-text-primary"
              value={level}
              onChange={(event) => setLevel(event.target.value as 'all' | 'warn')}
            >
              <option value="all">All levels</option>
              <option value="warn">Warnings and errors</option>
            </select>
            {stages.length > 1 ? (
              <select
                aria-label="Filter by stage"
                className="h-8 rounded-md border border-border bg-surface px-2 text-text-primary"
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="">All stages</option>
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        {events.length === 0 ? (
          <Body size="small" className="text-text-tertiary">
            No events{snapshot.events.length ? ' match these filters' : ' yet'}.
          </Body>
        ) : (
          <ol className="space-y-1">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 rounded-md px-3 py-1.5 text-body-small odd:bg-surface-subtle/50">
                <span className="shrink-0 font-mono text-caption text-text-tertiary">{new Date(event.at).toLocaleTimeString()}</span>
                {event.stage ? <span className="shrink-0 font-mono text-caption text-text-tertiary">{event.stage}</span> : null}
                <span className={cn('min-w-0 break-words', levelClass[event.level])}>{event.message}</span>
              </li>
            ))}
          </ol>
        )}
      </Stack>
    </Stack>
  );
}
