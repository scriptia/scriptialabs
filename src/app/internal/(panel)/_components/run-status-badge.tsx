import { Badge } from '@/components/primitives';
import { pipelineRunKindLabels, pipelineRunStatusLabel, pipelineRunStatusTones, type PipelineRunKind, type PipelineRunStatus } from '@/content/internal';

// Mirrors bet-status-badge.tsx: labels and tones come from the content layer, so
// a new run status is a content entry rather than a component change.
// `sessionCount` turns a paused run's badge into "Paused ×N".
export function RunStatusBadge({ status, sessionCount = 0 }: Readonly<{ status: PipelineRunStatus; sessionCount?: number }>) {
  return <Badge tone={pipelineRunStatusTones[status]}>{pipelineRunStatusLabel(status, sessionCount)}</Badge>;
}

export function RunKindBadge({ kind }: Readonly<{ kind: PipelineRunKind }>) {
  return <Badge>{pipelineRunKindLabels[kind]}</Badge>;
}
