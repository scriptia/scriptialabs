'use client';

import * as React from 'react';
import { useActionState } from 'react';
import Link from 'next/link';

import { Alert } from '@/components/feedback';
import { Button, Input, Select, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { betAudienceLabels, betAudiences, betPriorities, betPriorityLabels, betStatusLabels, betStatuses } from '@/content/internal';
import { products } from '@/content/products';
import type { FormState } from '@/server/actions/bets';

export type BetFormValues = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  audience: string;
  priority: string;
  ownerId: string;
  publicSlug: string;
  nextAction: string;
  startedAt: string;
  targetDate: string;
};

export type BetFormProps = Readonly<{
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  values: BetFormValues;
  owners: Array<{ id: string; name: string }>;
  submitLabel: string;
  cancelHref: string;
}>;

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-caption text-error">{message}</p> : null;
}

export function BetForm({ action, values, owners, submitLabel, cancelHref }: BetFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const id = React.useId();
  const errors = state.fieldErrors ?? {};

  // Auto-fill the slug from the title while creating, but never touch it when
  // editing — the slug is the bet's URL and changing it silently would break
  // links people have already shared.
  const [slug, setSlug] = React.useState(values.slug);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(values.id));

  const onTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Grid cols={2} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input id={`${id}-title`} name="title" defaultValue={values.title} onChange={onTitleChange} required maxLength={160} />
          <FieldError message={errors.title} />
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
          />
          <FieldError message={errors.slug} />
        </Stack>
      </Grid>

      <Stack gap="xs">
        <Label htmlFor={`${id}-description`}>Description</Label>
        <Textarea id={`${id}-description`} name="description" defaultValue={values.description} rows={4} placeholder="What is the bet, and what would make it work?" />
        <FieldError message={errors.description} />
      </Stack>

      <Grid cols={3} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-status`}>Status</Label>
          <Select id={`${id}-status`} name="status" defaultValue={values.status}>
            {betStatuses.map((status) => (
              <option key={status} value={status}>
                {betStatusLabels[status]}
              </option>
            ))}
          </Select>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-audience`}>Audience</Label>
          <Select id={`${id}-audience`} name="audience" defaultValue={values.audience}>
            {betAudiences.map((audience) => (
              <option key={audience} value={audience}>
                {betAudienceLabels[audience]}
              </option>
            ))}
          </Select>
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-priority`}>Priority</Label>
          <Select id={`${id}-priority`} name="priority" defaultValue={values.priority}>
            {betPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {betPriorityLabels[priority]}
              </option>
            ))}
          </Select>
        </Stack>
      </Grid>

      <Grid cols={3} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-owner`}>Owner</Label>
          <Select id={`${id}-owner`} name="ownerId" defaultValue={values.ownerId}>
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.ownerId} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-startedAt`}>Started</Label>
          <Input id={`${id}-startedAt`} name="startedAt" type="date" defaultValue={values.startedAt} />
          <FieldError message={errors.startedAt} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-targetDate`}>Target date</Label>
          <Input id={`${id}-targetDate`} name="targetDate" type="date" defaultValue={values.targetDate} />
          <FieldError message={errors.targetDate} />
        </Stack>
      </Grid>

      <Grid cols={2} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-nextAction`}>Next action</Label>
          <Input id={`${id}-nextAction`} name="nextAction" defaultValue={values.nextAction} placeholder="The single next thing that moves this" />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-publicSlug`}>Public product</Label>
          {/* Advisory only — this never writes to the public site, it just links
              a bet to the product page it eventually became. */}
          <Select id={`${id}-publicSlug`} name="publicSlug" defaultValue={values.publicSlug}>
            <option value="">Not public yet</option>
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                /{product.slug}
              </option>
            ))}
          </Select>
        </Stack>
      </Grid>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
