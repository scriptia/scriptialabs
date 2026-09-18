#!/usr/bin/env node
// Asserts the public site has no broken links.
//
//   node scripts/check-public-links.mjs [baseUrl]
//   node scripts/check-public-links.mjs https://scriptialabs.com
//
// Run after every deploy and nightly. It exists because "no broken links" is the
// property this whole content migration is meant to guarantee, and a property
// nobody measures is a hope.
//
// Two checks, and the second is the one that matters:
//
//  1. Every URL in the sitemap resolves 200.
//  2. Every legal link rendered on every product page resolves 200.
//
// Both assert on the <title> as well as the status, because a 200 has already
// proven not to be evidence on this site: a route-level loading.tsx used to make
// every unmatched URL answer 200 with the generic "Scriptia Labs" shell. That is
// why product-agent's deploy_legal.py checks titles too — a legal URL that
// soft-404s is an App Store rejection, and the status code lied.

const BASE = (process.argv[2] ?? process.env.CHECK_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const CONCURRENCY = 8;

// A page serving one of these as its <title> is the site shell, not the page you
// asked for. Mirrors GENERIC_TITLES in product-agent/orchestrator/deploy_legal.py.
const GENERIC_TITLES = new Set(['scriptia labs', 'scriptialabs']);

const failures = [];
const note = (url, reason) => failures.push({ url, reason });

async function fetchPage(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'check-public-links/1.0' } });
    // html OR xml: /sitemap.xml is served as application/xml, and reading only
    // text/html silently produced an empty body and "0 URLs, no broken links" —
    // a check that passed by looking at nothing.
    const type = response.headers.get('content-type') ?? '';
    const body = type.includes('text/html') || type.includes('xml') ? await response.text() : '';
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: '', error: error instanceof Error ? error.message : String(error) };
  }
}

const titleOf = (body) => (body.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();

/** Runs `worker` over `items` with bounded concurrency. */
async function mapLimit(items, limit, worker) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })
  );
  return results;
}

async function checkUrl(path, context) {
  const { status, body, error } = await fetchPage(`${BASE}${path}`);
  if (status !== 200) {
    note(path, `${context}: expected 200, got ${status}${error ? ` (${error})` : ''}`);
    return null;
  }
  const title = titleOf(body);
  if (GENERIC_TITLES.has(title.toLowerCase())) {
    note(path, `${context}: served the site shell ("${title}") — soft 404`);
    return null;
  }
  if (!title) note(path, `${context}: no <title>`);
  return body;
}

async function main() {
  console.log(`Checking ${BASE}`);

  // 1 — the sitemap
  const sitemap = await fetchPage(`${BASE}/sitemap.xml`);
  if (sitemap.status !== 200) {
    console.error(`  /sitemap.xml returned ${sitemap.status}`);
    process.exit(1);
  }
  const sitemapUrls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(/^https?:\/\/[^/]+/, ''));
  console.log(`  sitemap: ${sitemapUrls.length} URLs`);
  const bodies = await mapLimit(sitemapUrls, CONCURRENCY, (path) => checkUrl(path, 'sitemap'));

  // 2 — every legal link rendered on every product page.
  //
  // Taken from the rendered HTML rather than from the database on purpose: the
  // point is to catch a page that LINKS somewhere dead, which is exactly the
  // failure a query against the same source that produced the link cannot see.
  const legalLinks = new Set();
  for (const body of bodies) {
    if (!body) continue;
    for (const match of body.matchAll(/href="(\/(?:en|es|ca)\/[a-z0-9-]+\/legal\/[a-z0-9-]+)"/g)) legalLinks.add(match[1]);
  }
  console.log(`  legal links found on those pages: ${legalLinks.size}`);
  await mapLimit([...legalLinks], CONCURRENCY, (path) => checkUrl(path, 'legal link'));

  // 3 — a URL that must NOT resolve, proving 404s are real and this whole check
  // is capable of failing.
  const canary = '/en/definitely-not-a-real-product-page';
  const { status } = await fetchPage(`${BASE}${canary}`);
  if (status !== 404) note(canary, `expected 404 for a nonexistent page, got ${status} — 404s are soft, so every check above is unreliable`);

  if (failures.length) {
    console.error(`\n  ${failures.length} problem(s):`);
    for (const failure of failures) console.error(`    ${failure.url}\n      ${failure.reason}`);
    process.exit(1);
  }
  console.log('\n  No broken links.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
