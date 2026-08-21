#!/usr/bin/env node
// Proves the database renders the public site identically to the code registry.
//
//   # terminal 1
//   PUBLIC_CONTENT_SOURCE=code npm run build && PORT=3101 node .next/standalone/server.js
//   # terminal 2 (a separate checkout or after a second build)
//   PUBLIC_CONTENT_SOURCE=db   npm run build && PORT=3102 node .next/standalone/server.js
//   # terminal 3
//   node scripts/verify-product-parity.mjs http://127.0.0.1:3101 http://127.0.0.1:3102
//
// Expected result: ZERO differences, with no whitelist. Both sources feed the
// same view models and the same JSX (see src/server/content/product-view.ts), so
// React serializes an identical element tree to identical markup — any diff at
// all is a defect in the seed or in an adapter, never "just formatting".
//
// This is the gate for flipping PUBLIC_CONTENT_SOURCE in production. Deploy with
// `code`, run this against the preview until it is green, then flip the variable.

const [, , A = 'http://127.0.0.1:3101', B = 'http://127.0.0.1:3102'] = process.argv;
const LOCALES = ['en', 'es', 'ca'];
const CONCURRENCY = 8;
const CONTEXT = 220;

async function get(base, path) {
  try {
    const response = await fetch(`${base}${path}`, { headers: { 'user-agent': 'verify-product-parity/1.0' } });
    return { status: response.status, body: await response.text() };
  } catch (error) {
    return { status: 0, body: '', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Removes React's streaming bookkeeping, which is timing, not content.
 *
 * When a server component's data resolves after the shell has flushed, React
 * emits the rest out of order and stitches it back with `<!--$-->` boundary
 * comments, `<template id="B:0">` placeholders and `<div hidden id="S:1">` slots
 * — and lets late-resolving `<title>`/`<meta>` land in the body for the browser
 * to hoist. None of that carries content, and whether it appears at all depends
 * on how fast a query answered, which differs between a build reading a message
 * file and one reading Postgres.
 *
 * Comparing it produced 54 "differences" whose entire substance was one empty
 * `<div hidden id="S:1"></div>`. Metadata is compared explicitly in metaFacts(),
 * so dropping the stray tags here loses no coverage.
 *
 * Only EMPTY hidden slots are stripped. A filled one contains real markup that
 * must still be compared — the fix for those is warming the cache (see
 * `warm()`), not deleting them.
 */
const stripScripts = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--\$[?!]?-->/g, '')
    .replace(/<!--\/\$-->/g, '')
    .replace(/<div hidden id="[SBP]:\d+"><\/div>/g, '')
    .replace(/<template id="[SBP]:\d+"><\/template>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\b[^>]*>/g, '')
    .replace(/<link\b[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Everything inside <body> EXCEPT <main> — i.e. the navbar and footer.
 *
 * Compared separately and not skipped, because the navbar's product dropdown and
 * the footer's product column are DB-driven too. An earlier version of this
 * script only compared <main>, and a deliberately corrupted product tagline
 * sailed through it: the tagline renders in the navbar, so the check reported
 * "zero differences" against a site whose chrome was visibly wrong.
 */
function chromeOf(html) {
  const open = html.indexOf('<body');
  if (open < 0) return null;
  const start = html.indexOf('>', open) + 1;
  const end = html.lastIndexOf('</body>');
  if (end < 0) return null;
  const body = html.slice(start, end);
  const main = mainOf(html);
  return stripScripts(main ? body.replace(main, '\n<!--main-->\n') : body);
}

/**
 * The <main id="main-content"> subtree, scripts stripped.
 *
 * <html>/<head> are excluded because they carry build ids and asset hashes that
 * differ between two builds for reasons that have nothing to do with content.
 * Everything in <head> that matters is compared explicitly as metadata below.
 */
function mainOf(html) {
  const anchor = html.indexOf('id="main-content"');
  if (anchor < 0) return null;
  const start = html.lastIndexOf('<', anchor);
  let depth = 0;
  let cursor = start;
  const tag = /<\/?main\b/g;
  while (cursor < html.length) {
    tag.lastIndex = cursor;
    const match = tag.exec(html);
    if (!match) break;
    if (html.startsWith('</main', match.index)) {
      depth -= 1;
      if (depth === 0) return stripScripts(html.slice(start, html.indexOf('>', match.index) + 1));
    } else {
      depth += 1;
    }
    cursor = match.index + match[0].length;
  }
  return null;
}

const meta = (body, re) => (body.match(re)?.[1] ?? null);

function metaFacts(body) {
  const ld = body.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  let jsonld = null;
  if (ld) {
    try {
      jsonld = JSON.parse(ld);
    } catch {
      jsonld = { unparseable: ld.slice(0, 200) };
    }
  }
  return {
    title: meta(body, /<title>([^<]*)<\/title>/),
    description: meta(body, /<meta name="description" content="([^"]*)"/),
    robots: meta(body, /<meta name="robots" content="([^"]*)"/),
    canonical: meta(body, /<link rel="canonical" href="([^"]*)"/),
    hreflang: [...body.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map((m) => `${m[1]} ${m[2]}`).sort(),
    // Deep-compared as a parsed object so key order never produces a false diff.
    jsonld
  };
}

/** Sorted hrefs inside <main> — catches a link that moved or vanished even if the prose matched. */
const hrefsOf = (main) => [...main.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();

async function sitemapPaths(base) {
  const { body } = await get(base, '/sitemap.xml');
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
}

async function mapLimit(items, limit, worker) {
  const out = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await worker(items[index]);
      }
    })
  );
  return out;
}

