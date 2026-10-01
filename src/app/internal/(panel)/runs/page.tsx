import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Alert } from '@/components/feedback';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { pipelineRunKindLabels, type PipelineRunStatus } from '@/content/internal';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth/guard';
import { reapExpiredRunsQuietly } from '@/server/pipeline/reap';
import { countRunsByStatus, getActiveRunAccounts, getClaudePoolSummary, listRunners, listRuns, type PipelineRunListRow } from '@/server/queries/pipeline-runs';

import { formatRelative } from '../_components/format';
import { RunStatusBadge } from '../_components/run-status-badge';

type Tab = 'queue' | 'running' | 'finished';

type PageProps = Readonly<{ searchParams: Promise<{ tab?: string }> }>;

// The three questions the board answers, one tab each: what is waiting (and on
// what), what is working right now, and what happened.
const tabStatuses: Record<Tab, PipelineRunStatus[]> = {
  queue: ['queued', 'paused'],
  running: ['claimed', 'running'],
  finished: ['succeeded', 'failed', 'cancelled', 'expired']
};

const tabLabels: Record<Tab, string> = { queue: 'Queue', running: 'Running', finished: 'Finished' };

function isTab(value: string | undefined): value is Tab {
  return value === 'queue' || value === 'running' || value === 'finished';
}

