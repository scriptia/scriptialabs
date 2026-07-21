'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Badge, Button, Select, Textarea } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { betUpdateKindLabels, betUpdateKinds, type BetUpdateKind } from '@/content/internal';
import { addBetUpdate, type DetailState } from '@/server/actions/bet-details';

import { formatDateTime } from '../../_components/format';

export type UpdateRow = {
  id: string;
  kind: BetUpdateKind;
  body: string;
  createdAt: Date;
  authorName: string | null;
};

const kindTones: Record<BetUpdateKind, 'neutral' | 'brand' | 'warning' | 'success'> = {
  note: 'neutral',
  decision: 'brand',
  blocker: 'warning',
  milestone: 'success'
};

// Updates are append-only. Editing history would defeat the point of keeping it —
// if something was wrong, the correction is another update.
export function UpdatesPanel({ betId, updates }: Readonly<{ betId: string; updates: UpdateRow[] }>) {
  const [state, formAction, pending] = useActionState<DetailState, FormData>(addBetUpdate, {});
  const id = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <Stack gap="lg">
      <form ref={formRef} action={formAction} className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4">
        <input type="hidden" name="betId" value={betId} />

        <div className="flex flex-wrap items-end gap-3">
          <Stack gap="xs">
            <Label htmlFor={`${id}-kind`}>Type</Label>
            <Select id={`${id}-kind`} name="kind" defaultValue="note" className="w-auto">
              {betUpdateKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {betUpdateKindLabels[kind]}
                </option>
              ))}
            </Select>
          </Stack>
        </div>

        <Stack gap="xs">
          <Label htmlFor={`${id}-body`}>Update</Label>
          <Textarea id={`${id}-body`} name="body" rows={3} placeholder="What happened, what you decided, what's blocking it." required />
        </Stack>

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <div>
          <Button type="submit" loading={pending}>
            Post update
          </Button>
        </div>
      </form>

      {updates.length === 0 ? (
        <p className="text-body-small text-text-secondary">No updates yet.</p>
      ) : (
        <ol className="relative space-y-6 border-l border-border pl-6">
          {updates.map((update) => (
            <li key={update.id} className="relative">
              <span className="absolute -left-[1.9rem] top-1.5 h-2 w-2 rounded-pill bg-border-strong" aria-hidden />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={kindTones[update.kind]}>{betUpdateKindLabels[update.kind]}</Badge>
                <span className="text-caption text-text-tertiary">
                  {formatDateTime(update.createdAt)}
                  {update.authorName ? ` · ${update.authorName}` : ''}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-body-small text-text-primary">{update.body}</p>
            </li>
          ))}
        </ol>
      )}
    </Stack>
  );
}
