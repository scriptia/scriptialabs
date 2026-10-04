import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { loadLocalEnv } from '../src/server/db/load-env';
import { blocksToText, countWords, parseMarkdown } from '../src/lib/markdown/parse';
import { articleIngestPayloadSchema } from '../src/server/validation/articles';

// Publishes one product's articles to the public site (ADR-014).
//
//   npx tsx scripts/publish-articles.ts pupdojo --dry-run
//   npx tsx scripts/publish-articles.ts pupdojo
//   npx tsx scripts/publish-articles.ts pupdojo --only stop-puppy-biting --base-url http://localhost:3000
//
// Reads content/articles/<product>/<locale>/<slug>.md. The file name is the URL
// slug; files starting with `_` are templates and skipped. Each file is
//
//   ---
//   title: How to stop a puppy biting
//   description: One or two sentences for search results (≤ 160 characters).
//   translationKey: stop-puppy-biting      # same value in every locale's version
//   status: published                      # or draft
//   targetQuery: how to stop puppy biting  # optional, never rendered
//   keywords: puppy biting, teething       # optional, comma-separated
//   ---
//   Markdown body…
//
//   ## FAQ
//   ### A question?
//   Its answer.
//
// A final `## FAQ` section (or its Spanish/Catalan heading) is lifted out of the
// body into structured FAQ pairs, which the page renders and emits as FAQPage
// JSON-LD. Validation runs against the route's own schema before any request,
// and editorial checks (length, links, structure) print as warnings.

const FAQ_HEADINGS = ['faq', 'faqs', 'frequently asked questions', 'preguntas frecuentes', 'preguntes freqüents', 'preguntes frequents'];
const LOCALES = ['en', 'es', 'ca'];

type FrontMatter = Record<string, string>;

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function splitFrontMatter(path: string, text: string): { meta: FrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) fail(`${path}: missing front matter (--- … ---) at the top of the file.`);

  const meta: FrontMatter = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) fail(`${path}: front matter line "${raw}" is not "key: value".`);
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

/** Lifts a trailing `## FAQ` section into { question, answer } pairs. */
function extractFaq(path: string, body: string) {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    return heading && FAQ_HEADINGS.includes(heading[1].toLowerCase());
  });
  if (start === -1) return { body: body.trim(), faq: [] as Array<{ question: string; answer: string }> };

  const faq: Array<{ question: string; answer: string }> = [];
  let current: { question: string; answer: string[] } | null = null;
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) fail(`${path}: the FAQ section must be the last \`##\` section of the article.`);
    const question = /^###\s+(.+)$/.exec(line);
    if (question) {
      if (current) faq.push({ question: current.question, answer: current.answer.join(' ').trim() });
      current = { question: question[1].trim(), answer: [] };
    } else if (current && line.trim()) {
      current.answer.push(line.trim());
    }
  }
  if (current) faq.push({ question: current.question, answer: current.answer.join(' ').trim() });

  const empty = faq.find((item) => !item.answer);
  if (empty) fail(`${path}: FAQ question "${empty.question}" has no answer.`);

  return { body: lines.slice(0, start).join('\n').trim(), faq };
}

function readArticles(product: string, only?: string) {
  const root = resolve(process.cwd(), 'content/articles', product);
  if (!existsSync(root)) fail(`No directory content/articles/${product}.`);

  const articles = [];
  for (const locale of readdirSync(root)) {
    const dir = resolve(root, locale);
    if (!statSync(dir).isDirectory()) continue;
    if (!LOCALES.includes(locale)) fail(`content/articles/${product}/${locale}: not a site locale (${LOCALES.join(', ')}).`);

    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      const path = `content/articles/${product}/${locale}/${file}`;
      const { meta, body: rawBody } = splitFrontMatter(path, readFileSync(resolve(dir, file), 'utf8'));
      const { body, faq } = extractFaq(path, rawBody);

      for (const key of ['title', 'description', 'translationKey', 'status']) {
        if (!meta[key]) fail(`${path}: front matter needs \`${key}\`.`);
      }
      if (only && meta.translationKey !== only) continue;

      articles.push({
        path,
        article: {
          locale,
          slug: basename(file, '.md'),
          translationKey: meta.translationKey,
          status: meta.status,
          title: meta.title,
          description: meta.description,
          body,
          faq,
          ...(meta.targetQuery ? { targetQuery: meta.targetQuery } : {}),
          keywords: meta.keywords
            ? meta.keywords
                .split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean)
            : []
        }
      });
    }
  }
  return articles;
}

