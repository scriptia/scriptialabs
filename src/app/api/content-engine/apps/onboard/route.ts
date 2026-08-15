import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { onboardApp } from '@/server/content-engine';
import { onboardAppBodySchema } from '@/server/validation/content-engine';

export const runtime = 'nodejs';

// Ports POST /apps/onboard — a different bearer token (BRAND_AGENT_API_TOKEN,
// never CONTENT_ENGINE_API_TOKEN) because this is a distinct external
// consumer with its own lifecycle: BRAND-AGENT provisions new apps, Skills
// read/write content for apps that already exist. Rotating one token should
// never require rotating the other.
export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'BRAND_AGENT_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = onboardAppBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const result = await onboardApp({
    slug: parsed.data.slug,
    name: parsed.data.name,
    niche: parsed.data.niche,
    brand: parsed.data.brand,
    product: parsed.data.product,
    audience: parsed.data.audience,
    businessGoals: parsed.data.business_goals
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
