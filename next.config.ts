import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enables the minimal, self-contained server bundle (server.js + a
  // pruned node_modules) that the Docker production stage copies out,
  // instead of shipping the full node_modules tree at runtime.
  output: 'standalone',
  // src/server/content-engine/carousel-playbook.ts reads this file via
  // fs.readFile at runtime, not import/require, so it's invisible to
  // Next's normal module-graph tracing for `output: standalone` — the
  // same class of gap that bit the old Python backend's build context
  // earlier in this migration. Confirmed by building WITHOUT this entry
  // first: `@vercel/nft`'s static-literal-path heuristic happened to
  // pick up the `path.join(process.cwd(), '...')` call anyway and it
  // still worked, but that's an implicit inference, not a guarantee —
  // don't rely on it surviving a refactor. Glob key is a route pattern,
  // value is glob(s) resolved from the project root.
  outputFileTracingIncludes: {
    '/**': ['./skills/carousel-production/carousel-playbook.md']
  }
  // typedRoutes disabled: the nav/content model (src/content/navigation,
  // src/content/products) types hrefs as plain `string`, driven by data,
  // not literal route unions. Re-enable once real routes exist and the
  // content layer is migrated to typed route literals.
};

export default withNextIntl(nextConfig);