'use client';

import { useActionState, useState } from 'react';

import { Alert } from '@/components/feedback';
import { Button, Input } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { deployTargetLabels } from '@/content/internal';
import type { AppDeploymentView } from '@/server/queries/pipeline-runs';
import { publishApp, saveBackend, type RunActionState } from '@/server/actions/pipeline-runs';

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="min-w-0 truncate text-text-primary">{children ?? '—'}</dd>
    </>
  );
}

// Where the app lives once built. The build's backend and release stages fill
// it in; when the backend was deferred ("I will deploy Supabase myself"), this
// is where the human hands the URL and key back, and Publish is the trigger
// that runs the release on them.
export function BackendCard({ betId, deployment, canPublish }: Readonly<{ betId: string; deployment: AppDeploymentView | null; canPublish: boolean }>) {
  const [saveState, saveAction, saving] = useActionState<RunActionState, FormData>(saveBackend, {});
  const [publishState, publishAction, publishing] = useActionState<RunActionState, FormData>(publishApp, {});
  const [editing, setEditing] = useState(false);

  const hasBackend = Boolean(deployment?.supabaseUrl && deployment?.supabaseAnonKey);
  const deferred = deployment?.deployTarget === 'deferred';
  const lastBuild = (deployment?.lastBuild ?? null) as { id?: string; url?: string; status?: string; version?: string; buildNumber?: string | number; submissionStatus?: string } | null;
  const showForm = deferred && (!hasBackend || editing);

  return (
    <Surface className="p-5">
      <Stack gap="md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level={3}>Backend &amp; release</Heading>
          {deployment ? <span className="text-caption text-text-tertiary">{deployTargetLabels[deployment.deployTarget]}</span> : null}
        </div>

        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-body-small">
          <Row label="Supabase">
            {deployment?.supabaseUrl ? (
              <a href={deployment.supabaseUrl} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                {deployment.supabaseProjectRef ?? deployment.supabaseUrl}
              </a>
            ) : deferred ? (
              'waiting for you'
            ) : null}
          </Row>
          <Row label="Version">{deployment?.appVersion}</Row>
          <Row label="EAS">{deployment?.easOwner ? `${deployment.easOwner} · ${deployment.easProjectId ?? 'not linked'}` : null}</Row>
          <Row label="App Store Connect">{deployment?.ascAppId ? `app ${deployment.ascAppId}` : null}</Row>
          <Row label="Last build">
            {lastBuild?.id ? (
              <a href={lastBuild.url ?? '#'} className="text-brand hover:underline" target="_blank" rel="noreferrer">
                {lastBuild.version ?? ''} ({lastBuild.buildNumber ?? '?'}) · {lastBuild.status ?? 'unknown'}
                {lastBuild.submissionStatus ? ` · TestFlight ${lastBuild.submissionStatus}` : ''}
              </a>
            ) : null}
          </Row>
        </dl>

        {showForm ? (
          <form action={saveAction} className="space-y-3 rounded-lg border border-border p-4">
            <input type="hidden" name="betId" value={betId} />
            <Body size="small">
              Deploy the backend yourself (see <code>DEPLOY.md</code> in the app repo: <code>supabase link</code>, <code>db push</code>, <code>functions deploy</code>,
              secrets), then paste what the app needs to reach it.
            </Body>
            {saveState.error ? <Alert tone="error">{saveState.error}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-body-small font-medium">Project URL</span>
                <Input name="supabaseUrl" type="url" required placeholder="https://abcd.supabase.co" defaultValue={deployment?.supabaseUrl ?? ''} />
              </label>
              <label className="block space-y-1">
                <span className="text-body-small font-medium">Project ref (optional)</span>
                <Input name="supabaseProjectRef" placeholder="abcd" defaultValue={deployment?.supabaseProjectRef ?? ''} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-body-small font-medium">Anon / publishable key</span>
              <Input name="supabaseAnonKey" required placeholder="sb_publishable_…" defaultValue={deployment?.supabaseAnonKey ?? ''} />
            </label>
            <div className="flex justify-end gap-2">
              {editing ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save backend'}
              </Button>
            </div>
          </form>
        ) : null}

        {publishState.error ? <Alert tone="error">{publishState.error}</Alert> : null}
        {publishState.ok ? <Alert tone="success">Queued. The release builds with EAS, sends it to TestFlight and uploads the listing.</Alert> : null}

        <div className="flex flex-wrap gap-2">
          {canPublish && hasBackend && !publishState.ok ? (
            <form action={publishAction}>
              <input type="hidden" name="betId" value={betId} />
              <input type="hidden" name="deployTarget" value={deployment?.deployTarget ?? 'deferred'} />
              <Button type="submit" size="sm" disabled={publishing}>
                {publishing ? 'Queueing…' : lastBuild?.id ? 'Publish a new build' : 'Publish to App Store'}
              </Button>
            </form>
          ) : null}
          {deferred && hasBackend && !editing ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit backend
            </Button>
          ) : null}
        </div>
      </Stack>
    </Surface>
  );
}
