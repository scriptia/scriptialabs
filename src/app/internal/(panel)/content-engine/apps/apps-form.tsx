'use client';

import * as React from 'react';
import { useActionState } from 'react';
import Link from 'next/link';

import { Alert } from '@/components/feedback';
import { Button, Input, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { createApp, type AppFormState } from '@/server/actions/content-engine';

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-caption text-error">{message}</p> : null;
}

// Same slug-from-name auto-fill as BetForm — this is always a create (no
// edit path yet), so there's no "never touch it once set" concern to worry
// about here.
export function AppForm() {
  const [state, formAction, pending] = useActionState<AppFormState, FormData>(createApp, {});
  const id = React.useId();
  const errors = state.fieldErrors ?? {};

  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugTouched) {
      return;
    }

    setSlug(
      event.target.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)
    );
  };

  return (
    <form action={formAction} className="grid gap-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Grid cols={3} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} name="name" onChange={onNameChange} required maxLength={160} placeholder="Padelco" />
          <FieldError message={errors.name} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <Input
            id={`${id}-slug`}
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            placeholder="padelco"
          />
          <FieldError message={errors.slug} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-niche`}>Niche</Label>
          <Input id={`${id}-niche`} name="niche" required placeholder="padel" />
          <FieldError message={errors.niche} />
        </Stack>
      </Grid>

      <Grid cols={2} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-brand`}>Brand profile (JSON, optional)</Label>
          <Textarea id={`${id}-brand`} name="brand" rows={5} placeholder='{"tone": "friendly", "voiceExamples": []}' className="font-mono text-caption" />
          <FieldError message={errors.brand} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-product`}>Product profile (JSON, optional)</Label>
          <Textarea id={`${id}-product`} name="product" rows={5} placeholder='{"oneLiner": "..."}' className="font-mono text-caption" />
          <FieldError message={errors.product} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-audience`}>Audience profile (JSON, optional)</Label>
          <Textarea id={`${id}-audience`} name="audience" rows={5} placeholder='{"segments": []}' className="font-mono text-caption" />
          <FieldError message={errors.audience} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-businessGoals`}>Business goals (JSON, optional)</Label>
          <Textarea id={`${id}-businessGoals`} name="businessGoals" rows={5} placeholder='{"primaryEvent": "app_install"}' className="font-mono text-caption" />
          <FieldError message={errors.businessGoals} />
        </Stack>
      </Grid>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? 'Creating…' : 'Create app'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/internal/content-engine">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
