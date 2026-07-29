import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { contentPieces, publications, socialMetrics } from '@/server/db/schema';

export type StalePublicationFilters = {
  appId: string;
  staleHours?: number;
};

const DEFAULT_STALE_HOURS = 24;

// Ports GET /publications?stale_hours=. A Publication needs a fresh metric
// snapshot when it has none yet, or its latest one is older than
// `staleHours` — this is what feedback-collection loops over each run.
// `hasExternalPostId` tells the caller whether it can use the Postiz
// analytics path or has to fall back to yt-dlp/scraping.
export async function getStalePublications(filters: StalePublicationFilters) {
  const staleHours = filters.staleHours ?? DEFAULT_STALE_HOURS;
  const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);

  const latestPerPublication = db.$with('latest_metric_per_publication').as(
    db
      .select({
        publicationId: socialMetrics.publicationId,
        latestCapturedAt: sql<Date>`max(${socialMetrics.capturedAt})`.as('latest_captured_at')
      })
      .from(socialMetrics)
      .groupBy(socialMetrics.publicationId)
  );

  const rows = await db
    .with(latestPerPublication)
    .select({
      id: publications.id,
      contentPieceId: publications.contentPieceId,
      platform: publications.platform,
      externalPostId: publications.externalPostId,
      permalink: publications.permalink,
      postedAt: publications.postedAt,
      latestCapturedAt: latestPerPublication.latestCapturedAt
    })
    .from(publications)
    .innerJoin(contentPieces, eq(contentPieces.id, publications.contentPieceId))
    .leftJoin(latestPerPublication, eq(latestPerPublication.publicationId, publications.id))
    .where(eq(contentPieces.appId, filters.appId));

  return rows
    .filter((row) => row.latestCapturedAt === null || row.latestCapturedAt < staleThreshold)
    .map((row) => ({
      id: row.id,
      contentPieceId: row.contentPieceId,
      platform: row.platform,
      externalPostId: row.externalPostId,
      permalink: row.permalink,
      postedAt: row.postedAt,
      hasExternalPostId: row.externalPostId !== null,
      lastCapturedAt: row.latestCapturedAt
    }));
}

export async function getPublicationById(id: string) {
  const [row] = await db.select().from(publications).where(eq(publications.id, id)).limit(1);

  return row ?? null;
}

export type CreateSocialMetricInput = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  reach?: number;
  avgWatchTimeS?: number | null;
};

// Ports POST /publications/{id}/social-metrics — always an INSERT, never an
// UPDATE. feedback-collection is expected to call this repeatedly on the
// same Publication as days pass; each call is a new snapshot at
// capturedAt=now(), so a trend line can be built from consecutive rows
// rather than one row silently overwriting the last. Fields the source
// (yt-dlp, scraping, Postiz) couldn't provide are simply omitted — they fall
// back to the column default (0 for counts), never a fabricated value.
export async function createSocialMetric(publicationId: string, input: CreateSocialMetricInput) {
  const [row] = await db
    .insert(socialMetrics)
    .values({
      publicationId,
      views: input.views,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      saves: input.saves,
      reach: input.reach,
      avgWatchTimeS: input.avgWatchTimeS != null ? String(input.avgWatchTimeS) : null
    })
    .returning();

  return row;
}
