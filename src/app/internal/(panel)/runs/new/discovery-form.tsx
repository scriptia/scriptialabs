'use client';

import { useActionState, useState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { queueDiscoveryRun, type RunActionState } from '@/server/actions/pipeline-runs';

// Queues a market hunt. Built to be usable one-handed on a phone: large controls,
// no horizontal layout, and a default that needs zero input — press the button
// and the scheduler picks the next markets off the roster on its next pass.
export function DiscoveryForm({ resumable }: Readonly<{ resumable: string[] }>) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(queueDiscoveryRun, {});
  const [mode, setMode] = useState<'new' | 'resume'>('new');

  return (
    <form action={formAction}>
      <Stack gap="md">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">Queued. The next scheduled pass will pick it up.</Alert> : null}

        <div>
          <Label htmlFor="mode">What to run</Label>
          <Select id="mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value as 'new' | 'resume')} className="mt-1 h-11">
            <option value="new">New hunt — next free run id</option>
            <option value="resume">Resume an unfinished run</option>
          </Select>
        </div>

        {mode === 'resume' ? (
          <div>
            <Label htmlFor="externalRunId">Run to resume</Label>
            {resumable.length > 0 ? (
              <Select id="externalRunId" name="externalRunId" className="mt-1 h-11" defaultValue={resumable[0]}>
                {resumable.map((runId) => (
                  <option key={runId} value={runId}>
                    {runId}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="externalRunId" name="externalRunId" placeholder="2026-W36" className="mt-1 h-11" />
            )}
            <p className="mt-1 text-caption text-text-tertiary">
              Re-enters the run and redoes whatever is not finished — an unjudged slate, a publish that hit the quota. Nothing already complete is repeated.
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="markets">Markets (optional)</Label>
              <Input id="markets" name="markets" placeholder="strength training, sleep" className="mt-1 h-11" />
              <p className="mt-1 text-caption text-text-tertiary">Comma-separated. Leave empty to take the next ones off the roster cursor.</p>
            </div>
            <div>
              <Label htmlFor="marketsCount">How many markets</Label>
              <Input id="marketsCount" name="marketsCount" type="number" min={1} max={6} defaultValue={1} className="mt-1 h-11" />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="budgetUsd">Budget cap, USD (optional)</Label>
          <Input id="budgetUsd" name="budgetUsd" type="number" min={0} step={1} placeholder="no ceiling" className="mt-1 h-11" />
          <p className="mt-1 text-caption text-text-tertiary">Stops launching new sessions past this, then still publishes what it has.</p>
        </div>

        <Button type="submit" disabled={pending} className="h-12 w-full">
          {pending ? 'Queueing…' : mode === 'resume' ? 'Queue resume' : 'Queue discovery run'}
        </Button>

        <p className="text-caption text-text-tertiary">
          Queueing does not start anything. The scheduler on the laptop checks three times a day (09:00, 15:00, 21:00 Madrid) and runs whatever is waiting.
        </p>
      </Stack>
    </form>
  );
}
