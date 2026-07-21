import Link from 'next/link';

import { Card, StatCard } from '@/components/data';
import { Callout } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { betStatuses, betStatusLabels, betUpdateKindLabels } from '@/content/internal';
import { requireUser } from '@/server/auth/guard';
import { getDashboard } from '@/server/queries/bets';

import { BetStatusBadge } from './_components/bet-status-badge';
import { formatDate, formatRelative } from './_components/format';

export default async function InternalDashboardPage() {
  const user = await requireUser();
  const dashboard = await getDashboard();

  return (
    <Stack gap="xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading level={1}>Hello, {user.name.split(' ')[0]}</Heading>
          <Body size="small" className="mt-1">
            {dashboard.totalActive} active {dashboard.totalActive === 1 ? 'bet' : 'bets'} across the portfolio.
          </Body>
        </div>
        <Button asChild size="sm">
          <Link href="/internal/bets/new">New bet</Link>
        </Button>
      </div>

      <Grid cols={4} gap="md">
        {betStatuses
          .filter((status) => (dashboard.statusCounts[status] ?? 0) > 0)
          .map((status) => (
            <StatCard key={status} value={dashboard.statusCounts[status] ?? 0} label={betStatusLabels[status]} />
          ))}
        {dashboard.totalActive === 0 ? <StatCard value={0} label="No bets yet" /> : null}
      </Grid>

      {/* Stale bets lead the dashboard because this is the signal a spreadsheet
          structurally cannot surface: work that quietly stopped moving. */}
      <Stack gap="sm">
        <Heading level={3}>Needs attention</Heading>
        {dashboard.stale.length === 0 ? (
          <Callout title="Nothing is stale">
            Every active bet has moved in the last {dashboard.staleAfterDays} days.
          </Callout>
        ) : (
          <Stack gap="sm">
            {dashboard.stale.map((bet) => (
              <Surface key={bet.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/internal/bets/${bet.slug}`} className="font-medium hover:text-brand">
                    {bet.title}
                  </Link>
                  <p className="text-body-small text-text-secondary">
                    Last update {formatRelative(bet.lastUpdateAt)}
                    {bet.ownerName ? ` · ${bet.ownerName}` : ' · unassigned'}
                  </p>
                </div>
                <BetStatusBadge status={bet.status} />
              </Surface>
            ))}
          </Stack>
        )}
      </Stack>

      <Grid cols={2} gap="lg">
        <Stack gap="sm">
          <Heading level={3}>Recent updates</Heading>
          {dashboard.recentUpdates.length === 0 ? (
            <Callout>No updates posted yet.</Callout>
          ) : (
            <Card className="divide-y divide-border p-0">
              {dashboard.recentUpdates.map((update) => (
                <div key={update.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/internal/bets/${update.betSlug}`} className="text-body-small font-medium hover:text-brand">
                      {update.betTitle}
                    </Link>
                    <span className="shrink-0 text-caption text-text-tertiary">{formatRelative(update.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-body-small text-text-secondary">{update.body}</p>
                  <p className="mt-1 text-caption text-text-tertiary">
                    {betUpdateKindLabels[update.kind]}
                    {update.authorName ? ` · ${update.authorName}` : ''}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </Stack>

        <Stack gap="sm">
          <Heading level={3}>Open tasks</Heading>
          {dashboard.openTasks.length === 0 ? (
            <Callout>No open tasks.</Callout>
          ) : (
            <Card className="divide-y divide-border p-0">
              {dashboard.openTasks.map((task) => (
                <div key={task.id} className="flex items-baseline justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-body-small text-text-primary">{task.title}</p>
                    <Link href={`/internal/bets/${task.betSlug}`} className="text-caption text-text-tertiary hover:text-brand">
                      {task.betTitle}
                      {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                    </Link>
                  </div>
                  <span className="shrink-0 text-caption text-text-tertiary">{formatDate(task.dueOn)}</span>
                </div>
              ))}
            </Card>
          )}
        </Stack>
      </Grid>
    </Stack>
  );
}
