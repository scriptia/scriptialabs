import { ImageResponse } from 'next/og';

import { contentSite } from '@/content/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Satori can't read CSS variables, so the Idion palette is spelled out here:
// navy field #040915, ring white, sage core #97A592 (see src/styles/global.css).
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
          gap: 64,
          backgroundColor: '#040915',
          color: '#ffffff'
        }}
      >
        <svg width="260" height="260" viewBox="0 0 100 100" fill="none">
          <path d="M 85.24 20.43 A 46 46 0 1 1 75.05 11.42" stroke="#FFFFFF" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="25" stroke="#FFFFFF" strokeWidth="3.6" />
          <circle cx="50" cy="50" r="8.25" fill="#97A592" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 300, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{contentSite.name}</div>
          <div style={{ fontSize: 26, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#A8AEBC' }}>AI Venture Studio</div>
        </div>
      </div>
    ),
    size
  );
}
