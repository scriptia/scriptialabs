'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/primitives';
import { stopRun } from '@/server/actions/pipeline-runs';

// Stop is the only control a human has over a run once it is started — a
// paused run resumes by itself on the next free account, so there is no
// resume button to put next to it. Two clicks, because it cannot be undone: a
// stopped run is finished, and running it again starts a new job.
export function CancelRunButton({ runId, size = 'sm' }: Readonly<{ runId: string; size?: 'sm' | 'md' }>) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" size={size} onClick={() => setConfirming(true)}>
        Stop job
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      action={(formData) => {
        startTransition(async () => {
          const result = await stopRun(formData);
          if (result.error) setError(result.error);
          setConfirming(false);
        });
      }}
    >
      <input type="hidden" name="runId" value={runId} />
      <span className="text-body-small text-text-secondary">Stop for good?</span>
      <Button type="submit" variant="danger" size={size} disabled={pending}>
        {pending ? 'Stopping…' : 'Yes, stop it'}
      </Button>
      <Button type="button" variant="ghost" size={size} disabled={pending} onClick={() => setConfirming(false)}>
        Keep running
      </Button>
      {error ? <span className="text-body-small text-error">{error}</span> : null}
    </form>
  );
}
