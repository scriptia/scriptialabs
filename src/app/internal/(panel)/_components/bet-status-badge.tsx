import { betPriorityLabels, betPriorityTones, betStatusLabels, betStatusTones, type BetPriority, type BetStatus } from '@/content/internal';
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
