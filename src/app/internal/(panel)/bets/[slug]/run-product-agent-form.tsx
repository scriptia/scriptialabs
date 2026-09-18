'use client';

import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Switch } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { queueProductAgentRun, type RunActionState } from '@/server/actions/pipeline-runs';

// ISO week, matching default_run_id() in product-agent/orchestrator/run_product.py.
// Prefilled rather than left blank so the run directory on disk lines up with
// what the panel shows without anyone having to think about it.
function isoWeek(date = new Date()): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function Hint({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="mt-1 text-caption text-text-tertiary">{children}</p>;
}

// Switch is a bare <input role="switch"> with no label of its own.
function SwitchField({ name, label, defaultChecked }: Readonly<{ name: string; label: string; defaultChecked?: boolean }>) {
  return (
    <label htmlFor={name} className="flex cursor-pointer items-center gap-3">
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
      <span className="text-body-small font-medium text-text-primary">{label}</span>
    </label>
  );
}

export function RunProductAgentForm({ betId }: Readonly<{ betId: string }>) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(queueProductAgentRun, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="betId" value={betId} />
      <Stack gap="md">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <div>
          <SwitchField name="publishLegal" defaultChecked label="Publish legal pages" />
          <Hint>
            Off still writes the trimmed legal documents — the App Store record needs them either way — but the product page ships without legal links and
            <code className="mx-1">legal.hosted</code>
            stays false, so a store submission will fail its privacy-URL check.
          </Hint>
        </div>

        <div>
          <SwitchField name="createFeatures" defaultChecked label="Create feature specs" />
          <Hint>Off skips the features-plan and features-write stages. The judge is told, so it does not fail the run for missing traceability.</Hint>
        </div>

        <div>
          <Label htmlFor="externalRunId">Run id</Label>
          <Input id="externalRunId" name="externalRunId" defaultValue={isoWeek()} className="mt-1" />
          <Hint>Names the directory the artifacts land in, on the machine running the poller.</Hint>
        </div>

        <div>
          <SwitchField name="force" label="Force re-run of completed stages" />
          <Hint>Ignores stages already marked done in that run directory&apos;s state.json.</Hint>
        </div>

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? 'Queueing…' : 'Queue product-agent run'}
        </Button>
        <Hint>
          Queueing does not start anything by itself. A poller
          (<code>python orchestrator/runner.py</code>) claims the job and runs it; the bet stays in Backlog until the run publishes a product page.
        </Hint>
      </Stack>
    </form>
  );
}
