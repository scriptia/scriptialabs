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
