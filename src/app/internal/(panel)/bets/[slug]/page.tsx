import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Tabs } from '@/components/display';
import { Badge, Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { betAudienceLabels } from '@/content/internal';
import { getProductBySlug } from '@/content/products';
import { requireUser } from '@/server/auth/guard';
import { getBetBySlug, getBetLinks, getBetMetrics, getBetTasks, getBetUpdates, listActiveUsers } from '@/server/queries/bets';

import { BetPriorityBadge, BetStatusBadge } from '../../_components/bet-status-badge';
import { formatDate, formatRelative } from '../../_components/format';
import { LinksPanel } from './links-panel';
import { MetricsPanel } from './metrics-panel';
import { TasksPanel } from './tasks-panel';
import { UpdatesPanel } from './updates-panel';

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <p className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-body-small text-text-primary">{children}</p>
    </div>
  );
}

export default async function BetDetailPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  await requireUser();

  const { slug } = await params;
  const bet = await getBetBySlug(slug);

  if (!bet) {
    notFound();
  }

  // Fetched in parallel: the neon-http driver costs one HTTP round trip per
  // query, so serialising these would be four times the latency for no reason.
  const [links, updates, metrics, tasks, owners] = await Promise.all([
    getBetLinks(bet.id),
    getBetUpdates(bet.id),
    getBetMetrics(bet.id),
    getBetTasks(bet.id),
    listActiveUsers()
  ]);

  const publicProduct = bet.publicSlug ? getProductBySlug(bet.publicSlug) : undefined;
  const openTasks = tasks.filter((task) => !task.done).length;

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>{bet.title}</Heading>
            {bet.archivedAt ? <Badge>Archived</Badge> : null}
          </div>
          <Body size="small" className="mt-1">
            /{bet.slug} · updated {formatRelative(bet.updatedAt)}
          </Body>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BetStatusBadge status={bet.status} />
          <BetPriorityBadge priority={bet.priority} />
          <Button asChild variant="secondary" size="sm">
            <Link href={`/internal/bets/${bet.slug}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      {bet.description ? (
        <Surface className="p-5">
          <p className="whitespace-pre-wrap text-body-small text-text-secondary">{bet.description}</p>
        </Surface>
      ) : null}

      <Surface className="p-5">
        <Grid cols={4} gap="md">
          <Field label="Owner">{bet.ownerName ?? 'Unassigned'}</Field>
          <Field label="Audience">{betAudienceLabels[bet.audience]}</Field>
          <Field label="Started">{formatDate(bet.startedAt)}</Field>
          <Field label="Target">{formatDate(bet.targetDate)}</Field>
          <Field label="Next action">{bet.nextAction ?? '—'}</Field>
          <Field label="Open tasks">{openTasks}</Field>
          <Field label="Public page">
            {publicProduct ? (
              <Link href={`/en/${publicProduct.slug}`} className="text-brand hover:underline">
                /{publicProduct.slug}
              </Link>
            ) : (
              'Not public yet'
            )}
          </Field>
          <Field label="Links">{links.length}</Field>
        </Grid>
      </Surface>

      <Tabs
        items={[
          {
            id: 'updates',
            label: `Updates (${updates.length})`,
            panel: <UpdatesPanel betId={bet.id} updates={updates} />
          },
          {
            id: 'links',
            label: `Links (${links.length})`,
            panel: <LinksPanel betId={bet.id} links={links} />
          },
          {
            id: 'metrics',
            label: 'Metrics',
            panel: <MetricsPanel betId={bet.id} metrics={metrics} />
          },
          {
            id: 'tasks',
            label: `Tasks (${openTasks})`,
            panel: <TasksPanel betId={bet.id} tasks={tasks} owners={owners} />
          }
        ]}
      />
    </Stack>
  );
}
