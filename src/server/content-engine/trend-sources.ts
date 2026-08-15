import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { apps, trendSources } from '@/server/db/schema';

export type TrendSourceFilters = {
  niche?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 15;

export async function getTrendSources(filters: TrendSourceFilters = {}) {
  const query = db.select().from(trendSources);

  return (filters.niche ? query.where(eq(trendSources.niche, filters.niche)) : query)
    .orderBy(desc(trendSources.analyzedAt))
    .limit(filters.limit ?? DEFAULT_LIMIT);
}

export async function getTrendSourceById(id: string) {
  const [row] = await db.select().from(trendSources).where(eq(trendSources.id, id)).limit(1);

  return row ?? null;
}

export type CreateTrendSourceFromLinkInput = {
  appId: string;
  url: string;
  platform: string;
  rawMetrics?: Record<string, unknown>;
};

// Ports POST /trend-sources/from-link — but NOT the Twelve Labs ingestion the
// original TrendScoutAgent.process_video() did. This backend has no Twelve
// Labs executor: it only registers the link, its platform, and whatever raw
// metrics were pasted alongside it, with `transcript`/`sceneBreakdown`/
// `extractedFormula` left empty. The trend-analysis Skill still has to
// obtain the transcript/scene breakdown itself (calling Twelve Labs directly,
// same shape as the produce/Kling/Shotstack gap) before it has anything to
// reason over and persist via PATCH .../formula.
export async function createTrendSourceFromLink(input: CreateTrendSourceFromLinkInput) {
  const [app] = await db.select({ niche: apps.niche }).from(apps).where(eq(apps.id, input.appId)).limit(1);

  if (!app) {
    return null;
  }

  const [row] = await db
    .insert(trendSources)
    .values({
      platform: input.platform,
      niche: app.niche,
      sourceUrl: input.url,
      rawMetrics: input.rawMetrics ?? {},
      extractedFormula: {}
    })
    .returning();

  return row;
}

export type UpdateTrendSourceFormulaInput = {
  extractedFormula: Record<string, unknown>;
};

// Unlike KnowledgeEntry/IntegrationConfig, TrendSource.extractedFormula is a
// plain overwrite — there is no is_active/supersededById chain here. A
// TrendSource is the analysis of one specific video; refining that analysis
// corrects the same record, it does not create a new "version" of a
// different past belief the way a KnowledgeEntry does.
export async function updateTrendSourceFormula(id: string, input: UpdateTrendSourceFormulaInput) {
  const [row] = await db.update(trendSources).set({ extractedFormula: input.extractedFormula }).where(eq(trendSources.id, id)).returning();

  return row ?? null;
}
