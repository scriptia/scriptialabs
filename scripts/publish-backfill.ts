import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, inArray } from 'drizzle-orm';

import { loadLocalEnv } from '../src/server/db/load-env';
import { activePipelineRunStatuses } from '../src/content/internal';
import { bets, pipelineRunEvents, pipelineRuns } from '../src/server/db/schema';
import { productIngestPayloadSchema } from '../src/server/validation/products';

// Publishes one backfilled product to the public site.
//
//   npx tsx scripts/publish-backfill.ts accento --dry-run
//   npx tsx scripts/publish-backfill.ts accento --base-url https://scriptialabs.com
//
// WHY THIS EXISTS, given that publishing is already `POST /api/ingest/products`.
//
// Three products predate the pipeline: accento, nailio and bravo were built
// before it existed, their bets carry no Bet Case document, and they have no
// `products` row at all — so every `/{locale}/{slug}/legal/*` URL 404s, which is
// an App Store rejection for all three. The normal route to a page is a
// product-agent run, and that run cannot execute for a bet with no case.
//
// So this script supplies the two things the publish route needs and the missing
// run would otherwise have produced: a `pipeline_runs` row to attach the write
// to, and a payload. Everything after that is the ordinary route — the same
// token, the same validation, the same reserved-slug and slug-ownership guards,
// the same audit rows, the same tag revalidation. It does NOT write to
// `products`, `product_legal_documents` or `product_legal_sections` directly:
// two publication paths is how the panel and the public site drift.
//
// The run is inserted as `running`, not `queued`, and that is load-bearing.
// `POST /api/runs/claim` only hands out `queued` rows, so the pipeline-scheduler
// cannot pick this up and try to run a real product-agent session against a bet
// with no input.

type BackfillManifest = {
  betSlug: string;
  slug: string;
  accent: string;
  status: string;
  supportEmail: string;
  externalRunId: string;
  /** Directory holding the `legal` stage's `<docKey>.md` output, relative to the repo root. */
  legalDir: string;
  liveUrl?: string;
  badges?: string[];
  product: Record<string, unknown>;
  page?: Record<string, unknown>;
};

const LOCALES = ['en', 'es', 'ca'] as const;

// docKey -> URL segment. Mirrors productLegalDocumentSlugs, and is only a
// fallback: every document in these runs declares its own `**slug:**`.
const DOC_ORDER = ['privacy', 'terms', 'cookies', 'aiPolicy', 'contact', 'dataDeletion', 'accountDeletion', 'acceptableUse'];

const DOC_SLUGS: Record<string, string> = {
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  aiPolicy: 'ai-policy',
  contact: 'contact',
  dataDeletion: 'data-deletion',
  accountDeletion: 'account-deletion',
  acceptableUse: 'acceptable-use'
};

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** Collapses a hard-wrapped markdown paragraph into the single line a <p> should hold. */
const unwrap = (text: string) => text.split('\n').map((line) => line.trim()).join(' ').replace(/\s+/g, ' ').trim();

/**
 * One legal document, read out of the markdown the `legal` stage wrote.
 *
 * The shape, which is a contract rather than a convention — data/capabilities.json
 * ties section ids to the keys the site stores and product-agent's own
 * push_product.py parses the identical format:
 *
 *   ### informationWeCollect
 *   **What we collect**
 *
 *   body paragraph...
 *
 * The bodies here are UNWRAPPED before they are stored. push_product.py keeps the
 * source file's hard line breaks, which is why nixo's and ipsimo's live sections
 * carry newlines mid-sentence in the database.
 */
