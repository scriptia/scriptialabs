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

export type OnboardAppInput = {
  slug: string;
  name: string;
  niche: string;
  brand: Record<string, unknown>;
  product: Record<string, unknown>;
  audience: Record<string, unknown>;
  businessGoals: Record<string, unknown>;
};

// Ports POST /apps/onboard — called by BRAND-AGENT, a service on another
// team. Idempotent by slug: a re-onboard with updated brand/product/
// audience/business_goals updates the existing row instead of creating a
// duplicate, same as the original. The four top-level keys are validated to
// exist and be objects (see the zod schema); nothing inside them is —
// BRAND-AGENT's internal shape can evolve without this endpoint changing.
export async function onboardApp(input: OnboardAppInput) {
  const [existing] = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, input.slug)).limit(1);

  const values = {
    name: input.name,
    niche: input.niche,
    brandProfile: input.brand,
    productProfile: input.product,
    audienceProfile: input.audience,
    businessGoals: input.businessGoals
  };

  if (existing) {
    const [updated] = await db.update(apps).set(values).where(eq(apps.id, existing.id)).returning();

    return { app: updated, created: false };
  }

  const [created] = await db
    .insert(apps)
    .values({ slug: input.slug, ...values })
    .returning();

  return { app: created, created: true };
}
