import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getAppById, getContentPieces } from '@/server/content-engine';
import { contentPiecesQuerySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const parsed = contentPiecesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  const app = await getAppById(parsed.data.app_id);

  if (!app) {
    return NextResponse.json({ ok: false, error: `App '${parsed.data.app_id}' not found.` }, { status: 404 });
  }

  const pieces = await getContentPieces({ appId: parsed.data.app_id, days: parsed.data.days, limit: parsed.data.limit });

  return NextResponse.json(pieces);
}
