import 'server-only';

import { and, desc, eq, type SQL } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { galleryItems } from '@/server/db/schema';

export type GalleryItemFilters = {
  appId: string;
  assetType?: string;
};

export async function getGalleryItems(filters: GalleryItemFilters) {
  const conditions: SQL[] = [eq(galleryItems.appId, filters.appId)];

  if (filters.assetType) {
    conditions.push(eq(galleryItems.assetType, filters.assetType));
  }

  return db
    .select()
    .from(galleryItems)
    .where(and(...conditions))
    .orderBy(desc(galleryItems.createdAt));
}

export type GalleryItemSearchFilters = {
  appId: string;
  query: string;
  assetType?: string;
  limit?: number;
};

const DEFAULT_SEARCH_LIMIT = 5;
const MIN_KEYWORD_LENGTH = 2;

function keywordsFrom(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[.,!?¡¿()]/g, ''))
      .filter((word) => word.length > MIN_KEYWORD_LENGTH)
  );
}

// Ports GET /gallery/search exactly: intersection of keywords between `query`
// and description+tags (tags with "_" get split into words, so
// "frustracion_estancado" matches a query containing "frustracion"). No
// embeddings, no semantic search — this is the same "start simple, evolve if
// it starts giving false positives/negatives" call the original made.
export async function searchGalleryItems(filters: GalleryItemSearchFilters) {
  const keywords = keywordsFrom(filters.query);

  if (keywords.size === 0) {
    return [];
  }

  const conditions: SQL[] = [eq(galleryItems.appId, filters.appId)];

  if (filters.assetType) {
    conditions.push(eq(galleryItems.assetType, filters.assetType));
  }

  const items = await db
    .select()
    .from(galleryItems)
    .where(and(...conditions));

  const scored = items
    .map((item) => {
      const haystack = keywordsFrom(item.description);

      for (const tag of (item.tags as string[] | null) ?? []) {
        for (const word of keywordsFrom(tag.replace(/_/g, ' '))) {
          haystack.add(word);
        }
      }

      let score = 0;

      for (const keyword of keywords) {
        if (haystack.has(keyword)) {
          score += 1;
        }
      }

      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, filters.limit ?? DEFAULT_SEARCH_LIMIT).map((row) => row.item);
}
