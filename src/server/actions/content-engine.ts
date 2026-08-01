'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { knowledgeSources } from '@/content/content-engine';
import { requireUser } from '@/server/auth/guard';
import {
  createAppRecord,
  createKnowledgeEntry as createKnowledgeEntryRecord,
  createTrendSourceFromLink,
  discardContentPiece,
  publishContentPiece
} from '@/server/content-engine';

export type TrendSourceFormState = { error?: string; fieldErrors?: Record<string, string> };
export type AppFormState = { error?: string; fieldErrors?: Record<string, string> };
export type KnowledgeEntryFormState = { error?: string; fieldErrors?: Record<string, string> };
export type MarkPublishedFormState = { error?: string; fieldErrors?: Record<string, string> };

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

// Global entries only in this iteration (scope_app_id always null) — no field
// for it in the form yet, on purpose. Same field shape backs both
// createKnowledgeEntry and supersedeKnowledgeEntry below, so it's shared here
// rather than duplicated.
const knowledgeEntryFormSchema = z.object({
  principle: z.string().trim().min(1),
  source: z.enum(knowledgeSources, 'Pick research or observed.'),
  confidence: z.coerce.number('Must be a number.').min(0, 'Must be between 0 and 1.').max(1, 'Must be between 0 and 1.'),
  relatedAngle: z.string().trim().optional(),
  relatedHookType: z.string().trim().optional(),
  evidence: jsonObjectField
});

async function submitKnowledgeEntry(formData: FormData, supersedesId: string | null): Promise<KnowledgeEntryFormState> {
  await requireUser();

  const parsed = knowledgeEntryFormSchema.safeParse({
    principle: formData.get('principle'),
    source: formData.get('source'),
    confidence: formData.get('confidence'),
    relatedAngle: formData.get('relatedAngle') ?? '',
    relatedHookType: formData.get('relatedHookType') ?? '',
    evidence: formData.get('evidence') ?? ''
  });

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const result = await createKnowledgeEntryRecord({
    principle: parsed.data.principle,
    source: parsed.data.source,
    scopeAppId: null,
    confidence: parsed.data.confidence,
    evidence: parsed.data.evidence,
    relatedAngle: parsed.data.relatedAngle || null,
    relatedHookType: parsed.data.relatedHookType || null,
    supersedesId: supersedesId ?? undefined
  });

  if (result.kind === 'supersedes_not_found') {
    return { error: 'The entry being superseded no longer exists — it may already have been superseded by someone else.' };
  }

  if (result.kind === 'app_not_found') {
    // Unreachable while scopeAppId is hardcoded to null above, but the shared
    // result type still has this branch — narrow it out rather than let it
    // fall through silently.
    return { error: 'Unexpected error.' };
  }

  revalidatePath('/internal/content-engine/knowledge');
  redirect('/internal/content-engine/knowledge');
}

// Manual "New entry" form on the dashboard — always creates a fresh,
// is_active=true KnowledgeEntry. No app scoping yet (see schema note above).
export async function createKnowledgeEntry(_state: KnowledgeEntryFormState, formData: FormData): Promise<KnowledgeEntryFormState> {
  return submitKnowledgeEntry(formData, null);
}

// "Supersede" on an existing entry's card — never edits previousId in place.
// It inserts a brand-new KnowledgeEntry and, in the same call to
// createKnowledgeEntryRecord(), flips previousId to is_active=false with
// supersededById pointing at the new row (see src/server/content-engine/knowledge.ts
// for why that isn't a real DB transaction — neon-http doesn't support one —
// and what it does instead to avoid leaving an orphaned row).
//
// Bound via `.bind(null, previousId)` at the call site so it can still be
// used with useActionState, which only supplies (state, formData).
export async function supersedeKnowledgeEntry(previousId: string, _state: KnowledgeEntryFormState, formData: FormData): Promise<KnowledgeEntryFormState> {
  return submitKnowledgeEntry(formData, previousId);
}

const markPublishedFormSchema = z.object({
  contentPieceId: z.uuid(),
  platform: z.string().trim().min(1),
  permalink: z.union([z.url('Must be a valid URL.'), z.literal('')]).optional()
});

// Inline "mark as published" form on a Review card — same effect as
// POST /content-pieces/:id/publish (creates the Publication, flips the piece
// to status="published"), called directly rather than over HTTP, same
// reasoning as every other Server Action in this file.
export async function markPublished(_state: MarkPublishedFormState, formData: FormData): Promise<MarkPublishedFormState> {
  await requireUser();

  const parsed = markPublishedFormSchema.safeParse({
    contentPieceId: formData.get('contentPieceId'),
    platform: formData.get('platform'),
    permalink: formData.get('permalink') ?? ''
  });

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const result = await publishContentPiece(parsed.data.contentPieceId, {
    platform: parsed.data.platform,
    permalink: parsed.data.permalink || null
  });

  if (!result) {
    return { error: 'Content piece not found.' };
  }

  revalidatePath('/internal/content-engine/review');
  revalidatePath('/internal/content-engine/publications');
  revalidatePath('/internal/content-engine');

  return {};
}

// Direct button, no form fields to fill in — same shape as deleteBetLink in
// src/server/actions/bet-details.ts: a plain <form action={markDiscarded}>
// with just a hidden contentPieceId input.
export async function markDiscarded(formData: FormData): Promise<void> {
  await requireUser();

  const contentPieceId = String(formData.get('contentPieceId') ?? '');

  if (!contentPieceId) {
    return;
  }

  await discardContentPiece(contentPieceId);

  revalidatePath('/internal/content-engine/review');
  revalidatePath('/internal/content-engine');
}
