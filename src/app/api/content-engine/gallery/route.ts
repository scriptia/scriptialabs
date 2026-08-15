import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getGalleryItems } from '@/server/content-engine';
import { galleryQuerySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = galleryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  const items = await getGalleryItems({ appId: parsed.data.app_id, assetType: parsed.data.asset_type });

  return NextResponse.json(items);
}
