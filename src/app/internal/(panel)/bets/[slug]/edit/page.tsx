import { notFound } from 'next/navigation';

import { Stack } from '@/components/surfaces';
import { Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { updateBet } from '@/server/actions/bets';
import { getBetBySlug, listActiveUsers } from '@/server/queries/bets';

import { BetForm } from '../../bet-form';
import { ArchiveButton } from './archive-button';

export default async function EditBetPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  await requireUser();

  const { slug } = await params;
  const [bet, owners] = await Promise.all([getBetBySlug(slug), listActiveUsers()]);

  if (!bet) {
    notFound();
  }

  return (
    <Stack gap="lg" className="max-w-3xl">
      <Heading level={1}>Edit {bet.title}</Heading>

      <BetForm
        action={updateBet}
        owners={owners}
        submitLabel="Save changes"
        cancelHref={`/internal/bets/${bet.slug}`}
        values={{
          id: bet.id,
          slug: bet.slug,
          title: bet.title,
          description: bet.description ?? '',
          status: bet.status,
          audience: bet.audience,
          priority: bet.priority,
          ownerId: bet.ownerId ?? '',
          publicSlug: bet.publicSlug ?? '',
          nextAction: bet.nextAction ?? '',
          startedAt: bet.startedAt ?? '',
          targetDate: bet.targetDate ?? ''
        }}
      />

      <ArchiveButton betId={bet.id} archived={Boolean(bet.archivedAt)} title={bet.title} />
    </Stack>
  );
}
