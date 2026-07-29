import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { createTrendSourceFromLink } from '@/server/content-engine';
import { trendSourceFromLinkBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

// Ports POST /trend-sources/from-link — registers the link, platform and
// whatever raw metrics were pasted alongside it, with extractedFormula={}.
// Does NOT call Twelve Labs (no executor for that exists in this backend
// yet — see src/server/content-engine/trend-sources.ts): transcript and
// sceneBreakdown stay empty too. trend-analysis still has to obtain those
// itself before it has anything to reason over.
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

  const parsed = trendSourceFromLinkBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const trendSource = await createTrendSourceFromLink({
    appId: parsed.data.app_id,
    url: parsed.data.url,
    platform: parsed.data.platform,
    rawMetrics: parsed.data.raw_metrics
  });

  if (!trendSource) {
    return NextResponse.json({ ok: false, error: `App '${parsed.data.app_id}' not found.` }, { status: 404 });
  }

  return NextResponse.json(trendSource, { status: 201 });
}
