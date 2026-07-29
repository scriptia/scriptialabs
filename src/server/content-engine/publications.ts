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
