import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { createContentPiece, getAppById, getContentPieces, getTrendSourceById } from '@/server/content-engine';
import { contentPiecesQuerySchema, createContentPieceBodySchema } from '@/server/validation/content-engine';

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

// Ports POST /content-pieces — a Skill (scriptwriter) has already decided the
// angle/hook and written the full script; this persists it directly in
// status="scripted". No production happens here (see
// src/server/content-engine/production.ts).
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

  const parsed = createContentPieceBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const app = await getAppById(parsed.data.app_id);

  if (!app) {
    return NextResponse.json({ ok: false, error: `App '${parsed.data.app_id}' not found.` }, { status: 404 });
  }

  if (parsed.data.inspired_by_id) {
    const trendSource = await getTrendSourceById(parsed.data.inspired_by_id);

    if (!trendSource) {
      return NextResponse.json({ ok: false, error: `Trend source '${parsed.data.inspired_by_id}' not found.` }, { status: 404 });
    }
  }

  const piece = await createContentPiece({
    appId: parsed.data.app_id,
    contentType: parsed.data.content_type,
    angle: parsed.data.angle,
    hookText: parsed.data.hook_text,
    hookType: parsed.data.hook_type,
    script: parsed.data.script,
    inspiredById: parsed.data.inspired_by_id
  });

  return NextResponse.json(piece, { status: 201 });
}
