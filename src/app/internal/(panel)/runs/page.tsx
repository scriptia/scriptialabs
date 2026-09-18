import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Alert } from '@/components/feedback';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isPipelineRunStatus, pipelineRunKindLabels, pipelineRunStatusLabels, pipelineRunStatuses } from '@/content/internal';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth/guard';
import { reapExpiredRunsQuietly } from '@/server/pipeline/reap';
import { countRunsByStatus, listRunners, listRuns } from '@/server/queries/pipeline-runs';

import { formatRelative } from '../_components/format';
import { RunStatusBadge } from '../_components/run-status-badge';

type PageProps = Readonly<{ searchParams: Promise<{ status?: string }> }>;

function duration(startedAt: Date | null, finishedAt: Date | null): string {
  if (!startedAt) return '—';
  const end = finishedAt ?? new Date();
  const seconds = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// The scheduler is expected to poll every 30 minutes, so anything past a couple
// of hours means it is not running — not that the queue is quiet. Deliberately
// finer-grained than the shared formatRelative, whose smallest unit is "today":
// "today" and "two hours ago" are the same word for a board whose job is to tell
// you the laptop stopped answering.
const RUNNER_STALE_MS = 2 * 60 * 60 * 1000;

function sinceLabel(value: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Is anything listening? This has to be answerable before the table below means
 * anything: an idle queue and a laptop that stopped running produce an identical
 * board, and last time that ambiguity went unnoticed for four days.
 */
function RunnerBanner({ runners }: Readonly<{ runners: ReadonlyArray<{ runnerId: string; lastSeenAt: Date }> }>) {
  if (runners.length === 0) {
    return (
      <Alert tone="warning" title="No runner has ever polled for work">
        Queued jobs will sit here untouched until a machine is set up with <code>python3 install.py</code>.
      </Alert>
    );
  }

  const stale = runners.filter((runner) => Date.now() - runner.lastSeenAt.getTime() > RUNNER_STALE_MS);
  const lines = runners.map((runner) => (
    <span key={runner.runnerId} className="mr-6 inline-block whitespace-nowrap">
      <strong className="font-medium text-text-primary">{runner.runnerId}</strong> — last seen{' '}
      <time dateTime={runner.lastSeenAt.toISOString()}>{sinceLabel(runner.lastSeenAt)}</time>
    </span>
  ));

  return stale.length > 0 ? (
    <Alert tone="warning" title={`${stale.length === runners.length ? 'The scheduler is' : 'A scheduler is'} not reporting`}>
      {lines}
      <div className="mt-2">Expected every 30 minutes. Nothing queued will run until it is back.</div>
    </Alert>
  ) : (
    <Alert tone="success" title="Scheduler is reporting">
      {lines}
    </Alert>
  );
}

// Filters live in the URL, same reasoning as BetFilters: a filtered view is a
// shareable link. Plain links rather than the Chip primitive — Chip is a
// <button>, and these navigate.
function FilterLink({ href, active, children }: Readonly<{ href: string; active: boolean; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center rounded-pill border px-3 py-1 text-sm transition-colors',
        active ? 'border-brand bg-brand-subtle text-brand-strong' : 'border-border bg-surface text-text-secondary hover:bg-surface-subtle'
      )}
    >
      {children}
    </Link>
  );
}

export default async function RunsPage({ searchParams }: PageProps) {
  await requireUser();

  const { status } = await searchParams;
  const active = status && isPipelineRunStatus(status) ? status : undefined;

  // Reap before reading, so the board an admin is looking at is not quietly
  // showing a run whose lease lapsed hours ago.
  await reapExpiredRunsQuietly();

  const [runs, counts, runners] = await Promise.all([listRuns({ status: active }), countRunsByStatus(), listRunners()]);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Runs</Heading>
          <Body size="small" className="mt-1">
            Discovery, product-agent and build runs. A runner claims queued work on its own schedule — nothing starts the moment you queue it.
          </Body>
        </div>
        <Link
          href="/internal/runs/new"
          className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-strong"
        >
          Queue a run
        </Link>
      </div>

      <RunnerBanner runners={runners} />

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/internal/runs" active={!active}>
          All ({total})
        </FilterLink>
        {pipelineRunStatuses
          .filter((value) => counts[value])
          .map((value) => (
            <FilterLink key={value} href={`/internal/runs?status=${value}`} active={active === value}>
              {pipelineRunStatusLabels[value]} ({counts[value]})
            </FilterLink>
          ))}
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Run</TableHeaderCell>
            <TableHeaderCell>Bet</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Stage</TableHeaderCell>
            <TableHeaderCell>Duration</TableHeaderCell>
            <TableHeaderCell>Requested by</TableHeaderCell>
            <TableHeaderCell>Queued</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.length === 0 ? (
            <TableEmpty colSpan={7}>No runs {active ? `with status "${pipelineRunStatusLabels[active]}"` : 'yet'}.</TableEmpty>
          ) : (
            runs.map((run) => {
              const progress = run.progress as { stage?: string; stageIndex?: number; stageCount?: number };

              return (
                <TableRow key={run.id} interactive>
                  <TableCell>
                    <Link href={`/internal/runs/${run.id}`} className="font-medium text-brand hover:underline">
                      {pipelineRunKindLabels[run.kind]}
                    </Link>
                    {run.externalRunId ? <span className="ml-2 text-caption text-text-tertiary">{run.externalRunId}</span> : null}
                  </TableCell>
                  <TableCell>
                    {run.betSlug ? (
                      <Link href={`/internal/bets/${run.betSlug}`} className="hover:underline">
                        {run.betSlug}
                      </Link>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    {run.retryAfter && run.status === 'queued'
                      ? `waiting on quota until ${new Date(run.retryAfter).toLocaleTimeString()}`
                      : progress?.stage
                        ? `${progress.stage}${progress.stageCount ? ` (${(progress.stageIndex ?? 0) + 1}/${progress.stageCount})` : ''}`
                        : '—'}
                  </TableCell>
                  <TableCell>{duration(run.startedAt, run.finishedAt)}</TableCell>
                  <TableCell>{run.requestedByName ?? '—'}</TableCell>
                  <TableCell>{formatRelative(run.queuedAt)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Stack>
  );
}
