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

export type CreateAppInput = {
  slug: string;
  name: string;
  niche: string;
  brand?: Record<string, unknown>;
  product?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  businessGoals?: Record<string, unknown>;
};

export type CreateAppResult = { kind: 'ok'; app: typeof apps.$inferSelect } | { kind: 'slug_taken' };

// Backs the dashboard's "New app" form — a plain create, deliberately NOT
// onboardApp's upsert-by-slug behavior. BRAND-AGENT is expected to call
// onboard repeatedly as it refines the same app's profile, so silently
// updating on a slug match is correct there. Here a human is typing the slug
// by hand; reusing an existing one by typo should surface as a clear error,
// never quietly overwrite someone else's app.
export async function createAppRecord(input: CreateAppInput): Promise<CreateAppResult> {
  const [existing] = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, input.slug)).limit(1);

  if (existing) {
    return { kind: 'slug_taken' };
  }

  const [app] = await db
    .insert(apps)
    .values({
      slug: input.slug,
      name: input.name,
      niche: input.niche,
      brandProfile: input.brand ?? {},
      productProfile: input.product ?? {},
      audienceProfile: input.audience ?? {},
      businessGoals: input.businessGoals ?? {}
    })
    .returning();

  return { kind: 'ok', app };
}
