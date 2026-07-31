import {
  betPriorityLabels,
  betPriorityTones,
  betStatusLabels,
  betStatusTones,
  taskKindLabels,
  taskKindTones,
  type BetPriority,
  type BetStatus,
  type TaskKind
} from '@/content/internal';
import { Badge } from '@/components/primitives';

// Deliberately mirrors components/data/product-status-badge.tsx rather than
// extending it: that badge is typed to the public ProductStatus union and the
// two lifecycles are not the same set of values (ADR-010).
export function BetStatusBadge({ status }: Readonly<{ status: BetStatus }>) {
  return <Badge tone={betStatusTones[status]}>{betStatusLabels[status]}</Badge>;
}

export function BetPriorityBadge({ priority }: Readonly<{ priority: BetPriority }>) {
  return <Badge tone={betPriorityTones[priority]}>{betPriorityLabels[priority]}</Badge>;
}

// Only rendered for non-general kinds by callers — a badge on every plain
// to-do would just be visual noise on the calendar and task lists.
export function TaskKindBadge({ kind }: Readonly<{ kind: TaskKind }>) {
  return <Badge tone={taskKindTones[kind]}>{taskKindLabels[kind]}</Badge>;
}
