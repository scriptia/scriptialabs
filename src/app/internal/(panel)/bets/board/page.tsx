import Link from 'next/link';

import { Card } from '@/components/data';
import { Button } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { betStatusLabels } from '@/content/internal';
import { requireUser } from '@/server/auth/guard';
import { getBoard, listActiveUsers } from '@/server/queries/bets';

import { BetPriorityBadge } from '../../_components/bet-status-badge';
import { formatRelative } from '../../_components/format';
import { BetFilters } from '../bet-filters';
import { toBetFilters, type BetSearchParams } from '../search-params';
import { StatusSelect } from './status-select';

export default async function BetsBoardPage({ searchParams }: Readonly<{ searchParams: Promise<BetSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  // The status filter is meaningless on a board grouped by status — drop it so
  // arriving here from a filtered list doesn't render six empty columns.
  const filters = { ...toBetFilters(params), status: undefined };
  const [columns, owners] = await Promise.all([getBoard(filters), listActiveUsers()]);

  const total = columns.reduce((sum, column) => sum + column.bets.length, 0);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Board</Heading>
          <Body size="small" className="mt-1">
            {total} {total === 1 ? 'bet' : 'bets'} across {columns.filter((column) => column.bets.length > 0).length} stages.
          </Body>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/internal/bets">Table view</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/internal/bets/new">New bet</Link>
          </Button>
        </div>
      </div>

      <BetFilters owners={owners} />

      {/* Horizontal scroll on the board itself, so the page body never scrolls
          sideways however many stages exist. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-4">
          {columns.map((column) => (
            <section key={column.status} className="w-72 shrink-0" aria-label={betStatusLabels[column.status]}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-caption font-medium uppercase tracking-[0.08em] text-text-tertiary">{betStatusLabels[column.status]}</h2>
                <span className="text-caption text-text-tertiary">{column.bets.length}</span>
              </div>

              <Stack gap="sm">
                {column.bets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-caption text-text-tertiary">Empty</div>
                ) : (
                  column.bets.map((bet) => (
                    <Card key={bet.id} className="p-3">
                      <Link href={`/internal/bets/${bet.slug}`} className="text-body-small font-medium hover:text-brand">
                        {bet.title}
                      </Link>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-caption text-text-tertiary">{bet.ownerName ?? 'Unassigned'}</span>
                        <BetPriorityBadge priority={bet.priority} />
                      </div>
                      <p className="mt-1 text-caption text-text-tertiary">Updated {formatRelative(bet.updatedAt)}</p>
                      <div className="mt-3">
                        <StatusSelect betId={bet.id} status={bet.status} />
                      </div>
                    </Card>
                  ))
                )}
              </Stack>
            </section>
          ))}
        </div>
      </div>
    </Stack>
  );
}
