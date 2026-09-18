import { NextResponse, type NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';

import { isProductDocumentKind, type ProductDocumentKind } from '@/content/internal';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { productAssets, productDocuments, products } from '@/server/db/schema';

export const runtime = 'nodejs';

// Everything a downstream agent needs to build or market a product, in one
// request. The builder reads the feature specifications and the requirements;
// a marketing agent reads the App Store listing and the ASO block.
//
// Why this exists as a route rather than only inside the build handoff: the
// handoff is written by the runner, so anything not running through the runner —
// a marketing agent, a person, a second builder — had no way to reach these
// documents at all. They lived on the disk of whichever machine ran the product
// stage, which is exactly the coupling the descriptor was designed to remove.
//
//   GET /api/products/ipsimo/documents            everything
//   GET /api/products/ipsimo/documents?kind=feature       one kind
//   GET /api/products/ipsimo/documents?index=1    metadata only, no bodies
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { slug } = await params;

  const [product] = await db
    .select({ id: products.id, slug: products.slug, status: products.status, sourceExternalRunId: products.sourceExternalRunId })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!product) {
    return NextResponse.json({ ok: false, error: `No product with slug "${slug}".` }, { status: 404 });
  }

  // Narrowed into its own binding: an early return on the negative branch of a
  // type predicate does not narrow the original `string | null`.
  const kindParam = request.nextUrl.searchParams.get('kind');
  let kind: ProductDocumentKind | null = null;
  if (kindParam !== null) {
    if (!isProductDocumentKind(kindParam)) {
      return NextResponse.json({ ok: false, error: `Unknown document kind "${kindParam}".` }, { status: 422 });
    }
    kind = kindParam;
  }

  // `index=1` returns the shape without the bodies, so a consumer can decide what
  // it needs before pulling a few hundred KB of markdown it may not read.
  const indexOnly = request.nextUrl.searchParams.get('index') === '1';

  const rows = await db
    .select()
    .from(productDocuments)
    .where(kind ? and(eq(productDocuments.productId, product.id), eq(productDocuments.kind, kind)) : eq(productDocuments.productId, product.id))
    .orderBy(asc(productDocuments.kind), asc(productDocuments.sortOrder), asc(productDocuments.path));

  const assets = await db
    .select({ kind: productAssets.kind, url: productAssets.url, sortOrder: productAssets.sortOrder, checksum: productAssets.checksum })
    .from(productAssets)
    .where(eq(productAssets.productId, product.id))
    .orderBy(asc(productAssets.kind), asc(productAssets.sortOrder));

  return NextResponse.json({
    ok: true,
    slug: product.slug,
    status: product.status,
    externalRunId: product.sourceExternalRunId,
    // Assets come back alongside deliberately: a builder that has the feature
    // specs still needs the icon set, and two round trips to assemble one handoff
    // is two chances to get half of it.
    assets,
    documents: rows.map((row) => ({
      kind: row.kind,
      path: row.path,
      name: row.name,
      checksum: row.checksum,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt,
      ...(indexOnly ? {} : { content: row.content })
    }))
  });
}