function unified(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 60);
  return `      at char ${i}\n      A: …${a.slice(from, i + CONTEXT)}…\n      B: …${b.slice(from, i + CONTEXT)}…`;
}

/**
 * Refuses to compare against a server that is not working.
 *
 * Without this, a `db` server started WITHOUT DATABASE_URL in its environment
 * reports every DB-backed surface as broken, its sitemap comes back empty, and
 * the diff reads as "101 content differences" — 93 of which are just "present in
 * A only" because B's sitemap was a 500. That is a configuration mistake wearing
 * the costume of a content bug, and it wastes an afternoon. One line here
 * instead.
 *
 * Note the standalone server does NOT read .env.local: `next build` loads it,
 * `node .next/standalone/server.js` does not. DATABASE_URL has to be exported
 * into the shell that starts it.
 */
async function preflight(label, base) {
  const problems = [];

  const sitemap = await get(base, '/sitemap.xml');
  if (sitemap.status !== 200) {
    problems.push(`/sitemap.xml returned ${sitemap.status}${sitemap.error ? ` (${sitemap.error})` : ''}`);
  } else if (!/<loc>/.test(sitemap.body)) {
    problems.push('/sitemap.xml returned 200 but contains no <loc> entries');
  }

  const home = await get(base, '/en');
  if (home.status !== 200) problems.push(`/en returned ${home.status}`);

  if (problems.length) {
    console.error(`\n  ${label} (${base}) is not serving correctly:`);
    for (const problem of problems) console.error(`    - ${problem}`);
    console.error(
      '\n  Most likely: the server was started without DATABASE_URL in its environment.\n' +
        '  The standalone server does not read .env.local — `next build` does, which is why\n' +
        '  prerendered pages look fine while anything that revalidates 500s. Start it with:\n\n' +
        '    DATABASE_URL="$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" \\\n' +
        '    PUBLIC_CONTENT_SOURCE=db PORT=3102 node .next/standalone/server.js\n'
    );
    return false;
  }
  return true;
}

