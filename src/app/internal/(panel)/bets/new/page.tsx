import { Stack } from '@/components/surfaces';
import { Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { createBet } from '@/server/actions/bets';
import { listActiveUsers } from '@/server/queries/bets';

import { BetForm } from '../bet-form';

export default async function NewBetPage() {
  const user = await requireUser();
  const owners = await listActiveUsers();

  return (
    <Stack gap="lg" className="max-w-3xl">
      <Heading level={1}>New bet</Heading>
      <BetForm
        action={createBet}
        owners={owners}
        submitLabel="Create bet"
        cancelHref="/internal/bets"
        values={{
          slug: '',
          title: '',
          description: '',
          status: 'backlog',
          audience: 'b2c',
          priority: 'medium',
          // Default to the creator: a bet with no owner is how things go stale.
          ownerId: user.id,
          publicSlug: '',
          nextAction: '',
          startedAt: '',
          targetDate: ''
        }}
      />
    </Stack>
  );
}
