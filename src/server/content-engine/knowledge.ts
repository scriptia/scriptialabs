import 'server-only';

import { and, desc, eq, isNull, or, type SQL } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { knowledgeEntries } from '@/server/db/schema';

export type KnowledgeEntryFilters = {
  appId?: string;
  relatedAngle?: string;
  relatedHookType?: string;
  // Ports GET /knowledge from the original Python API exactly: by default
  // only is_active=true; include_inactive=true also returns superseded rows
  // (is_active=false) so the dashboard can reconstruct a KnowledgeEntry's
  // version history by following superseded_by_id.
  includeInactive?: boolean;
};

// Global entries (scope_app_id null) always come back; app-specific ones only
// when appId is given — same rule as the original: no appId means global-only.
export async function getKnowledgeEntries(filters: KnowledgeEntryFilters = {}) {
  const conditions: SQL[] = [];

  if (!filters.includeInactive) {
    conditions.push(eq(knowledgeEntries.isActive, true));
  }

  if (filters.appId) {
    const scope = or(isNull(knowledgeEntries.scopeAppId), eq(knowledgeEntries.scopeAppId, filters.appId));

    if (scope) {
      conditions.push(scope);
    }
  } else {
    conditions.push(isNull(knowledgeEntries.scopeAppId));
  }

  if (filters.relatedAngle) {
    conditions.push(eq(knowledgeEntries.relatedAngle, filters.relatedAngle));
  }

  if (filters.relatedHookType) {
    conditions.push(eq(knowledgeEntries.relatedHookType, filters.relatedHookType));
  }

  return db
    .select()
    .from(knowledgeEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(knowledgeEntries.createdAt));
}