function parseLegalDocument(path: string) {
  const text = readFileSync(path, 'utf8');

  const docKey = /^\*\*docKey:\*\*\s*`(\w+)`/m.exec(text)?.[1];
  if (!docKey) fail(`${path}: no \`**docKey:**\` line. The docKey is declared in the file, never inferred from its name.`);

  const slug = /^\*\*docKey:\*\*.*?\*\*slug:\*\*\s*`([a-z0-9-]+)`/m.exec(text)?.[1] ?? DOC_SLUGS[docKey];
  if (!slug) fail(`${path}: no \`**slug:**\` and ${docKey} is not in DOC_SLUGS.`);

  const lastUpdated = /^\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/m.exec(text)?.[1];
  if (!lastUpdated) fail(`${path}: no \`**Last updated:** YYYY-MM-DD\` line.`);

  const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
  if (!title) fail(`${path}: no H1 title.`);

  const description = /^\*\*description:\*\*\s*(.+)$/m.exec(text)?.[1]?.trim();
  if (!description) fail(`${path}: no \`**description:**\` line. It is the page's meta description and the card blurb.`);

  const labelKey = /^\*\*docKey:\*\*.*?\*\*labelKey:\*\*\s*`(\w+)`/m.exec(text)?.[1];

  // SPLIT on the heading rather than matching each section with a lookahead.
  //
  // push_product.py ends its section pattern with `(?=^###\s|\Z)`, which is
  // correct in Python. `\Z` is not a JavaScript escape — it means a literal "Z" —
  // so the same expression here silently drops the LAST section of every
  // document, and a terms page missing `whoWeAre` is an App Store rejection that
  // no error would have announced. Splitting has no end-of-input case to get
  // wrong.
  const sections: unknown[] = [];

  for (const chunk of text.split(/^### /m).slice(1)) {
    const parsed = /^(\w+)\s*\n+\*\*(.+?)\*\*\s*\n([\s\S]*)$/.exec(chunk);
    if (!parsed) fail(`${path}: a \`###\` section is not \`### <sectionId>\` followed by a bold display title:\n    ${chunk.slice(0, 80)}`);

    const body = parsed[3]
      .trim()
      .split(/\n\s*\n/)
      .map(unwrap)
      .filter(Boolean);

    if (!body.length) fail(`${path}: section ${parsed[1]} has a title and no body.`);

    sections.push({
      id: parsed[1],
      title: Object.fromEntries(LOCALES.map((locale) => [locale, parsed[2].trim()])),
      body: Object.fromEntries(LOCALES.map((locale) => [locale, body]))
    });
  }

  if (!sections.length) fail(`${path}: parsed zero sections. Expected \`### <sectionId>\` followed by a bold display title.`);

  return {
    docKey,
    slug,
    lastUpdated,
    ...(labelKey ? { labelKey } : {}),
    title: Object.fromEntries(LOCALES.map((locale) => [locale, title])),
    description: Object.fromEntries(LOCALES.map((locale) => [locale, description])),
    sections
  };
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  const name = args.find((arg) => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  // indexOf returns -1 when the flag is absent, and args[-1 + 1] is args[0] —
  // which is the product slug, so the default silently became "accento".
  const flagIndex = args.indexOf('--base-url');
  const baseUrl = (flagIndex === -1 ? (process.env.PUBLISH_BASE_URL ?? 'https://scriptialabs.com') : args[flagIndex + 1]).replace(/\/$/, '');

  if (!name) fail('Usage: npx tsx scripts/publish-backfill.ts <slug> [--dry-run] [--base-url <url>]');

  const manifestPath = resolve(process.cwd(), `scripts/backfill/${name}.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BackfillManifest;

  // --- the payload, assembled from the manifest and the legal markdown --------
  const legalDir = resolve(process.cwd(), manifest.legalDir);

  // Every `.md` in the directory, not a fixed list of eight: bravo ships seven
  // (no `aiPolicy` — it makes no model call), and a hardcoded set would either
  // demand a document that must not exist or silently skip one that does.
  const documents = readdirSync(legalDir)
    .filter((file) => file.endsWith('.md') && file !== 'DELETIONS.md')
    .map((file) => parseLegalDocument(resolve(legalDir, file)))
    // Payload order IS display order — the route writes `sortOrder: index`, and
    // that drives the link list on the product page. Sorting by docKey rather
    // than by filename puts privacy and terms first, the way padelco's and
    // speaklio's hand-written sets read, instead of opening on Acceptable Use
    // because "a" sorts before "p".
    .sort((a, b) => DOC_ORDER.indexOf(a.docKey) - DOC_ORDER.indexOf(b.docKey));

  const payload = {
    pipelineRunId: '00000000-0000-0000-0000-000000000000',
    externalRunId: manifest.externalRunId,
    slug: manifest.slug,
    runId: manifest.externalRunId,
    status: manifest.status,
    accent: manifest.accent,
    supportEmail: manifest.supportEmail,
    ...(manifest.liveUrl ? { liveUrl: manifest.liveUrl } : {}),
    badges: manifest.badges ?? [],
    product: manifest.product,
    ...(manifest.page ? { page: manifest.page } : {}),
    legal: { documents },
    assets: [],
    documents: []
  };

  // Validate against the route's own schema before touching the network, so a
  // 200-character tagline is named here rather than coming back as a zod path in
  // a 422 after a run row has already been created.
  const parsed = productIngestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    fail(`${parsed.error.issues.length} validation error(s) in scripts/backfill/${name}.json.`);
  }

  console.log(`${manifest.slug}: ${documents.length} legal documents, ${(manifest.product.features as unknown[]).length} features, page copy ${manifest.page ? 'present' : 'absent'}.`);
  for (const document of documents) {
    console.log(`  ${document.docKey.padEnd(16)} ${String(document.sections.length).padStart(2)} sections  ->  ${baseUrl}/en/${manifest.slug}/legal/${document.slug}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was created and nothing was sent.');
    return;
  }

  const token = process.env.PRODUCT_INGEST_TOKEN;
  if (!token) fail('PRODUCT_INGEST_TOKEN is not set. The publish route answers 503 without it.');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL is not set.');

  const db = drizzle(neon(databaseUrl));

  const [bet] = await db.select({ id: bets.id, status: bets.status }).from(bets).where(eq(bets.slug, manifest.betSlug)).limit(1);
  if (!bet) fail(`No bet with slug "${manifest.betSlug}".`);

  // `pipeline_runs_one_active` allows one live run per (bet, kind). Reuse this
  // script's own row if a previous attempt left one behind, rather than failing
  // on a constraint the operator would then have to clean up by hand.
  const [existing] = await db
    .select({ id: pipelineRuns.id, externalRunId: pipelineRuns.externalRunId })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.betId, bet.id), eq(pipelineRuns.kind, 'product-agent'), inArray(pipelineRuns.status, [...activePipelineRunStatuses])))
    .limit(1);

  if (existing && existing.externalRunId !== manifest.externalRunId) {
    fail(`A ${manifest.betSlug} product-agent run is already in flight (${existing.id}, ${existing.externalRunId}). Cancel it in the panel first.`);
  }

  const runId =
    existing?.id ??
    (
      await db
        .insert(pipelineRuns)
        .values({
          betId: bet.id,
          kind: 'product-agent',
          status: 'running',
          runnerId: 'legal-backfill',
          attempt: 1,
          externalRunId: manifest.externalRunId,
          // publishLegal is what the route reads to decide whether to write the
          // legal rows at all. `stages: ['legal']` and createFeatures:false record
          // what this run actually was, for anyone reading the panel later.
          params: { publishLegal: true, createFeatures: false, force: false, stages: ['legal'], externalRunId: manifest.externalRunId },
          claimedAt: new Date(),
          startedAt: new Date(),
          heartbeatAt: new Date(),
          leaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
        })
        .returning({ id: pipelineRuns.id })
    )[0].id;

  console.log(`\nrun ${runId} (${bet.status} bet, kind product-agent)`);

  const response = await fetch(`${baseUrl}/api/ingest/products`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...parsed.data, pipelineRunId: runId })
  });

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    await db
      .update(pipelineRuns)
      .set({ status: 'failed', error: `${response.status} ${JSON.stringify(result).slice(0, 4000)}`, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(pipelineRuns.id, runId));
    console.error(JSON.stringify(result, null, 2));
    fail(`Publish failed: ${response.status}. The run is marked failed; fix the payload and re-run.`);
  }

  await db
    .update(pipelineRuns)
    .set({ status: 'succeeded', result: result as Record<string, unknown>, finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(pipelineRuns.id, runId));

  await db.insert(pipelineRunEvents).values({
    runId,
    level: 'info',
    stage: 'legal',
    message: `Backfill published /${manifest.slug} with ${documents.length} legal documents. No identity, features, store or judge stage ran; the app was built before the pipeline existed.`
  });

  console.log(`\npublished /${manifest.slug} — created: ${result.created}, legal documents: ${result.legalDocuments}, bet: ${result.betStatus}`);
  console.log(`revalidated: ${(result.revalidated as string[] | undefined)?.join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
