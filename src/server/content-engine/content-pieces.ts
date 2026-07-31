import 'server-only';

import { and, desc, eq, gte, sql } from 'drizzle-orm';

import type { ContentPieceStatus, ContentType } from '@/content/content-engine';
import { db } from '@/server/db/client';
import { contentPieces, publications, socialMetrics } from '@/server/db/schema';

export type ContentPieceFilters = {
  appId: string;
  days?: number;
  limit?: number;
  // Added for the /content-engine/library page — not part of the public
  // GET /content-pieces contract (its route/zod schema don't accept these),
  // so existing external callers (strategist) are unaffected.
  offset?: number;
  status?: ContentPieceStatus;
};

const DEFAULT_DAYS = 14;
const DEFAULT_LIMIT = 50;

export async function getContentPieceById(id: string) {
  const [row] = await db.select().from(contentPieces).where(eq(contentPieces.id, id)).limit(1);

  return row ?? null;
}

// Lists ContentPiece of ANY status from the last `days` days — ports
// GET /content-pieces from the original API exactly. This exists separately
// from a "review queue"-style query (which only returns one status) because
// strategist needs to see recently-used angle/hook_type regardless of where
// each piece is in its lifecycle, to avoid proposing the same one twice.
// The same function backs the library page's browse-everything view, via
// `status` + `offset` + a very large `days` (see that page for why).
export async function getContentPieces(filters: ContentPieceFilters) {
  const days = filters.days ?? DEFAULT_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const conditions = [eq(contentPieces.appId, filters.appId), gte(contentPieces.createdAt, cutoff)];

  if (filters.status) {
    conditions.push(eq(contentPieces.status, filters.status));
  }

  return db
    .select()
    .from(contentPieces)
    .where(and(...conditions))
    .orderBy(desc(contentPieces.createdAt))
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);
}

export type CreateContentPieceInput = {
  appId: string;
  contentType: ContentType;
  angle?: string | null;
  hookText?: string | null;
  hookType?: string | null;
  script?: unknown;
  inspiredById?: string | null;
};

// Ports POST /content-pieces: a Skill (scriptwriter) has already decided and
// written the full script — this always creates directly in status="scripted",
// never "proposed". generatedBy is never client-supplied, same as the
// original (it always stamped {"source": "skill"} itself).
export async function createContentPiece(input: CreateContentPieceInput) {
  const [row] = await db
    .insert(contentPieces)
    .values({
      appId: input.appId,
      contentType: input.contentType,
      status: 'scripted',
      angle: input.angle ?? null,
      hookText: input.hookText ?? null,
      hookType: input.hookType ?? null,
      script: input.script ?? {},
      generatedBy: { source: 'skill' },
      inspiredById: input.inspiredById ?? null
    })
    .returning();

  return row;
}

export type PublishContentPieceInput = {
  platform: string;
  permalink?: string | null;
  externalPostId?: string | null;
};

// Ports POST /content-pieces/{id}/publish — whoever actually published the
// piece (Marc manually today, a future Skill via Postiz tomorrow) calls this
// to register it really went out: creates the Publication and flips
// ContentPiece.status to "published". `externalPostId` is only ever set when
// publishing went through Postiz — feedback-collection uses its presence to
// pick its metrics source (Postiz analytics vs. yt-dlp/scraping).
export async function publishContentPiece(contentPieceId: string, input: PublishContentPieceInput) {
  const [piece] = await db.select().from(contentPieces).where(eq(contentPieces.id, contentPieceId)).limit(1);

  if (!piece) {
    return null;
  }

  const [publication] = await db
    .insert(publications)
    .values({
      contentPieceId,
      platform: input.platform,
      permalink: input.permalink ?? null,
      externalPostId: input.externalPostId ?? null,
      postedAt: new Date()
    })
    .returning();

  const [updatedPiece] = await db.update(contentPieces).set({ status: 'published' }).where(eq(contentPieces.id, contentPieceId)).returning();

  return { contentPiece: updatedPiece, publication };
}

export type ReviewQueueFilters = {
  appId?: string;
};

const READY_FOR_REVIEW: ContentPieceStatus = 'ready_for_review';

