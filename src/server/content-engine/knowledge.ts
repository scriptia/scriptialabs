import 'server-only';

import { and, desc, eq, isNull, or, type SQL } from 'drizzle-orm';

import type { KnowledgeSource } from '@/content/content-engine';
import { db } from '@/server/db/client';
import { apps, knowledgeEntries } from '@/server/db/schema';

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

export type CreateKnowledgeEntryInput = {
  principle: string;
  source: KnowledgeSource;
  scopeAppId?: string | null;
  confidence: number;
  evidence?: Record<string, unknown>;
  relatedAngle?: string | null;
  relatedHookType?: string | null;
  supersedesId?: string | null;
};

export type CreateKnowledgeEntryResult =
  | { kind: 'ok'; entry: typeof knowledgeEntries.$inferSelect }
  | { kind: 'app_not_found' }
  | { kind: 'supersedes_not_found' };

// Ports POST /knowledge — same immutable-version pattern as the rest of the
// system (IntegrationConfig, and TrendSource.extractedFormula being the one
// deliberate exception): this never UPDATEs an existing row in place. If
// `supersedesId` is given, the new row is inserted first (so it has an id to
// point at), then the old row is flipped to is_active=false with
// supersededById pointing at the new one — same two-step order the original
// Python endpoint used (flush before referencing the new id).
export async function createKnowledgeEntry(input: CreateKnowledgeEntryInput): Promise<CreateKnowledgeEntryResult> {
  if (input.scopeAppId) {
    const [app] = await db.select({ id: apps.id }).from(apps).where(eq(apps.id, input.scopeAppId)).limit(1);

    if (!app) {
      return { kind: 'app_not_found' };
    }
  }

  if (input.supersedesId) {
    const [previous] = await db.select({ id: knowledgeEntries.id }).from(knowledgeEntries).where(eq(knowledgeEntries.id, input.supersedesId)).limit(1);

    if (!previous) {
      return { kind: 'supersedes_not_found' };
    }
  }

  const [entry] = await db
    .insert(knowledgeEntries)
    .values({
      principle: input.principle,
      source: input.source,
      scopeAppId: input.scopeAppId ?? null,
      confidence: String(input.confidence),
      evidence: input.evidence ?? {},
      relatedAngle: input.relatedAngle ?? null,
      relatedHookType: input.relatedHookType ?? null,
      isActive: true
    })
    .returning();

  if (input.supersedesId) {
    await db.update(knowledgeEntries).set({ isActive: false, supersededById: entry.id }).where(eq(knowledgeEntries.id, input.supersedesId));
  }

  return { kind: 'ok', entry };
}
