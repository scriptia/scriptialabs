import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getCurrentUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { productAssets, productDocuments, products } from '@/server/db/schema';

export const runtime = 'nodejs';

// Downloading one product artifact from the panel.
//
// A route handler rather than a server action because the whole point is the
// Content-Disposition header: an action can return a string, but it cannot make
// the browser save a file. Reading a document body in place is still an action
// (loadProductDocument in actions/products.ts).
//
// Under /api/internal, not /internal: the middleware's matcher excludes `api`,
// so nothing upstream redirects an unauthenticated caller to the login page —
// which is right for a fetch, and means the session check below is THE guard,
// not a second one. It uses getCurrentUser rather than requireUser for the same
// reason: a 401 is a better answer to a download request than a 307 to a login
// form the caller cannot render.
//
// The existing /api/products/[slug]/documents is the machine equivalent and
// stays bearer-guarded for the runner; this one is cookie-guarded for a human.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sign in to /internal first.' }, { status: 401 });
  }

  const { slug } = await params;
  const documentId = request.nextUrl.searchParams.get('doc');
  const assetId = request.nextUrl.searchParams.get('asset');

  if (Boolean(documentId) === Boolean(assetId)) {
    return NextResponse.json({ ok: false, error: 'Pass exactly one of ?doc= or ?asset=.' }, { status: 400 });
  }

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) {
    return NextResponse.json({ ok: false, error: `No product /${slug}.` }, { status: 404 });
  }

  // Scoped to the product in the URL, not just looked up by id: a bare id lookup
  // would let any signed-in path fetch any product's artifact through any slug,
  // which makes the slug in the URL a lie.
  return documentId ? downloadDocument(product.id, documentId, slug) : downloadAsset(product.id, assetId as string, slug);
}

async function downloadDocument(productId: string, id: string, slug: string) {
  const [row] = await db
    .select({ name: productDocuments.name, content: productDocuments.content })
    .from(productDocuments)
    .where(and(eq(productDocuments.id, id), eq(productDocuments.productId, productId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ ok: false, error: `No such document on /${slug}.` }, { status: 404 });
  }

  const filename = row.name.toLowerCase().endsWith('.md') ? row.name : `${row.name}.md`;

  return new NextResponse(row.content, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': disposition(filename),
      'cache-control': 'no-store'
    }
  });
}

async function downloadAsset(productId: string, id: string, slug: string) {
  const [row] = await db
    .select({ url: productAssets.url, pathname: productAssets.pathname, contentType: productAssets.contentType, kind: productAssets.kind, sortOrder: productAssets.sortOrder })
    .from(productAssets)
    .where(and(eq(productAssets.id, id), eq(productAssets.productId, productId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ ok: false, error: `No such asset on /${slug}.` }, { status: 404 });
  }

  // Proxied rather than redirected. The bytes live on the blob CDN, a different
  // origin, so `<a download>` on that URL is ignored by every browser and opens
  // the image instead — streaming it back from here is what actually saves a
  // file. It also means the asset URL never has to be handed to the client for
  // this to work.
  const upstream = await fetch(row.url, { cache: 'no-store' });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ ok: false, error: `Blob storage returned ${upstream.status} for that asset.` }, { status: 502 });
  }

  const extension = row.pathname.split('.').pop();

  return new NextResponse(upstream.body, {
    headers: {
      'content-type': row.contentType,
      'content-disposition': disposition(`${slug}-${row.kind}-${row.sortOrder}${extension ? `.${extension}` : ''}`),
      'cache-control': 'no-store'
    }
  });
}

// Two filename forms on purpose: the bare one is ASCII-folded so a quote or an
// accent cannot break out of the quoted string, and `filename*` carries the real
// name for anything that understands RFC 5987 (everything current).
function disposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
