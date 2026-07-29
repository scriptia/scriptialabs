import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { apps } from '@/server/db/schema';

export async function getApps() {
  return db.select().from(apps).orderBy(asc(apps.name));
}

export async function getAppById(id: string) {
  const [row] = await db.select().from(apps).where(eq(apps.id, id)).limit(1);

  return row ?? null;
}
