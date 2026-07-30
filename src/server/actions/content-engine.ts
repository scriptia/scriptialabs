'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/server/auth/guard';
import { createTrendSourceFromLink } from '@/server/content-engine';

export type TrendSourceFormState = { error?: string; fieldErrors?: Record<string, string> };

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
