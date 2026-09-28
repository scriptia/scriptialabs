import type { MetadataRoute } from 'next';

import { contentSite } from '@/content/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: contentSite.name,
    short_name: 'Idion',
    description: contentSite.description,
    start_url: '/',
    display: 'standalone',
    // Idion navy — the logo's field (--color-background).
    background_color: '#040915',
    theme_color: '#040915',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  };
}
