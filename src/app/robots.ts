import type { MetadataRoute } from 'next';

import { contentSite } from '@/content/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/internal/']
      }
    ],
    sitemap: `${contentSite.url}/sitemap.xml`
  };
}
