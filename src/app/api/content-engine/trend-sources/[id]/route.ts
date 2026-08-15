import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getTrendSourceById } from '@/server/content-engine';
import { trendSourceIdParamSchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const parsed = trendSourceIdParamSchema.safeParse({ id });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues }, { status: 422 });
  }

  const source = await getTrendSourceById(parsed.data.id);

  if (!source) {
    return NextResponse.json({ ok: false, error: `Trend source '${parsed.data.id}' not found.` }, { status: 404 });
  }

  return NextResponse.json(source);
}
