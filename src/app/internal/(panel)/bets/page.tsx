import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Badge, Button } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { betAudienceLabels } from '@/content/internal';
import { requireUser } from '@/server/auth/guard';
import { listActiveUsers, listBets } from '@/server/queries/bets';

import { BetPriorityBadge, BetStatusBadge } from '../_components/bet-status-badge';
import { formatDate, formatRelative } from '../_components/format';
import { BetFilters } from './bet-filters';
import { toBetFilters, type BetSearchParams } from './search-params';

export default async function BetsPage({ searchParams }: Readonly<{ searchParams: Promise<BetSearchParams> }>) {
  await requireUser();

  const params = await searchParams;
  const [rows, owners] = await Promise.all([listBets(toBetFilters(params)), listActiveUsers()]);

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Bets</Heading>
          <Body size="small" className="mt-1">
            {rows.length} {rows.length === 1 ? 'bet' : 'bets'} matching.
          </Body>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/internal/bets/board">Board view</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/internal/bets/new">New bet</Link>
          </Button>
        </div>
      </div>

      <BetFilters owners={owners} />

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Bet</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Owner</TableHeaderCell>
            <TableHeaderCell>Audience</TableHeaderCell>
            <TableHeaderCell>Priority</TableHeaderCell>
            <TableHeaderCell>Target</TableHeaderCell>
            <TableHeaderCell>Activity</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={7}>No bets match these filters.</TableEmpty>
          ) : (
            rows.map((bet) => (
              <TableRow key={bet.id} interactive>
                <TableCell>
                  <Link href={`/internal/bets/${bet.slug}`} className="font-medium hover:text-brand">
                    {bet.title}
                  </Link>
                  {bet.archivedAt ? <Badge className="ml-2">Archived</Badge> : null}
                  {bet.nextAction ? <p className="mt-0.5 line-clamp-1 text-caption text-text-tertiary">Next: {bet.nextAction}</p> : null}
                </TableCell>
                <TableCell>
                  <BetStatusBadge status={bet.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-secondary">{bet.ownerName ?? 'Unassigned'}</TableCell>
                <TableCell className="text-text-secondary">{betAudienceLabels[bet.audience]}</TableCell>
                <TableCell>
                  <BetPriorityBadge priority={bet.priority} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-text-secondary">{formatDate(bet.targetDate)}</TableCell>
                <TableCell className="whitespace-nowrap text-text-tertiary">{formatRelative(bet.updatedAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Stack>
  );
}
