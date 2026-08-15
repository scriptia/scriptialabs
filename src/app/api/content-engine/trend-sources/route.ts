import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getTrendSources } from '@/server/content-engine';
import { trendSourcesQuerySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = trendSourcesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  const sources = await getTrendSources(parsed.data);

  return NextResponse.json(sources);
}
