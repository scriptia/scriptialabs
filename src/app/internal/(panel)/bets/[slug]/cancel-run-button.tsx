'use client';

import { useTransition } from 'react';

import { Button } from '@/components/primitives';
import { cancelRun } from '@/server/actions/pipeline-runs';

// A queued run is cancelled outright; an in-flight one is only flagged, and the
// runner stops at its next stage boundary. The wording says "Request stop"
// rather than "Cancel" because the second case is not instant and pretending
// otherwise makes people click it twice.
export function CancelRunButton({ runId }: Readonly<{ runId: string }>) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await cancelRun(formData);
        });
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Requesting…' : 'Request stop'}
      </Button>
    </form>
  );
}
