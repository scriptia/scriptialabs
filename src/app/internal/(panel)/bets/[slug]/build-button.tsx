'use client';

import { useActionState, useState } from 'react';

import { Modal } from '@/components/display';
import { Alert } from '@/components/feedback';
import { Button, Radio } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { availableDeployTargets, deployTargetDescriptions, deployTargetLabels, deployTargets, type DeployTarget } from '@/content/internal';
import { cn } from '@/lib/utils';
import { queueBuildRun, type RunActionState } from '@/server/actions/pipeline-runs';

export type BuildSummary = {
  slug: string;
  published: boolean;
  featureCount: number;
  assetCount: number;
  legalDocumentCount: number;
  hasStore: boolean;
  storeFieldsPending: number | null;
  missingAssetKinds: string[];
  liveUrl: string;
};

// Confirms what the build job will actually expose before queueing it.
//
// The list matters more than the button. A build consumes whatever the product
// agent left behind, and the failures that hurt are the quiet ones — no icon, no
// legal documents, a store block still full of NEEDS DECISION. Those are cheap to
// see now and expensive to discover after the builder has scaffolded an app.
export function BuildButton({ betId, summary }: Readonly<{ betId: string; summary: BuildSummary }>) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DeployTarget>('supabase');
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(queueBuildRun, {});

  const blockers: string[] = [];
  if (!summary.published) blockers.push('The product is unpublished, so every URL below 404s.');
  if (summary.legalDocumentCount === 0) blockers.push('No legal documents — a store submission fails its privacy-URL check.');

  const warnings: string[] = [];
  if (summary.missingAssetKinds.length > 0) warnings.push(`Missing assets: ${summary.missingAssetKinds.join(', ')}.`);
  if (!summary.hasStore) warnings.push('No store block; App Store Connect fields will have to be filled by hand.');
  if (summary.storeFieldsPending) warnings.push(`${summary.storeFieldsPending} store field(s) still marked NEEDS DECISION.`);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Build
      </Button>

      <Modal open={open} onOpenChange={setOpen} className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 backdrop:bg-black/40">
        <Stack gap="md">
          <Heading level={3}>Hand off to the builder</Heading>
          <Body size="small">
            The build job builds the app from everything below, deploys its backend, then runs <code>eas build --auto-submit</code> and uploads the store listing with
            Fastlane. Submitting for review stays with you.
          </Body>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}

          {blockers.map((blocker) => (
            <Alert key={blocker} tone="error">
              {blocker}
            </Alert>
          ))}
          {warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-body-small">
            <dt className="text-text-tertiary">Product</dt>
            <dd className="text-text-primary">
              /{summary.slug} {summary.published ? '' : '(unpublished)'}
            </dd>
            <dt className="text-text-tertiary">Live URL</dt>
            <dd className="truncate text-text-primary">{summary.liveUrl}</dd>
            <dt className="text-text-tertiary">Features</dt>
            <dd className="text-text-primary">{summary.featureCount}</dd>
            <dt className="text-text-tertiary">Assets</dt>
            <dd className="text-text-primary">{summary.assetCount}</dd>
            <dt className="text-text-tertiary">Legal documents</dt>
            <dd className="text-text-primary">{summary.legalDocumentCount}</dd>
            <dt className="text-text-tertiary">Store block</dt>
            <dd className="text-text-primary">{summary.hasStore ? 'present' : 'missing'}</dd>
          </dl>

          <fieldset className="space-y-2">
            <legend className="text-body-small font-medium text-text-primary">Backend</legend>
            {deployTargets.map((value) => {
              const available = availableDeployTargets.includes(value);
              return (
                <label
                  key={value}
                  className={cn(
                    'flex gap-3 rounded-lg border p-3',
                    target === value ? 'border-brand bg-brand-subtle/40' : 'border-border',
                    available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  )}
                >
                  <Radio name="deployTargetChoice" value={value} checked={target === value} disabled={!available} onChange={() => setTarget(value)} className="mt-0.5" />
                  <span>
                    <span className="block text-body-small font-medium text-text-primary">
                      {deployTargetLabels[value]}
                      {available ? '' : ' · coming soon'}
                    </span>
                    <span className="block text-caption text-text-secondary">{deployTargetDescriptions[value]}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="betId" value={betId} />
              <input type="hidden" name="deployTarget" value={target} />
              <Button type="submit" disabled={pending} variant={blockers.length ? 'secondary' : 'primary'}>
                {pending ? 'Queueing…' : blockers.length ? 'Queue anyway' : 'Queue build'}
              </Button>
            </form>
          </div>
        </Stack>
      </Modal>
    </>
  );
}
