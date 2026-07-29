import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireBearerToken } from '@/server/auth/api-token';
import { createSocialMetric, getPublicationById } from '@/server/content-engine';
import { createSocialMetricBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

const idParamSchema = z.object({ id: z.uuid('Not a valid id.') });

// Ports POST /publications/{id}/social-metrics — always creates a new
// SocialMetric row, never updates an existing one. Calling this twice on the
// same Publication must produce two rows, not one row overwritten twice —
// that's what lets a trend line be built later.
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

  const publication = await getPublicationById(idParsed.data.id);

  if (!publication) {
    return NextResponse.json({ ok: false, error: `Publication '${idParsed.data.id}' not found.` }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = createSocialMetricBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const metric = await createSocialMetric(idParsed.data.id, {
    views: parsed.data.views,
    likes: parsed.data.likes,
    comments: parsed.data.comments,
    shares: parsed.data.shares,
    saves: parsed.data.saves,
    reach: parsed.data.reach,
    avgWatchTimeS: parsed.data.avg_watch_time_s
  });

  return NextResponse.json(metric, { status: 201 });
}
