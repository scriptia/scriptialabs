'use client';

import { useEffect, useState, useTransition } from 'react';

import { Alert } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isActivePipelineRunStatus, pipelineRunStatusLabels, type PipelineRunEventLevel, type PipelineRunStatus } from '@/content/internal';
import { cancelRun, getRunSnapshot } from '@/server/actions/pipeline-runs';

type EventRow = { id: string; at: string; level: PipelineRunEventLevel; stage: string | null; message: string };

type Snapshot = {
  status: PipelineRunStatus;
  progress: Record<string, unknown>;
  error: string | null;
  attempt: number;
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

// Polls a server action rather than opening an SSE stream or adding an API
// route: ADR-010 keeps the panel's whole surface in server actions, and a
// 5-second poll against a job that runs for hours is free. It only polls while
// the run is active, and `since` means each tick fetches only new events.
export function RunLive({ runId, initial }: Readonly<{ runId: string; initial: Snapshot }>) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [pending, startTransition] = useTransition();

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

  return (
    <Stack gap="lg">
      <Surface className="p-5">
        <Stack gap="sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3}>
              {pipelineRunStatusLabels[snapshot.status]}
              {progress?.stage ? ` · ${progress.stage}` : ''}
            </Heading>
            {active && !snapshot.cancelRequested ? (
              <form
                action={(formData) => {
                  startTransition(async () => {
                    await cancelRun(formData);
                  });
                }}
              >
                <input type="hidden" name="runId" value={runId} />
                <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                  {pending ? 'Requesting…' : 'Request stop'}
                </Button>
              </form>
            ) : null}
          </div>

          {pct !== null ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-subtle">
                <div className="h-full rounded-pill bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
              <Body size="small" className="mt-1 text-text-tertiary">
                Stage {(progress.stageIndex ?? 0) + 1} of {progress.stageCount}
                {progress.note ? ` · ${progress.note}` : ''}
              </Body>
            </div>
          ) : null}

          {snapshot.cancelRequested && active ? <Alert tone="warning">Stop requested. The runner halts at the next stage boundary.</Alert> : null}
          {snapshot.error ? (
            <Alert tone="error">
              <pre className="whitespace-pre-wrap break-words text-caption">{snapshot.error}</pre>
            </Alert>
          ) : null}
          {active ? (
            <Body size="small" className="text-text-tertiary">
              Live · refreshing every {POLL_MS / 1000}s · last heartbeat {snapshot.heartbeatAt ? new Date(snapshot.heartbeatAt).toLocaleTimeString() : 'never'}
            </Body>
          ) : null}
        </Stack>
      </Surface>

      <Stack gap="sm">
        <Heading level={3}>Timeline</Heading>
        {snapshot.events.length === 0 ? (
          <Body size="small" className="text-text-tertiary">
            No events yet.
          </Body>
        ) : (
          <ol className="space-y-1">
            {snapshot.events.map((event) => (
              <li key={event.id} className="flex gap-3 rounded-md px-3 py-1.5 text-body-small odd:bg-surface-subtle/50">
                <span className="shrink-0 font-mono text-caption text-text-tertiary">{new Date(event.at).toLocaleTimeString()}</span>
                {event.stage ? <span className="shrink-0 font-mono text-caption text-text-tertiary">{event.stage}</span> : null}
                <span className={levelClass[event.level]}>{event.message}</span>
              </li>
            ))}
          </ol>
        )}
      </Stack>
    </Stack>
  );
}
