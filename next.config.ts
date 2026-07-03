import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enables the minimal, self-contained server bundle (server.js + a
  // pruned node_modules) that the Docker production stage copies out,
  // instead of shipping the full node_modules tree at runtime.
  output: 'standalone'
  // typedRoutes disabled: the nav/content model (src/content/navigation,
  // src/content/products) types hrefs as plain `string`, driven by data,
  // not literal route unions. Re-enable once real routes exist and the
  // content layer is migrated to typed route literals.
};

export default withNextIntl(nextConfig);