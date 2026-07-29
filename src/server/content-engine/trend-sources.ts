import 'server-only';

import { desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { trendSources } from '@/server/db/schema';

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
