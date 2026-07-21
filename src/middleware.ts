import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from '@/lib/i18n/routing';
import { SESSION_COOKIE, verifySession } from '@/server/auth/session';

// This file must live in `src/`, not the repository root: Next.js looks for
// middleware next to the `app` directory, and this project keeps `app` under
// `src/`. A root-level middleware.ts is silently ignored — which is exactly what
// happened before the internal panel needed it.
const intlMiddleware = createMiddleware(routing);

const INTERNAL_PREFIX = '/internal';
const INTERNAL_LOGIN = '/internal/login';

// /internal is deliberately outside the locale tree (see ADR-010). With
// `localePrefix: 'always'`, letting next-intl see these paths would redirect
// /internal to /en/internal, so the dispatch has to happen before it runs.
//
// This only verifies the cookie's signature — no database call, because
// middleware runs on the Edge runtime on every matched request. The real
// account check (deactivated, deleted) happens in requireUser().
async function handleInternal(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === INTERNAL_LOGIN) {
    if (session) {
      return NextResponse.redirect(new URL(INTERNAL_PREFIX, request.url));
    }

    return NextResponse.next();
  }

  if (!session) {
    const target = new URL(INTERNAL_LOGIN, request.url);
    // Preserve where they were headed so login can send them back there.
    target.searchParams.set('next', pathname);

    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === INTERNAL_PREFIX || pathname.startsWith(`${INTERNAL_PREFIX}/`)) {
    return handleInternal(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)']
};
