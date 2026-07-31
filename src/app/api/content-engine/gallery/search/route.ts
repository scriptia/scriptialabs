import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { searchGalleryItems } from '@/server/content-engine';
import { gallerySearchQuerySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = gallerySearchQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  // No keyword overlap with the query is a valid, empty result — not an
  // error. searchGalleryItems returns [] itself when `query` yields no
  // usable keywords (e.g. all-punctuation input).
  const results = await searchGalleryItems({
    appId: parsed.data.app_id,
    query: parsed.data.query,
    assetType: parsed.data.asset_type,
    limit: parsed.data.limit
  });

  return NextResponse.json(results);
}
