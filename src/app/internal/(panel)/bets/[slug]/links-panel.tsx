'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { betLinkKindLabels, betLinkKinds, type BetLinkKind } from '@/content/internal';
import { addBetLink, deleteBetLink, type DetailState } from '@/server/actions/bet-details';

export type LinkRow = {
  id: string;
  kind: BetLinkKind;
  label: string | null;
  url: string;
};

export function LinksPanel({ betId, links }: Readonly<{ betId: string; links: LinkRow[] }>) {
  const [state, formAction, pending] = useActionState<DetailState, FormData>(addBetLink, {});
  const id = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  // Clear the inputs once a submit lands without an error, so adding several
  // links in a row doesn't mean re-selecting and re-clearing every field.
  React.useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <Stack gap="lg">
      {links.length === 0 ? (
        <p className="text-body-small text-text-secondary">No links yet. Add the Drive folder, the repo and the social accounts.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <span className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{betLinkKindLabels[link.kind]}</span>
                <a href={link.url} target="_blank" rel="noreferrer noopener" className="block truncate text-body-small text-brand hover:underline">
                  {link.label || link.url}
                </a>
              </div>
              <form action={deleteBetLink}>
                <input type="hidden" name="id" value={link.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="grid gap-3 rounded-lg border border-border bg-surface-subtle p-4 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="betId" value={betId} />

        <Stack gap="xs">
          <Label htmlFor={`${id}-kind`}>Kind</Label>
          <Select id={`${id}-kind`} name="kind" defaultValue="drive" className="w-auto">
            {betLinkKinds.map((kind) => (
              <option key={kind} value={kind}>
                {betLinkKindLabels[kind]}
              </option>
            ))}
          </Select>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-url`}>URL</Label>
          <Input id={`${id}-url`} name="url" type="url" placeholder="https://" required />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-label`}>Label (optional)</Label>
          <Input id={`${id}-label`} name="label" placeholder="Campaign assets" />
        </Stack>

        <Button type="submit" loading={pending}>
          Add
        </Button>

        {state.error ? (
          <div className="sm:col-span-4">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
      </form>
    </Stack>
  );
}
