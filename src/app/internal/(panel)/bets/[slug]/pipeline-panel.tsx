import Link from 'next/link';

import { Alert } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { isActivePipelineRunStatus, pipelineRunKindLabels, type BetStatus } from '@/content/internal';
import type { PipelineRunListRow } from '@/server/queries/pipeline-runs';

import { formatRelative } from '../../_components/format';
import { RunStatusBadge } from '../../_components/run-status-badge';
import { BuildButton, type BuildSummary } from './build-button';
import { CancelRunButton } from './cancel-run-button';
import { RunProductAgentForm } from './run-product-agent-form';

// The bet's control surface: what can be triggered from here, and what is
// already in flight. Driven by the bet's status so the panel never offers an
// action the server would refuse — the action re-checks anyway, but a button
// that always errors is worse than no button.
export function PipelinePanel({
  betId,
  betSlug,
  betStatus,
  runs,
  buildSummary
}: Readonly<{ betId: string; betSlug: string; betStatus: BetStatus; runs: PipelineRunListRow[]; buildSummary: BuildSummary | null }>) {
  const active = runs.find((run) => isActivePipelineRunStatus(run.status));

  return (
    <Stack gap="lg">
      {active ? <ActiveRun run={active} /> : <Trigger betId={betId} betStatus={betStatus} buildSummary={buildSummary} />}
      <History runs={runs} betSlug={betSlug} />
    </Stack>
  );
}

function ActiveRun({ run }: Readonly<{ run: PipelineRunListRow }>) {
  const progress = run.progress as { stage?: string; stageIndex?: number; stageCount?: number };
  const stage = progress?.stage;
  const position = progress?.stageIndex !== undefined && progress?.stageCount ? ` (${progress.stageIndex + 1}/${progress.stageCount})` : '';

  return (
    <Surface className="p-5">
      <Stack gap="sm">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level={3}>{pipelineRunKindLabels[run.kind]} run in flight</Heading>
          <RunStatusBadge status={run.status} />
        </div>
        <Body size="small">
          {run.status === 'queued'
            ? 'Waiting for a runner to claim it. Start one with `python orchestrator/runner.py` in product-agent.'
            : `${stage ? `Stage: ${stage}${position}` : 'Claimed, no stage reported yet'} · last heartbeat ${run.heartbeatAt ? formatRelative(run.heartbeatAt) : 'never'}`}
        </Body>
        {run.cancelRequestedAt ? <Alert tone="warning">Stop requested. The runner halts at the next stage boundary.</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/internal/runs/${run.id}`}>Open run</Link>
          </Button>
          {run.cancelRequestedAt ? null : <CancelRunButton runId={run.id} />}
        </div>
      </Stack>
    </Surface>
  );
}

function Trigger({ betId, betStatus, buildSummary }: Readonly<{ betId: string; betStatus: BetStatus; buildSummary: BuildSummary | null }>) {
  if (betStatus === 'backlog' || betStatus === 'killed') {
    return (
      <Surface className="p-5">
        <Stack gap="md">
          <Heading level={3}>Run the product agent</Heading>
          <Body size="small">
            Turns this bet&apos;s Bet Case into a name, identity, feature specs, legal documents and a store package, then publishes them. The bet stays in Backlog while the run
            works — follow it here or in Runs — and moves to Ready once a product page is live.
          </Body>
          <RunProductAgentForm betId={betId} />
        </Stack>
      </Surface>
    );
  }

  if (betStatus === 'ready') {
    return (
      <Surface className="p-5">
        <Stack gap="md">
          <Heading level={3}>Build</Heading>
          {buildSummary ? (
            <>
              <Body size="small">Hands every artifact the product agent produced to the builder. The bet moves to Building and stops there until you move it on.</Body>
              <BuildButton betId={betId} summary={buildSummary} />
            </>
          ) : (
            <Alert tone="warning">
              This bet is Ready but has no published product. That is usually a run that succeeded without publishing — check its run history below before building.
            </Alert>
          )}
        </Stack>
      </Surface>
    );
  }

  if (betStatus === 'building') {
    return (
      <Surface className="p-5">
        <Stack gap="sm">
          <Heading level={3}>Building</Heading>
          <Body size="small">
            The pipeline stops here on purpose. Move this bet to In Review or Deployed yourself when the build is done — nothing automated will do it for you.
          </Body>
        </Stack>
      </Surface>
    );
  }

  return (
    <Surface className="p-5">
      <Stack gap="sm">
        <Heading level={3}>No pipeline action available</Heading>
        <Body size="small">
          A product-agent run starts from Backlog; a build starts from Ready. This bet is {betStatus}.
        </Body>
      </Stack>
    </Surface>
  );
}

function History({ runs, betSlug }: Readonly<{ runs: PipelineRunListRow[]; betSlug: string }>) {
  if (runs.length === 0) {
    return (
      <Body size="small" className="text-text-tertiary">
        No runs yet for /{betSlug}.
      </Body>
    );
  }

  return (
    <Stack gap="sm">
      <Heading level={3}>Run history</Heading>
      <Stack gap="xs">
        {runs.map((run) => (
          <Link
            key={run.id}
            href={`/internal/runs/${run.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface-subtle"
          >
            <span className="flex items-center gap-2">
              <RunStatusBadge status={run.status} />
              <span className="text-body-small text-text-primary">{pipelineRunKindLabels[run.kind]}</span>
              {run.externalRunId ? <span className="text-caption text-text-tertiary">{run.externalRunId}</span> : null}
            </span>
            <span className="text-caption text-text-tertiary">
              {run.requestedByName ? `${run.requestedByName} · ` : ''}
              {formatRelative(run.queuedAt)}
            </span>
          </Link>
        ))}
      </Stack>
    </Stack>
  );
}
