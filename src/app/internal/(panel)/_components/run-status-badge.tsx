import { Badge } from '@/components/primitives';
import { pipelineRunKindLabels, pipelineRunStatusLabels, pipelineRunStatusTones, type PipelineRunKind, type PipelineRunStatus } from '@/content/internal';

// Mirrors bet-status-badge.tsx: labels and tones come from the content layer, so
// a new run status is a content entry rather than a component change.
export function RunStatusBadge({ status }: Readonly<{ status: PipelineRunStatus }>) {
  return <Badge tone={pipelineRunStatusTones[status]}>{pipelineRunStatusLabels[status]}</Badge>;
}

export function RunKindBadge({ kind }: Readonly<{ kind: PipelineRunKind }>) {
  return <Badge>{pipelineRunKindLabels[kind]}</Badge>;
}
