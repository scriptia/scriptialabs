import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBearerToken } from '@/server/auth/api-token';
import { updateTrendSourceFormula } from '@/server/content-engine';
import { trendSourceFormulaBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

const idParamSchema = z.object({ id: z.uuid('Not a valid id.') });

// Ports PATCH /trend-sources/{id}/formula — plain overwrite, no versioning.
// See src/server/content-engine/trend-sources.ts for why this differs from
// KnowledgeEntry/IntegrationConfig's immutable-version pattern.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = trendSourceFormulaBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const trendSource = await updateTrendSourceFormula(idParsed.data.id, { extractedFormula: parsed.data.extracted_formula });

  if (!trendSource) {
    return NextResponse.json({ ok: false, error: `Trend source '${idParsed.data.id}' not found.` }, { status: 404 });
  }

  return NextResponse.json(trendSource);
}