// Ports GET /content/review-queue — pieces a human needs to approve/reject,
// with their produced assets included (same as the original's selectinload,
// here via Drizzle's relational query API).
export async function getReviewQueue(filters: ReviewQueueFilters = {}) {
  return db.query.contentPieces.findMany({
    where: filters.appId ? and(eq(contentPieces.status, READY_FOR_REVIEW), eq(contentPieces.appId, filters.appId)) : eq(contentPieces.status, READY_FOR_REVIEW),
    with: { assets: true },
    orderBy: desc(contentPieces.createdAt)
  });
}

export type PerformanceSummaryFilters = {
  appId: string;
  days?: number;
};

const METRIC_KEYS = ['views', 'likes', 'comments', 'shares', 'saves'] as const;

type PerformanceRow = {
  angle: string | null;
  hookType: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
};

type MetricBucket = {
  pieceCount: number;
  metrics: Record<(typeof METRIC_KEYS)[number], { avg: number | null; avgPerReach: number | null }>;
};

// avgPerReach only makes sense over rows that actually recorded reach > 0 —
// there is no per-App "followers" count to normalize by otherwise, same
// caveat the original API returned in its `note` field.
function summarizeBucket(rows: PerformanceRow[]): MetricBucket {
  const reachRows = rows.filter((row) => row.reach > 0);
  const metrics = {} as MetricBucket['metrics'];

  for (const key of METRIC_KEYS) {
    const values = rows.map((row) => row[key]);
    const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    let avgPerReach: number | null = null;

    if (reachRows.length > 0) {
      const ratios = reachRows.map((row) => row[key] / row.reach);
      avgPerReach = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    }

    metrics[key] = { avg, avgPerReach };
  }

  return { pieceCount: rows.length, metrics };
}

// Ports GET /content-pieces/performance-summary. Aggregates
// ContentPiece -> Publication -> SocialMetric (most recent snapshot per
// Publication within the period), grouped by angle and by hook_type — final
// grouping and averaging happens in application code (not SQL GROUP BY)
// because avgPerReach needs a conditional average over a subset of rows,
// same as the original.
export async function getPerformanceSummary(filters: PerformanceSummaryFilters) {
  const days = filters.days ?? DEFAULT_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const latestPerPublication = db.$with('latest_per_publication').as(
    db
      .select({
        publicationId: socialMetrics.publicationId,
        latestCapturedAt: sql<Date>`max(${socialMetrics.capturedAt})`.as('latest_captured_at')
      })
      .from(socialMetrics)
      .where(gte(socialMetrics.capturedAt, cutoff))
      .groupBy(socialMetrics.publicationId)
  );

  const rows: PerformanceRow[] = await db
    .with(latestPerPublication)
    .select({
      angle: contentPieces.angle,
      hookType: contentPieces.hookType,
      views: socialMetrics.views,
      likes: socialMetrics.likes,
      comments: socialMetrics.comments,
      shares: socialMetrics.shares,
      saves: socialMetrics.saves,
      reach: socialMetrics.reach
    })
    .from(contentPieces)
    .innerJoin(publications, eq(publications.contentPieceId, contentPieces.id))
    .innerJoin(latestPerPublication, eq(latestPerPublication.publicationId, publications.id))
    .innerJoin(socialMetrics, and(eq(socialMetrics.publicationId, latestPerPublication.publicationId), eq(socialMetrics.capturedAt, latestPerPublication.latestCapturedAt)))
    .where(eq(contentPieces.appId, filters.appId));

  const byAngle = new Map<string, PerformanceRow[]>();
  const byHookType = new Map<string, PerformanceRow[]>();

  for (const row of rows) {
    const angleKey = row.angle ?? '(no angle)';
    const hookKey = row.hookType ?? '(no hook_type)';

    byAngle.set(angleKey, [...(byAngle.get(angleKey) ?? []), row]);
    byHookType.set(hookKey, [...(byHookType.get(hookKey) ?? []), row]);
  }

  return {
    appId: filters.appId,
    periodDays: days,
    note: 'avgPerReach is only computed over publications with reach > 0 recorded — there is no per-app "followers" count to normalize by otherwise. Where no row in the group has reach > 0, avgPerReach is null and only the absolute avg applies.',
    byAngle: Object.fromEntries([...byAngle.entries()].map(([key, group]) => [key, summarizeBucket(group)])),
    byHookType: Object.fromEntries([...byHookType.entries()].map(([key, group]) => [key, summarizeBucket(group)]))
  };
}
