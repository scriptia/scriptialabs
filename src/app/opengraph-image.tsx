import { ImageResponse } from 'next/og';

import { contentSite } from '@/content/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f1115',
          color: '#ffffff',
          fontSize: 64,
          fontWeight: 600
        }}
      >
        {contentSite.name}
      </div>
    ),
    size
  );
}