async function main() {
  console.log(`A (expected: code) ${A}\nB (expected: db)   ${B}\n`);

  const [okA, okB] = [await preflight('A', A), await preflight('B', B)];
  if (!okA || !okB) process.exit(2);

  const [pathsA, pathsB] = await Promise.all([sitemapPaths(A), sitemapPaths(B)]);

  // The UNION, deliberately. A URL present on one side only is an immediate
  // failure — that is what catches a product the seed dropped, before any
  // content comparison runs and finds nothing to compare.
  const setA = new Set(pathsA);
  const setB = new Set(pathsB);
  const onlyA = pathsA.filter((p) => !setB.has(p));
  const onlyB = pathsB.filter((p) => !setA.has(p));

  const failures = [];
  for (const path of onlyA) failures.push({ path, field: 'sitemap', detail: 'present in A only' });
  for (const path of onlyB) failures.push({ path, field: 'sitemap', detail: 'present in B only' });

  // Every sitemap URL from either side, plus every product and product-legal URL
  // in every locale, so an unlisted-but-live page is compared too.
  const extra = new Set();
  for (const path of [...setA, ...setB]) {
    const match = path.match(/^\/(en|es|ca)(\/.*)?$/);
    if (!match) continue;
    for (const locale of LOCALES) extra.add(`/${locale}${match[2] ?? ''}`);
  }
  const paths = [...new Set([...setA, ...setB, ...extra])].sort();

  // Warm both caches first.
  //
  // These routes are ISR. The FIRST request to a path generates it, and
  // generation is when React streams — which is what produces the boundary
  // markers above, at whatever moment each query happens to resolve. Every
  // request after that serves the finished, cached HTML: no streaming, no
  // markers, and identical to what a real visitor gets.
  //
  // So warming is not a workaround for a flaky comparison, it IS the correct
  // comparison. Two passes because stale-while-revalidate can serve the previous
  // entry while regenerating.
  console.log(`Warming ${paths.length} URLs on both servers…`);
  for (let pass = 0; pass < 2; pass++) {
    await mapLimit(paths, CONCURRENCY, async (path) => {
      await Promise.all([get(A, path), get(B, path)]);
    });
  }

  console.log(`Comparing ${paths.length} URLs…`);

  await mapLimit(paths, CONCURRENCY, async (path) => {
    const [ra, rb] = await Promise.all([get(A, path), get(B, path)]);

    if (ra.status !== rb.status) {
      failures.push({ path, field: 'status', detail: `A=${ra.status} B=${rb.status}` });
      return;
    }
    if (ra.status !== 200) return;

    const ma = mainOf(ra.body);
    const mb = mainOf(rb.body);
    if (ma === null || mb === null) {
      failures.push({ path, field: '<main>', detail: `missing main-content anchor (A=${ma !== null} B=${mb !== null})` });
      return;
    }
    if (ma !== mb) failures.push({ path, field: '<main>', detail: unified(ma, mb) });

    // Navbar + footer. Both render product names, taglines and links from the
    // same source as the page body, so they get the same scrutiny.
    const ca = chromeOf(ra.body);
    const cb = chromeOf(rb.body);
    if (ca === null || cb === null) {
      failures.push({ path, field: 'chrome', detail: `missing <body> (A=${ca !== null} B=${cb !== null})` });
    } else if (ca !== cb) {
      failures.push({ path, field: 'chrome (navbar/footer)', detail: unified(ca, cb) });
    }

    const fa = metaFacts(ra.body);
    const fb = metaFacts(rb.body);
    for (const key of Object.keys(fa)) {
      const va = JSON.stringify(fa[key]);
      const vb = JSON.stringify(fb[key]);
      if (va !== vb) failures.push({ path, field: key, detail: `      A: ${va}\n      B: ${vb}` });
    }

    const ha = JSON.stringify(hrefsOf(ma));
    const hb = JSON.stringify(hrefsOf(mb));
    if (ha !== hb) failures.push({ path, field: 'hrefs', detail: `      A: ${ha}\n      B: ${hb}` });
  });

  if (failures.length) {
    // One full example PER FIELD, not the first three overall. A run where the
    // chrome differs on every page would otherwise spend all three slots on
    // chrome and never show the <main> diff that actually matters — which is
    // exactly what happened the first time this ran for real.
    const byField = new Map();
    for (const failure of failures) {
      if (!byField.has(failure.field)) byField.set(failure.field, []);
      byField.get(failure.field).push(failure);
    }

    console.error(`\n${failures.length} difference(s) across ${byField.size} field(s).\n`);
    for (const [field, group] of byField) {
      console.error(`  ${field} — ${group.length} URL(s), e.g. ${group[0].path}:`);
      console.error(`${group[0].detail}\n`);
    }

    console.error('  All affected URLs:');
    for (const [field, group] of byField) {
      console.error(`    ${field}: ${group.map((failure) => failure.path).join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`\n  Zero differences across ${paths.length} URLs. Safe to flip PUBLIC_CONTENT_SOURCE.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