/** Editorial checks: never block a publish, always worth reading. */
function warningsFor(product: string, article: { title: string; description: string; body: string; faq: unknown[] }) {
  const warnings: string[] = [];
  const blocks = parseMarkdown(article.body);
  const words = countWords(blocksToText(blocks));
  const sections = blocks.filter((block) => block.type === 'heading' && block.level === 2).length;

  if (words < 600) warnings.push(`${words} words — thin for a guide; aim for 900–1,800.`);
  if (words > 3000) warnings.push(`${words} words — consider splitting.`);
  if (article.title.length > 65) warnings.push(`title is ${article.title.length} characters; search results cut around 60.`);
  if (article.description.length < 70 || article.description.length > 160) warnings.push(`description is ${article.description.length} characters; aim for 120–160.`);
  if (sections < 3) warnings.push(`${sections} \`##\` sections; answer engines quote well-structured pages — aim for 4+.`);
  if (article.faq.length === 0) warnings.push('no FAQ section.');
  if (!new RegExp(`\\]\\((/[a-z]{2})?/${product}(/|\\)|#)`).test(article.body)) warnings.push(`no link to the app (/${product}) in the body.`);
  if (blocks[0]?.type !== 'paragraph') warnings.push('does not open with a paragraph — lead with the direct answer.');

  return { words, warnings };
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  const product = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--base-url' && args[args.indexOf(arg) - 1] !== '--only');
  const dryRun = args.includes('--dry-run');
  const baseFlag = args.indexOf('--base-url');
  const onlyFlag = args.indexOf('--only');
  const baseUrl = (baseFlag === -1 ? (process.env.PUBLISH_BASE_URL ?? 'https://www.idionlabs.com') : args[baseFlag + 1]).replace(/\/$/, '');
  const only = onlyFlag === -1 ? undefined : args[onlyFlag + 1];

  if (!product) fail('Usage: npx tsx scripts/publish-articles.ts <product> [--dry-run] [--only <translationKey>] [--base-url <url>]');

  const entries = readArticles(product, only);
  if (entries.length === 0) fail(`No articles found for ${product}${only ? ` with translationKey ${only}` : ''}.`);

  const payload = { product, articles: entries.map((entry) => entry.article) };
  const parsed = articleIngestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const index = issue.path[1];
      const where = typeof index === 'number' ? entries[index].path : 'payload';
      console.error(`  ${where}: ${issue.path.slice(2).join('.') || issue.path.join('.')}: ${issue.message}`);
    }
    fail(`${parsed.error.issues.length} validation error(s).`);
  }

  console.log(`${product}: ${entries.length} article(s)\n`);
  for (const entry of entries) {
    const { words, warnings } = warningsFor(product, entry.article);
    console.log(`  [${entry.article.status === 'published' ? 'pub' : 'draft'}] ${entry.article.locale}/${entry.article.slug}  (${words} words, ${entry.article.faq.length} FAQ)`);
    for (const warning of warnings) console.log(`        ! ${warning}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing sent.');
    return;
  }

  const token = process.env.ARTICLE_INGEST_TOKEN;
  if (!token) fail('ARTICLE_INGEST_TOKEN is not set (export it or put it in .env.local).');

  const response = await fetch(`${baseUrl}/api/ingest/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(parsed.data)
  });
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    issues?: unknown;
    created?: number;
    updated?: number;
    unchanged?: number;
    articles?: Array<{ outcome: string; status: string; url: string }>;
  } | null;

  if (!response.ok || !result?.ok) {
    console.error(JSON.stringify(result, null, 2));
    fail(`Publish failed: ${response.status} ${result?.error ?? response.statusText}`);
  }

  console.log(`\npublished to ${baseUrl} — created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}`);
  for (const article of result.articles ?? []) {
    console.log(`  ${article.outcome.padEnd(9)} ${article.status.padEnd(9)} ${article.url}`);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
