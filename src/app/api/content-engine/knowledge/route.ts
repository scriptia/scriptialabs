import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { createKnowledgeEntry, getKnowledgeEntries } from '@/server/content-engine';
import { createKnowledgeEntryBodySchema, knowledgeQuerySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = knowledgeQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  const entries = await getKnowledgeEntries({
    appId: parsed.data.app_id,
    relatedAngle: parsed.data.related_angle,
    relatedHookType: parsed.data.related_hook_type,
    includeInactive: parsed.data.include_inactive
  });

  return NextResponse.json(entries);
}

// Ports POST /knowledge — same immutable-version pattern as the rest of the
// system: if supersedes_id is given, the old row is flipped to
// is_active=false + supersededById, never updated in place. See
// src/server/content-engine/knowledge.ts for the two-step insert-then-flip
// order.
export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = createKnowledgeEntryBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const result = await createKnowledgeEntry({
    principle: parsed.data.principle,
    source: parsed.data.source,
    scopeAppId: parsed.data.scope_app_id,
    confidence: parsed.data.confidence,
    evidence: parsed.data.evidence,
    relatedAngle: parsed.data.related_angle,
    relatedHookType: parsed.data.related_hook_type,
    supersedesId: parsed.data.supersedes_id
  });

  if (result.kind === 'app_not_found') {
    return NextResponse.json({ ok: false, error: `App '${parsed.data.scope_app_id}' not found.` }, { status: 404 });
  }

  if (result.kind === 'supersedes_not_found') {
    return NextResponse.json({ ok: false, error: `Knowledge entry '${parsed.data.supersedes_id}' not found.` }, { status: 404 });
  }

  return NextResponse.json(result.entry, { status: 201 });
}
