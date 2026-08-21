import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, notInArray } from 'drizzle-orm';

import { loadLocalEnv } from '../src/server/db/load-env';
import { productAssets, productFeatures, productLegalDocs, productLegalSections, products } from '../src/server/db/schema';
import type { LocalizedParagraphs, LocalizedText, ProductPageCopy } from '../src/server/db/schema';
import { productRegistry, type ProductRecord } from '../src/content/products';
import { productMessageKeyById } from '../src/content/products/message-keys';
import { productLegalDocuments, type ProductLegalDocumentKey, type ProductLegalLabelKey } from '../src/content/legal/product-legal';
import en from '../src/messages/en/index';
import es from '../src/messages/es/index';
import ca from '../src/messages/ca/index';

// Moves the code-defined product content into the database, once.
//
//   npm run seed:products -- [--dry-run] [--only <slug>] [--allow-missing]
//
// This is a PROJECTION, not a translation. Every value is read from the code
// that renders the site today, so a mistake shows up as a missing key rather
// than as a paraphrase — and scripts/verify-product-parity.mjs then diffs the
// rendered HTML of both sources byte for byte with no whitelist.
//
// Deliberately fails loudly. A missing message key throws instead of defaulting
// to '' — an empty string would render as a blank heading on a live page rather
// than stopping the seed, and silently shipping a blank legal section is the
// exact failure this whole exercise exists to prevent. `--allow-missing` opts
// out per run, and marks anything incomplete as unpublished.

const LOCALES = ['en', 'es', 'ca'] as const;
type Locale = (typeof LOCALES)[number];

const MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  es: es as unknown as Record<string, unknown>,
  ca: ca as unknown as Record<string, unknown>
};

// Fixed, not `new Date()`: re-running the seed must be a no-op, and a moving
// publishedAt would rewrite the row (and bust the public cache) every time.
// Backdated so these predate anything the pipeline publishes.
const MIGRATED_PUBLISHED_AT = new Date('2026-01-01T00:00:00.000Z');

class MissingCopy extends Error {
  constructor(readonly keyPath: string) {
    super(`Missing message key: ${keyPath}`);
    this.name = 'MissingCopy';
  }
}

const missing: string[] = [];

function lookup(locale: Locale, path: string): unknown {
  let node: unknown = MESSAGES[locale];
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in (node as Record<string, unknown>))) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** One string, in all three locales. Throws if any locale is missing it. */
function text(path: string): LocalizedText {
  const out = {} as LocalizedText;
  for (const locale of LOCALES) {
    const value = lookup(locale, path);
    if (typeof value !== 'string' || value.trim() === '') throw new MissingCopy(`${locale}.${path}`);
    out[locale] = value;
  }
  return out;
}

/** One string[] (a legal section body), in all three locales. */
function paragraphs(path: string): LocalizedParagraphs {
  const out = {} as LocalizedParagraphs;
  for (const locale of LOCALES) {
    const value = lookup(locale, path);
    if (!Array.isArray(value) || value.length === 0 || value.some((p) => typeof p !== 'string' || p.trim() === '')) {
      throw new MissingCopy(`${locale}.${path}`);
    }
    out[locale] = value as string[];
  }
  return out;
}

/** Same as text(), but returns undefined when the key is absent everywhere. */
function optionalText(path: string): LocalizedText | undefined {
  if (LOCALES.every((locale) => lookup(locale, path) === undefined)) return undefined;
  return text(path);
}

/**
 * Ordered keys of a message sub-object, in the order the message file declares
 * them. `howItWorks.steps` and `faq.items` are keyed '1'|'2'|'3' rather than
 * being arrays, and object key order is what the renderer relies on today.
 */
function childKeys(path: string): string[] {
  const node = lookup('en', path);
  if (node === null || typeof node !== 'object') throw new MissingCopy(`en.${path}`);
  return Object.keys(node as Record<string, unknown>);
}

// The `page.*` block, which is what keeps a migrated page byte-identical.
function buildPageCopy(ns: string): ProductPageCopy {
  const steps = childKeys(`${ns}.page.howItWorks.steps`).map((k) => ({
    title: text(`${ns}.page.howItWorks.steps.${k}.title`),
    description: text(`${ns}.page.howItWorks.steps.${k}.description`)
  }));
  const items = childKeys(`${ns}.page.faq.items`).map((k) => ({
    question: text(`${ns}.page.faq.items.${k}.question`),
    answer: text(`${ns}.page.faq.items.${k}.answer`)
  }));

  const secondary = optionalText(`${ns}.page.cta.secondary`);
  const brandCta = optionalText(`${ns}.page.brandCta`);

  return {
    overview: { title: text(`${ns}.page.overview.title`), body: text(`${ns}.page.overview.body`) },
    capabilitiesTitle: text(`${ns}.page.capabilities.title`),
    howItWorks: {
      title: text(`${ns}.page.howItWorks.title`),
      description: text(`${ns}.page.howItWorks.description`),
      steps
    },
    why: { title: text(`${ns}.page.why.title`), body: text(`${ns}.page.why.body`) },
    // `status` in the messages; `statusBlock` in the column, so it never reads
    // like the product's lifecycle status.
    statusBlock: { title: text(`${ns}.page.status.title`), body: text(`${ns}.page.status.body`) },
    faq: { title: text(`${ns}.page.faq.title`), items },
    cta: {
      title: text(`${ns}.page.cta.title`),
      description: text(`${ns}.page.cta.description`),
      primary: text(`${ns}.page.cta.primary`),
      ...(secondary ? { secondary } : {})
    },
    ...(brandCta ? { brandCta } : {})
  };
}