function duration(startedAt: Date | null, finishedAt: Date | null): string {
  if (!startedAt) return '—';
  const end = finishedAt ?? new Date();
  const seconds = Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// An orchestrator polls every ~20 seconds (longer only while every account is
// limited, and then never past the reset), so ten minutes of silence means it is
// not running — not that the queue is quiet. Deliberately finer-grained than
// formatRelative, whose smallest unit is "today".
const RUNNER_STALE_MS = 10 * 60 * 1000;

function sinceLabel(value: Date): string {
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function untilLabel(value: Date): string {
  const minutes = Math.max(0, Math.round((value.getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.round(hours / 24)} days`;
}

type Runner = Awaited<ReturnType<typeof listRunners>>[number];

/**
 * Is anything listening, and can it do anything? Both have to be answerable
 * before the table means anything: an idle queue, a dead laptop and an
 * exhausted account pool all produce the same frozen board.
 */
function Banner({ runners, pool, waiting }: Readonly<{ runners: Runner[]; pool: Awaited<ReturnType<typeof getClaudePoolSummary>>; waiting: number }>) {
  const live = runners.filter((runner) => Date.now() - runner.lastSeenAt.getTime() <= RUNNER_STALE_MS);

  if (runners.length === 0 || live.length === 0) {
    return (
      <Alert tone="warning" title={runners.length === 0 ? 'No orchestrator has ever polled for work' : 'No orchestrator is reporting'}>
        Queued jobs sit here untouched until a machine runs <code>python -m orchestrator run</code> in idion-orchestrator.
      </Alert>
    );
  }

  if (pool.total === 0) {
    return (
      <Alert tone="warning" title="The Claude account pool is empty">
        Orchestrators are online but cannot claim anything without an account. Add one on{' '}
        <Link href="/internal/accounts" className="underline">
          Accounts
        </Link>{' '}
        or with <code>python -m orchestrator accounts add claude</code>.
      </Alert>
    );
  }

  if (pool.free === 0 && waiting > 0) {
    return (
      <Alert tone="warning" title={`All Claude accounts are busy or limited · ${waiting} job${waiting === 1 ? '' : 's'} waiting`}>
        {pool.nextResetAt
          ? `The next account comes back ${untilLabel(pool.nextResetAt)} (${pool.nextResetAt.toLocaleString()}); waiting jobs resume on it automatically.`
          : 'Waiting jobs start as soon as a running job releases its account.'}
      </Alert>
    );
  }

  return (
    <Alert tone="success" title={`${live.length} orchestrator${live.length === 1 ? '' : 's'} online · ${pool.free} of ${pool.total} Claude accounts free`}>
      {pool.limited ? `${pool.limited} limited — the next one resets ${pool.nextResetAt ? untilLabel(pool.nextResetAt) : 'soon'}.` : 'No account is limited right now.'}
    </Alert>
  );
}

// Plain links rather than the Chip primitive — Chip is a <button>, and these
// navigate. A filtered view is a shareable link.
function TabLink({ href, active, children }: Readonly<{ href: string; active: boolean; children: React.ReactNode }>) {
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

function stageText(run: PipelineRunListRow): string {
  const progress = run.progress as { stage?: string; stageIndex?: number; stageCount?: number };
  return progress?.stage ? `${progress.stage}${progress.stageCount ? ` (${(progress.stageIndex ?? 0) + 1}/${progress.stageCount})` : ''}` : '—';
}

function waitingText(run: PipelineRunListRow, pool: Awaited<ReturnType<typeof getClaudePoolSummary>>): string {
  if (run.retryAfter && run.retryAfter > new Date()) return `held until ${run.retryAfter.toLocaleTimeString()}`;
  if (pool.free > 0) return run.status === 'paused' ? 'resuming on the next poll' : 'next poll';
  return pool.nextResetAt ? `waiting for an account (${untilLabel(pool.nextResetAt)})` : 'waiting for an account';
}

function Machines({ runners }: Readonly<{ runners: Runner[] }>) {
  if (runners.length === 0) return null;

  return (
    <Stack gap="sm">
      <Heading level={3}>Machines</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Machine</TableHeaderCell>
            <TableHeaderCell>Jobs</TableHeaderCell>
            <TableHeaderCell>Kinds</TableHeaderCell>
            <TableHeaderCell>Version</TableHeaderCell>
            <TableHeaderCell>Tools</TableHeaderCell>
            <TableHeaderCell>Last seen</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runners.map((runner) => {
            const stale = Date.now() - runner.lastSeenAt.getTime() > RUNNER_STALE_MS;
            return (
              <TableRow key={runner.runnerId}>
                <TableCell>
                  <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', stale ? 'bg-text-tertiary' : 'bg-success')} aria-hidden />
                  <span className="font-medium">{runner.runnerId}</span>
                  {runner.host && runner.host !== runner.runnerId ? <span className="ml-2 text-caption text-text-tertiary">{runner.host}</span> : null}
                </TableCell>
                <TableCell>{runner.capacity !== null ? `${runner.activeRuns ?? 0} / ${runner.capacity}` : '—'}</TableCell>
                <TableCell className="text-caption">{runner.kinds?.join(', ') ?? '—'}</TableCell>
                <TableCell className="text-caption">{runner.version ?? 'legacy runner'}</TableCell>
                <TableCell className="text-caption text-text-tertiary">
                  {runner.tools
                    ? Object.entries(runner.tools)
                        .map(([tool, version]) => `${tool} ${version ?? '✗'}`)
                        .join(' · ')
                    : '—'}
                </TableCell>
                <TableCell>
                  <time dateTime={runner.lastSeenAt.toISOString()}>{sinceLabel(runner.lastSeenAt)}</time>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
  );
}

export default async function RunsPage({ searchParams }: PageProps) {
  await requireUser();

  const { tab: rawTab } = await searchParams;
  const tab: Tab = isTab(rawTab) ? rawTab : 'queue';

  // Reap before reading, so the board an admin is looking at is not quietly
  // showing a run whose lease lapsed hours ago.
  await reapExpiredRunsQuietly();

  const [allRuns, counts, runners, pool] = await Promise.all([listRuns({ limit: 200 }), countRunsByStatus(), listRunners(), getClaudePoolSummary()]);
  const runs = allRuns.filter((run) => tabStatuses[tab].includes(run.status));
  const accounts = tab === 'running' ? await getActiveRunAccounts(runs.map((run) => run.id)) : {};
  const count = (which: Tab) => tabStatuses[which].reduce((sum, status) => sum + (counts[status] ?? 0), 0);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Jobs</Heading>
          <Body size="small" className="mt-1">
            Discovery, product and build jobs. You start them and you can stop them; everything in between — claiming, switching accounts at a limit, resuming — happens on
            its own.
          </Body>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/internal/accounts"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
          >
            Accounts
          </Link>
          <Link
            href="/internal/runs/new"
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-strong"
          >
            New discovery job
          </Link>
        </div>
      </div>

      <Banner runners={runners} pool={pool} waiting={count('queue')} />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(tabLabels) as Tab[]).map((value) => (
          <TabLink key={value} href={`/internal/runs?tab=${value}`} active={tab === value}>
            {tabLabels[value]} ({count(value)})
          </TabLink>
        ))}
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Job</TableHeaderCell>
            <TableHeaderCell>Bet</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>{tab === 'queue' ? 'Waiting on' : 'Stage'}</TableHeaderCell>
            <TableHeaderCell>{tab === 'running' ? 'Account · machine' : tab === 'queue' ? 'Sessions' : 'Duration'}</TableHeaderCell>
            <TableHeaderCell>Requested by</TableHeaderCell>
            <TableHeaderCell>Queued</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.length === 0 ? (
            <TableEmpty colSpan={7}>{tab === 'queue' ? 'Nothing waiting.' : tab === 'running' ? 'Nothing running.' : 'No finished jobs yet.'}</TableEmpty>
          ) : (
            runs.map((run) => (
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
                  <RunStatusBadge status={run.status} sessionCount={run.sessionCount} />
                  {run.cancelRequestedAt && tab === 'running' ? <span className="ml-2 text-caption text-warning">stopping</span> : null}
                </TableCell>
                <TableCell className="text-body-small">{tab === 'queue' ? waitingText(run, pool) : stageText(run)}</TableCell>
                <TableCell className="text-body-small">
                  {tab === 'running'
                    ? `${accounts[run.id]?.join(', ') ?? '—'} · ${run.runnerId ?? '—'}`
                    : tab === 'queue'
                      ? run.sessionCount || '—'
                      : duration(run.startedAt, run.finishedAt)}
                </TableCell>
                <TableCell>{run.requestedByName ?? '—'}</TableCell>
                <TableCell>{formatRelative(run.queuedAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Machines runners={runners} />
    </Stack>
  );
}
