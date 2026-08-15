import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBearerToken } from '@/server/auth/api-token';
import { publishContentPiece } from '@/server/content-engine';
import { publishContentPieceBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

const idParamSchema = z.object({ id: z.uuid('Not a valid id.') });

// Ports POST /content-pieces/{id}/publish.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const idParsed = idParamSchema.safeParse({ id });

  if (!idParsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query parameters.', issues: idParsed.error.issues }, { status: 422 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = publishContentPieceBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const result = await publishContentPiece(idParsed.data.id, {
    platform: parsed.data.platform,
    permalink: parsed.data.permalink,
    externalPostId: parsed.data.external_post_id
  });

  if (!result) {
    return NextResponse.json({ ok: false, error: `Content piece '${idParsed.data.id}' not found.` }, { status: 404 });
  }

  return NextResponse.json(result, { status: 201 });
}
