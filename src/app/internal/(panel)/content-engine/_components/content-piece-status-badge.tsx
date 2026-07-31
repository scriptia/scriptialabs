import { contentPieceStatusLabels, contentPieceStatusTones, type ContentPieceStatus } from '@/content/content-engine';
import { Badge } from '@/components/primitives';

// Mirrors bets/_components/bet-status-badge.tsx — same reasoning: a
// dedicated small component per status union rather than a generic one, since
// ContentPieceStatus and BetStatus are unrelated lifecycles (ADR-010).
export function ContentPieceStatusBadge({ status }: Readonly<{ status: ContentPieceStatus }>) {
  return <Badge tone={contentPieceStatusTones[status]}>{contentPieceStatusLabels[status]}</Badge>;
}
