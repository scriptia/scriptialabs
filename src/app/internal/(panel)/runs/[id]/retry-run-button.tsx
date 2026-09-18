'use client';

import { useTransition } from 'react';

import { Button } from '@/components/primitives';
import { retryRun } from '@/server/actions/pipeline-runs';

// Re-queues this run's parameters as a NEW run rather than resetting this one.
// Keeping the failed row is the point: its timeline is the evidence of what went
// wrong, and a retry that overwrote it would erase the only record.
export function RetryRunButton({ runId }: Readonly<{ runId: string }>) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await retryRun(formData);
        });
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Queueing…' : 'Retry'}
      </Button>
    </form>
  );
}
