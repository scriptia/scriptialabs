import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getKnowledgeEntries } from '@/server/content-engine';
import { knowledgeQuerySchema } from '@/server/validation/content-engine';

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
