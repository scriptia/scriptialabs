import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { getApps } from '@/server/content-engine';

// See ADR-012 — read API for Content Engine Skills/BRAND-AGENT, not for the panel.
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireBearerToken(request, 'CONTENT_ENGINE_API_TOKEN');

  if (!auth.ok) {
    return auth.response;
  }

  const apps = await getApps();

  return NextResponse.json(apps);
}
