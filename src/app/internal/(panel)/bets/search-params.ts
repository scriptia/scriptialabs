import { isBetAudience, isBetStatus } from '@/content/internal';
import type { BetFilters } from '@/server/queries/bets';

export type BetSearchParams = {
  status?: string;
  audience?: string;
  owner?: string;
  q?: string;
  archived?: string;
};

// Search params are user-editable, so every value is validated against the
// content-layer unions before it reaches a query. Anything unrecognised is
// dropped rather than erroring — a mistyped URL should still render a page.
export function toBetFilters(params: BetSearchParams): BetFilters {
  return {
    status: params.status && isBetStatus(params.status) ? params.status : undefined,
    audience: params.audience && isBetAudience(params.audience) ? params.audience : undefined,
    ownerId: params.owner || undefined,
    q: params.q?.trim() || undefined,
    includeArchived: params.archived === '1'
  };
}