type SeededProduct = {
  record: ProductRecord;
  ns: string;
  row: typeof products.$inferInsert;
  features: Array<{ key: string; sortOrder: number; title: LocalizedText; description: LocalizedText }>;
  legal: Array<{
    docKey: ProductLegalDocumentKey;
    slug: string;
    labelKey: ProductLegalLabelKey | null;
    lastUpdated: string;
    sortOrder: number;
    title: LocalizedText;
    description: LocalizedText;
    sections: Array<{ key: string; sortOrder: number; title: LocalizedText; body: LocalizedParagraphs }>;
  }>;
};

function buildProduct(record: ProductRecord): SeededProduct {
  const messageKey = productMessageKeyById[record.id];
  const ns = `products.${messageKey}`;

  // Feature ids are derived exactly the way [slug]/page.tsx derives them at
  // render time: strip the `products.<key>.features.` prefix off the titleKey.
  const prefix = `${ns}.features.`;
  const features = record.features.map((feature, index) => {
    const key = feature.titleKey.startsWith(prefix) ? feature.titleKey.slice(prefix.length).replace(/\.title$/, '') : feature.titleKey;
    return {
      key,
      sortOrder: index,
      title: text(feature.titleKey),
      description: text(feature.descriptionKey)
    };
  });

  const legalNs = `productLegal.${messageKey}`;
  const declared = productLegalDocuments[record.id] ?? {};
  const legal = Object.entries(declared).map(([docKey, document], index) => ({
    docKey: docKey as ProductLegalDocumentKey,
    slug: document.slug,
    labelKey: document.labelKey ?? null,
    lastUpdated: document.lastUpdated,
    sortOrder: index,
    title: text(`${legalNs}.${docKey}.title`),
    description: text(`${legalNs}.${docKey}.description`),
    sections: document.sections.map((sectionId, sectionIndex) => ({
      key: sectionId,
      sortOrder: sectionIndex,
      title: text(`${legalNs}.${docKey}.sections.${sectionId}.title`),
      body: paragraphs(`${legalNs}.${docKey}.sections.${sectionId}.body`)
    }))
  }));

  const row: typeof products.$inferInsert = {
    slug: record.slug,
    betId: null,
    status: record.status,
    accent: record.accent,
    publishedAt: MIGRATED_PUBLISHED_AT,
    // Carried over verbatim from seo.indexable, so the migration changes
    // nothing about what search engines are told. Machine-published products
    // default to false instead and a human flips them.
    indexable: record.seo.indexable,
    liveUrl: record.links.live ?? null,
    externalUrl: record.links.external ?? null,
    badges: record.badges,
    supportEmail: null,
    name: text(`${ns}.name`),
    // Two different strings, deliberately: see the column comments in schema.ts.
    // The card blurb lives under `homepage.products.items.*` because the
    // homepage and /products index share one card component.
    tagline: text(`${ns}.description`),
    cardDescription: text(`homepage.products.items.${messageKey}.description`),
    heroTitle: text(`${ns}.hero.title`),
    heroDescription: text(`${ns}.hero.description`),
    seoTitle: text(`${ns}.seo.title`),
    seoDescription: text(`${ns}.seo.description`),
    pageCopy: buildPageCopy(ns),
    sourceRunId: null,
    sourceExternalRunId: null,
    updatedAt: MIGRATED_PUBLISHED_AT
  };

  return { record, ns, row, features, legal };
}

