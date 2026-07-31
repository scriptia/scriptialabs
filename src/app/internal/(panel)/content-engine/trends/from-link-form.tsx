'use client';

import { useActionState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { createTrendSourceFromLinkAction, type TrendSourceFormState } from '@/server/actions/content-engine';

export function FromLinkForm({ appId }: Readonly<{ appId: string }>) {
  const [state, formAction, pending] = useActionState<TrendSourceFormState, FormData>(createTrendSourceFromLinkAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="appId" value={appId} />

      <div>
        <Label htmlFor="platform">Platform</Label>
        <Input id="platform" name="platform" placeholder="instagram, tiktok, youtube_shorts…" className="mt-1 h-9 w-48" required />
        {state.fieldErrors?.platform ? <p className="mt-1 text-caption text-error">{state.fieldErrors.platform}</p> : null}
      </div>

      <div className="flex-1 basis-64">
        <Label htmlFor="url">Video URL</Label>
        <Input id="url" name="url" type="url" placeholder="https://…" className="mt-1 h-9 w-full" required />
        {state.fieldErrors?.url ? <p className="mt-1 text-caption text-error">{state.fieldErrors.url}</p> : null}
      </div>

      <Button type="submit" size="sm" loading={pending}>
        Register link
      </Button>

      {state.error ? (
        <Stack className="w-full">
          <Alert tone="error">{state.error}</Alert>
        </Stack>
      ) : null}
    </form>
  );
}
