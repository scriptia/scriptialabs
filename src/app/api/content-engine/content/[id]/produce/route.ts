import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBearerToken } from '@/server/auth/api-token';
import { getContentPieceById, produceContentPiece } from '@/server/content-engine';
import { produceBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

const idParamSchema = z.object({ id: z.uuid('Not a valid id.') });

// See src/server/content-engine/production.ts for the contract this
// endpoint accepts and why — in short: already-produced urls, never a
// generation prompt. This route only validates that what was handed over
// matches the piece's own script (right shape, right slide count) before
// delegating to that function.
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

  const piece = await getContentPieceById(idParsed.data.id);

  if (!piece) {
    return NextResponse.json({ ok: false, error: `Content piece '${idParsed.data.id}' not found.` }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = produceBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  if (piece.contentType === 'carousel') {
    if (!parsed.data.slide_assets) {
      return NextResponse.json({ ok: false, error: "slide_assets is required for content_type='carousel'." }, { status: 400 });
    }

    const script = piece.script as { slides?: Array<{ order: number }> } | null;
    const expectedOrders = new Set((script?.slides ?? []).map((slide) => slide.order));
    const gotOrders = new Set(parsed.data.slide_assets.map((asset) => asset.order_index));

    const expectedSorted = [...expectedOrders].sort((a, b) => a - b);
    const gotSorted = [...gotOrders].sort((a, b) => a - b);

    if (expectedSorted.length !== gotSorted.length || expectedSorted.some((value, index) => value !== gotSorted[index])) {
      return NextResponse.json(
        {
          ok: false,
          error: `slide_assets must cover exactly the script's slide orders — expected ${JSON.stringify(expectedSorted)}, got ${JSON.stringify(gotSorted)}.`
        },
        { status: 400 }
      );
    }

    const result = await produceContentPiece(idParsed.data.id, {
      kind: 'carousel',
      slideAssets: parsed.data.slide_assets.map((asset) => ({
        orderIndex: asset.order_index,
        url: asset.url,
        productionMethod: asset.production_method,
        generationProvider: asset.generation_provider,
        generationCostUsd: asset.generation_cost_usd
      }))
    });

    return NextResponse.json(result);
  }

  if (!parsed.data.asset) {
    return NextResponse.json({ ok: false, error: "asset is required for content_type='reel'/'short'." }, { status: 400 });
  }

  const result = await produceContentPiece(idParsed.data.id, {
    kind: 'video',
    asset: {
      url: parsed.data.asset.url,
      productionMethod: parsed.data.asset.production_method,
      generationProvider: parsed.data.asset.generation_provider,
      generationCostUsd: parsed.data.asset.generation_cost_usd
    }
  });

  return NextResponse.json(result);
}
