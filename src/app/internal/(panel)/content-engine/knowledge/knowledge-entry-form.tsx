'use client';

import * as React from 'react';
import { useActionState } from 'react';
import Link from 'next/link';

import { Alert, Callout } from '@/components/feedback';
import { Button, Input, Select, Textarea } from '@/components/primitives';
import { Grid, Stack } from '@/components/surfaces';
import { Label } from '@/components/typography';
import { knowledgeSourceLabels, knowledgeSources } from '@/content/content-engine';
import { createKnowledgeEntry, supersedeKnowledgeEntry, type KnowledgeEntryFormState } from '@/server/actions/content-engine';

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-caption text-error">{message}</p> : null;
}

export type KnowledgeEntryPrefill = {
  id: string;
  principle: string;
  relatedAngle: string | null;
  relatedHookType: string | null;
};

// One form, two modes. Create posts to createKnowledgeEntry; superseding an
// entry binds its id into supersedeKnowledgeEntry and pre-fills principle/
// related_angle/related_hook_type from it — source, confidence and evidence
// start blank on purpose, since a "replacement" is a fresh assessment, not a
// copy. There is deliberately no edit-in-place path and no delete button
// anywhere in this section — KnowledgeEntry is create-and-supersede only.
export function KnowledgeEntryForm({ supersedes }: Readonly<{ supersedes?: KnowledgeEntryPrefill }>) {
  const action = supersedes ? supersedeKnowledgeEntry.bind(null, supersedes.id) : createKnowledgeEntry;
  const [state, formAction, pending] = useActionState<KnowledgeEntryFormState, FormData>(action, {});
  const id = React.useId();
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {supersedes ? (
        <Callout title="This creates a replacement — it does not edit the existing entry">
          The entry being superseded stays in the database exactly as it was. It only gets marked inactive and linked to whatever you save here — nothing
          about its own content changes.
        </Callout>
      ) : null}

      <Stack gap="xs">
        <Label htmlFor={`${id}-principle`}>Principle</Label>
        <Textarea
          id={`${id}-principle`}
          name="principle"
          rows={3}
          required
          defaultValue={supersedes?.principle}
          placeholder="Hooks framed as a question outperform statements for this audience."
        />
        <FieldError message={errors.principle} />
      </Stack>

      <Grid cols={2} gap="md">
        <Stack gap="xs">
          <Label htmlFor={`${id}-source`}>Source</Label>
          <Select id={`${id}-source`} name="source" defaultValue={knowledgeSources[0]}>
            {knowledgeSources.map((source) => (
              <option key={source} value={source}>
                {knowledgeSourceLabels[source]}
              </option>
            ))}
          </Select>
          <FieldError message={errors.source} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-confidence`}>Confidence (0–1)</Label>
          <Input id={`${id}-confidence`} name="confidence" type="number" step="0.01" min="0" max="1" required defaultValue="0.5" />
          <FieldError message={errors.confidence} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-relatedAngle`}>Related angle (optional)</Label>
          <Input id={`${id}-relatedAngle`} name="relatedAngle" defaultValue={supersedes?.relatedAngle ?? ''} placeholder="curiosity_gap" />
          <FieldError message={errors.relatedAngle} />
        </Stack>

        <Stack gap="xs">
          <Label htmlFor={`${id}-relatedHookType`}>Related hook type (optional)</Label>
          <Input id={`${id}-relatedHookType`} name="relatedHookType" defaultValue={supersedes?.relatedHookType ?? ''} placeholder="question" />
          <FieldError message={errors.relatedHookType} />
        </Stack>
      </Grid>

      <Stack gap="xs">
        <Label htmlFor={`${id}-evidence`}>Evidence (JSON, optional)</Label>
        <Textarea id={`${id}-evidence`} name="evidence" rows={5} placeholder='{"sample_size": 40, "source_url": "..."}' className="font-mono text-caption" />
        <FieldError message={errors.evidence} />
      </Stack>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? 'Saving…' : supersedes ? 'Create replacement' : 'Create entry'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/internal/content-engine/knowledge">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
