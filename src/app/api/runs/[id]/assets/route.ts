import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { put } from '@vercel/blob';

import { isProductAssetKind, productAssetExpectedSize } from '@/content/internal';
import { requireBearerToken } from '@/server/auth/api-token';
import { requireLease } from '@/server/pipeline/lease';
import { slugSchema } from '@/server/validation/bets';

export const runtime = 'nodejs';

// Vercel rejects request bodies above ~4.5 MB. The job descriptor tells the
// runner this ceiling so it fails loudly before uploading rather than
// discovering it as a truncated file.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

/**
 * Reads a PNG's dimensions from its IHDR chunk, and an SVG's from its viewBox.
 *
 * Deliberately no image library. product-agent's publish_product.py already
 * checks these dimensions by parsing the IHDR by hand, and the point of
 * recording them here is to be able to say "the icon on the site is the icon the
 * run rendered" — which needs the same numbers, not a second opinion from a
 * decoder that might normalise something.
 */
function readDimensions(bytes: Buffer, contentType: string): { width: number | null; height: number | null } {
  if (contentType === 'image/png' && bytes.length >= 24 && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (contentType === 'image/svg+xml') {
    const head = bytes.toString('utf8', 0, Math.min(bytes.length, 2000));
    const viewBox = head.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
    if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) };
  }
  return { width: null, height: null };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: 'BLOB_READ_WRITE_TOKEN is not configured on this deployment.' }, { status: 503 });
  }

  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not multipart/form-data.' }, { status: 400 });
  }

  const runnerId = String(form.get('runnerId') ?? '');
  if (!runnerId) return NextResponse.json({ ok: false, error: 'runnerId is required.' }, { status: 422 });

  const lease = await requireLease(id, runnerId);
  if (!lease.ok) return lease.response;

  const kind = String(form.get('kind') ?? '');
  if (!isProductAssetKind(kind)) {
    return NextResponse.json({ ok: false, error: `Unknown asset kind "${kind}".` }, { status: 422 });
  }

  const slugCheck = slugSchema.safeParse(form.get('slug') ?? '');
  if (!slugCheck.success) {
    return NextResponse.json({ ok: false, error: 'A valid product slug is required.' }, { status: 422 });
  }

  const sortOrder = Number(form.get('sortOrder') ?? 0);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 20) {
    return NextResponse.json({ ok: false, error: 'sortOrder must be an integer between 0 and 20.' }, { status: 422 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'A file is required.' }, { status: 422 });
  }

  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  const contentType = ALLOWED_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ ok: false, error: `Unsupported file type ".${extension}".`, allowed: Object.keys(ALLOWED_TYPES) }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ ok: false, error: 'That file is empty.' }, { status: 422 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `That file is ${bytes.length} bytes; the limit is ${MAX_BYTES}.` }, { status: 413 });
  }

  const { width, height } = readDimensions(bytes, contentType);
  const expected = productAssetExpectedSize[kind];

  // Rejected, not warned. A wrong-sized icon is an App Store submission failure
  // discovered weeks later, and the run that produced it is right here to fix.
  if (expected !== null && width !== null && (width !== expected || height !== expected)) {
    return NextResponse.json(
      { ok: false, error: `"${kind}" must be ${expected}x${expected}; this file is ${width}x${height}.` },
      { status: 422 }
    );
  }

  const checksum = createHash('sha256').update(bytes).digest('hex');

  // `addRandomSuffix` so a re-published asset gets a new immutable URL rather
  // than fighting the CDN cache on the old one — the row is what points at the
  // current file, and the URL itself never has to be invalidated.
  //
  // Every other failure in this route returns a status and a sentence. This one
  // call reaches a service we do not control, and it was the only one that could
  // throw: a rejected blob token surfaced as a bare HTTP 500, which the runner
  // reported as "uploading logo.svg failed" with nothing to act on. An
  // unattended pipeline cannot debug a 500, so say what went wrong.
  // Bounded on purpose. @vercel/blob retries internally with backoff, so a token the blob API
  // rejects turns into a long series of retries rather than a fast throw — and if that outlasts the
  // function's own limit the platform kills the invocation and answers 502 with an EMPTY body,
  // which is indistinguishable from the app being broken. A 20s ceiling means this route always
  // gets to say what happened.
  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(`products/${slugCheck.data}/${kind}-${sortOrder}.${extension}`, bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      abortSignal: AbortSignal.timeout(20_000)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[assets] blob upload failed for ${slugCheck.data}/${kind}:`, error);
    return NextResponse.json(
      {
        ok: false,
        error: `Blob storage rejected "${kind}" (${bytes.length} bytes, ${contentType}): ${detail}`,
        hint: 'Usually BLOB_READ_WRITE_TOKEN being absent, expired, or pointing at a deleted store on this deployment.'
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    url: blob.url,
    pathname: blob.pathname,
    contentType,
    kind,
    sortOrder,
    width,
    height,
    bytes: bytes.length,
    checksum: `sha256:${checksum}`
  });
}
