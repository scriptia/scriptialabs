'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/server/auth/guard';
import { createAppRecord, createTrendSourceFromLink } from '@/server/content-engine';

export type TrendSourceFormState = { error?: string; fieldErrors?: Record<string, string> };
export type AppFormState = { error?: string; fieldErrors?: Record<string, string> };

// The panel authenticates via a session cookie (ADR-010), not the bearer
// token GET/POST /api/content-engine/* expects from Skills/BRAND-AGENT
// (ADR-012) — those are for processes outside this one. A Server Action
// calling src/server/content-engine/trend-sources.ts directly is the same
// process, so there's no HTTP hop, no bearer token, and no auth mismatch to
// reconcile: it's the exact pattern src/server/actions/bets.ts already uses
// for every bet mutation.
const trendSourceFormSchema = z.object({
  appId: z.uuid(),
  url: z.url(),
  platform: z.string().trim().min(1)
});

function toFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');

    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

export async function createTrendSourceFromLinkAction(_state: TrendSourceFormState, formData: FormData): Promise<TrendSourceFormState> {
  await requireUser();

  const parsed = trendSourceFormSchema.safeParse({
    appId: formData.get('appId'),
    url: formData.get('url'),
    platform: formData.get('platform')
  });

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const trendSource = await createTrendSourceFromLink({
    appId: parsed.data.appId,
    url: parsed.data.url,
    platform: parsed.data.platform
  });

  if (!trendSource) {
    return { error: 'App not found.' };
  }

  revalidatePath('/internal/content-engine/trends');

  return {};
}

// Parses one of the JSON-blob fields (brand/product/audience/businessGoals).
// Empty input defaults to {} rather than erroring — Marc filling in just
// slug/name/niche to spin up a test app is the common case, not the
// exception, while BRAND-AGENT's own onboard payload still requires all four
// keys to exist (that's a different consumer with a different contract).
const jsonObjectField = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (trimmed === '') {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Must be valid JSON.' });
    return z.NEVER;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    ctx.addIssue({ code: 'custom', message: 'Must be a JSON object, e.g. {"tone": "friendly"}.' });
    return z.NEVER;
  }

  return parsed as Record<string, unknown>;
});

const createAppFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only.'),
  name: z.string().trim().min(1),
  niche: z.string().trim().min(1),
  brand: jsonObjectField,
  product: jsonObjectField,
  audience: jsonObjectField,
  businessGoals: jsonObjectField
});

// Manual "New app" form on the dashboard — a plain create via
// createAppRecord(), NOT POST /apps/onboard. That route stays BRAND-AGENT's
// alone (its own bearer token, its own upsert-by-slug contract); this is the
// same-process Server Action pattern used throughout this section (see
// createTrendSourceFromLinkAction above) so Marc/the team can spin up test
// apps while BRAND-AGENT doesn't exist yet.
export async function createApp(_state: AppFormState, formData: FormData): Promise<AppFormState> {
  await requireUser();

  const parsed = createAppFormSchema.safeParse({
    slug: formData.get('slug'),
    name: formData.get('name'),
    niche: formData.get('niche'),
    brand: formData.get('brand') ?? '',
    product: formData.get('product') ?? '',
    audience: formData.get('audience') ?? '',
    businessGoals: formData.get('businessGoals') ?? ''
  });

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const result = await createAppRecord({
    slug: parsed.data.slug,
    name: parsed.data.name,
    niche: parsed.data.niche,
    brand: parsed.data.brand,
    product: parsed.data.product,
    audience: parsed.data.audience,
    businessGoals: parsed.data.businessGoals
  });

  if (result.kind === 'slug_taken') {
    return { error: 'That slug is already taken.', fieldErrors: { slug: 'Already in use by another app.' } };
  }

  revalidatePath('/internal/content-engine');
  redirect(`/internal/content-engine?app_id=${result.app.id}`);
}
