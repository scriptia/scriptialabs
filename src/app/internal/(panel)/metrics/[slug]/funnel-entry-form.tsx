'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { upsertFunnelEntry, type FunnelFormState } from '@/server/actions/app-metrics';
import type { FunnelEntryRow } from '@/server/queries/app-metrics';

import { currentWeekStart } from '../_components/funnel';
import { FUNNEL_STAGES } from '../_components/stages';

export function FunnelEntryForm({ appId, existing }: Readonly<{ appId: string; existing?: FunnelEntryRow }>) {
  const [state, formAction, pending] = useActionState<FunnelFormState, FormData>(upsertFunnelEntry, {});
  const id = React.useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="appId" value={appId} />

      <Grid cols={2} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-week`}>Week (Monday)</Label>
          <Input id={`${id}-week`} name="periodStart" type="date" defaultValue={existing?.periodStart ?? currentWeekStart()} required />
        </Stack>
      </Grid>

      <Grid cols={2} gap="md">
        {FUNNEL_STAGES.map((stage) => (
          <Stack key={stage.key} gap="xs">
            <Label htmlFor={`${id}-${stage.key}`}>{stage.label}</Label>
            <Input
              id={`${id}-${stage.key}`}
              name={stage.key}
              type="number"
              min={0}
              step={1}
              defaultValue={existing?.[stage.key] ?? 0}
              required
            />
          </Stack>
        ))}
      </Grid>

      <Stack gap="xs">
        <Label htmlFor={`${id}-notes`}>Notes (optional)</Label>
        <Textarea id={`${id}-notes`} name="notes" rows={2} defaultValue={existing?.notes ?? ''} placeholder="e.g. new hook format tested this week" />
      </Stack>

      <div>
        <Button type="submit" loading={pending}>
          {existing ? 'Update week' : 'Save week'}
        </Button>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
