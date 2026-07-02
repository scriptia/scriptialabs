import type { MetadataRoute } from 'next';

import { contentSite } from '@/content/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: contentSite.name,
    short_name: contentSite.name,
    description: contentSite.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6b7338',
    icons: []
  };
}
