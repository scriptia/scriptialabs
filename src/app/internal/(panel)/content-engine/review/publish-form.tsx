'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input, Select } from '@/components/primitives';
import { Label } from '@/components/typography';
import { markPublished, type MarkPublishedFormState } from '@/server/actions/content-engine';

// Not an enforced enum — Publication.platform is plain text (see
// trend_sources.platform, same reasoning) — just a convenience list of the
// platforms actually in use, so this doesn't require free typing every time.
const PLATFORMS = ['instagram', 'tiktok', 'youtube_shorts', 'x', 'linkedin'] as const;

export function PublishForm({ contentPieceId }: Readonly<{ contentPieceId: string }>) {
  const [state, formAction, pending] = useActionState<MarkPublishedFormState, FormData>(markPublished, {});
  const id = React.useId();
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-subtle p-3">
      <input type="hidden" name="contentPieceId" value={contentPieceId} />

      {state.error ? (
        <div className="w-full">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}

      <div>
        <Label htmlFor={`${id}-platform`}>Platform</Label>
        <Select id={`${id}-platform`} name="platform" defaultValue={PLATFORMS[0]} className="mt-0.5 h-9 w-40">
          {PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </Select>
        {errors.platform ? <p className="mt-0.5 text-caption text-error">{errors.platform}</p> : null}
      </div>

      <div>
        <Label htmlFor={`${id}-permalink`}>Permalink (optional)</Label>
        <Input id={`${id}-permalink`} name="permalink" placeholder="https://…" className="mt-0.5 h-9 w-64" />
        {errors.permalink ? <p className="mt-0.5 text-caption text-error">{errors.permalink}</p> : null}
      </div>

      <Button type="submit" size="sm" loading={pending}>
        {pending ? 'Marking…' : 'Mark as published'}
      </Button>
    </form>
  );
}