async function main() {
  loadLocalEnv();

  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const allowMissing = argv.includes('--allow-missing');
  const onlyIndex = argv.indexOf('--only');
  const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : undefined;

  const candidates = Object.values(productRegistry)
    // Archived products have no public page and, in accento/nailio's case, no
    // copy to migrate at all. Nothing reads them, so nothing seeds them.
    .filter((product) => product.status !== 'archived')
    .filter((product) => !only || product.slug === only);

  if (only && candidates.length === 0) {
    throw new Error(`No non-archived product with slug "${only}".`);
  }

  const built: SeededProduct[] = [];
  for (const record of candidates) {
    try {
      built.push(buildProduct(record));
    } catch (error) {
      if (error instanceof MissingCopy && allowMissing) {
        missing.push(`${record.slug}: ${error.keyPath}`);
        continue;
      }
      if (error instanceof MissingCopy) {
        throw new Error(
          `${error.message}\n\n` +
            `  Product "${record.slug}" is declared in src/content/products/index.ts but its copy is\n` +
            `  incomplete. Write the missing copy, set status:'archived' on the product, or re-run\n` +
            `  with --allow-missing to skip it (it will not be seeded).`
        );
      }
      throw error;
    }
  }

  const totals = {
    products: built.length,
    features: built.reduce((n, p) => n + p.features.length, 0),
    legalDocuments: built.reduce((n, p) => n + p.legal.length, 0),
    legalSections: built.reduce((n, p) => n + p.legal.reduce((m, d) => m + d.sections.length, 0), 0)
  };

  for (const p of built) {
    const docs = p.legal.map((d) => `${d.docKey}(${d.sections.length})`).join(' ');
    console.log(`  ${p.record.slug.padEnd(14)} status=${p.row.status!.padEnd(7)} indexable=${String(p.row.indexable).padEnd(5)} features=${p.features.length} legal=[${docs || '—'}]`);
  }
  console.log(
    `\n  ${totals.products} products, ${totals.features} features, ` +
      `${totals.legalDocuments} legal documents, ${totals.legalSections} legal sections ` +
      `(${totals.legalSections * 3} localized bodies)`
  );
  if (missing.length) {
    console.warn(`\n  SKIPPED ${missing.length} product(s) for missing copy:`);
    for (const m of missing) console.warn(`    ${m}`);
  }

  if (dryRun) {
    console.log('\n  --dry-run: nothing written.');
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local, or export it to target another environment.');
  }

  const db = drizzle(neon(url));

  // Sequential, non-transactional, every write an idempotent upsert — the same
  // discipline as the bets ingest route, and for the same reason: the neon-http
  // driver is one statement per round trip with no interactive transactions, so
  // a partial run has to be repairable by simply running it again.
  for (const p of built) {
    const [row] = await db
      .insert(products)
      .values(p.row)
      .onConflictDoUpdate({ target: products.slug, set: { ...p.row, updatedAt: MIGRATED_PUBLISHED_AT } })
      .returning({ id: products.id });

    const productId = row.id;

    for (const feature of p.features) {
      await db
        .insert(productFeatures)
        .values({ productId, ...feature })
        .onConflictDoUpdate({
          target: [productFeatures.productId, productFeatures.key],
          set: { sortOrder: feature.sortOrder, title: feature.title, description: feature.description, updatedAt: MIGRATED_PUBLISHED_AT }
        });
    }
    // Drop features this product no longer declares, so a re-run after an edit
    // converges rather than accumulating.
    const featureKeys = p.features.map((f) => f.key);
    if (featureKeys.length) {
      await db.delete(productFeatures).where(and(eq(productFeatures.productId, productId), notInArray(productFeatures.key, featureKeys)));
    }

    for (const document of p.legal) {
      const { sections, ...documentRow } = document;
      const [docRow] = await db
        .insert(productLegalDocs)
        .values({ productId, ...documentRow })
        .onConflictDoUpdate({
          target: [productLegalDocs.productId, productLegalDocs.docKey],
          set: { ...documentRow, updatedAt: MIGRATED_PUBLISHED_AT }
        })
        .returning({ id: productLegalDocs.id });

      const documentId = docRow.id;

      for (const section of sections) {
        await db
          .insert(productLegalSections)
          .values({ documentId, ...section })
          .onConflictDoUpdate({
            target: [productLegalSections.documentId, productLegalSections.key],
            set: { sortOrder: section.sortOrder, title: section.title, body: section.body, updatedAt: MIGRATED_PUBLISHED_AT }
          });
      }

      const sectionKeys = sections.map((s) => s.key);
      if (sectionKeys.length) {
        await db.delete(productLegalSections).where(and(eq(productLegalSections.documentId, documentId), notInArray(productLegalSections.key, sectionKeys)));
      }
    }

    const docKeys = p.legal.map((d) => d.docKey);
    if (docKeys.length) {
      await db.delete(productLegalDocs).where(and(eq(productLegalDocs.productId, productId), notInArray(productLegalDocs.docKey, docKeys)));
    } else {
      await db.delete(productLegalDocs).where(eq(productLegalDocs.productId, productId));
    }

    console.log(`  seeded ${p.record.slug}`);
  }

  // Assets are not seeded: the six migrated products have no rendered icon set
  // in this repo. product-agent uploads those for the products it publishes.
  void productAssets;

  console.log(`\n  Done. ${built.length} product(s) written.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
