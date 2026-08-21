import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isPipelineRunStatus, pipelineRunKindLabels, pipelineRunStatusLabels, pipelineRunStatuses } from '@/content/internal';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth/guard';
import { countRunsByStatus, listRuns } from '@/server/queries/pipeline-runs';

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

  const [runs, counts] = await Promise.all([listRuns({ status: active }), countRunsByStatus()]);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <Stack gap="lg">
      <div>
        <Heading level={1}>Runs</Heading>
        <Body size="small" className="mt-1">
          Every product-agent and build run. A runner claims queued work by polling this panel — nothing starts on its own.
        </Body>
      </div>

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
                    <Link href={`/internal/bets/${run.betSlug}`} className="hover:underline">
                      {run.betSlug}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>{progress?.stage ? `${progress.stage}${progress.stageCount ? ` (${(progress.stageIndex ?? 0) + 1}/${progress.stageCount})` : ''}` : '—'}</TableCell>
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
