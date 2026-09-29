import type { Meta, StoryObj } from '@storybook/react';

import { ProductHero, ProductScreenshots, StoreBadges } from './index';

const meta: Meta = {
  title: 'Design System/Product',
  component: ProductHero,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Hero: Story = {
  render: () => (
    <ProductHero
      eyebrow="An Idion Labs app"
      title="An AI writing companion for editorial work."
      description="Scriptia helps writers and editorial teams draft, structure, and refine long-form work without losing their voice."
      accent="scriptia"
      status="live"
      statusLabel="Live"
      primary={{ label: 'Visit Scriptia', href: 'https://scriptiastories.com', external: true }}
      secondary={{ label: 'See how it works', href: '#how-it-works' }}
    />
  )
};

export const HeroTeaser: Story = {
  render: () => (
    <ProductHero
      eyebrow="An Idion Labs app"
      title="An AI coach for padel players."
      description="Padelco brings structured, AI-driven coaching to padel training — launching soon."
      accent="padelco"
      status="teaser"
      statusLabel="Launching soon"
      primary={{ label: 'Get notified', href: '#status' }}
    />
  )
};

// Stand-ins for imported App Store images, so the stories render offline.
const svg = (width: number, height: number, body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)}`;

const icon = svg(
  1024,
  1024,
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><text x="512" y="640" font-size="480" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="700">S</text>'
);

const screenshot = (index: number) => ({
  url: svg(
    1290,
    2796,
    `<rect width="1290" height="2796" fill="hsl(${250 + index * 22} 70% 60%)"/><rect x="90" y="360" width="1110" height="700" rx="80" fill="white" fill-opacity="0.25"/><text x="645" y="1800" font-size="300" text-anchor="middle" fill="white" font-family="sans-serif">${index + 1}</text>`
  ),
  width: 1290,
  height: 2796
});

const screenshots = (count: number) => Array.from({ length: count }, (_, index) => screenshot(index));

const badgeLabels = { appStore: 'Download on the App Store', googlePlay: 'Get it on Google Play' };
const appStoreUrl = 'https://apps.apple.com/es/app/example/id123456789';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.example.app';

const shippedHero = {
  eyebrow: 'An Idion Labs app',
  title: 'An AI writing companion for editorial work.',
  description: 'Scriptia helps writers and editorial teams draft, structure, and refine long-form work without losing their voice.',
  accent: 'scriptia',
  status: 'live',
  statusLabel: 'Live',
  primary: { label: 'Get the app', href: '#' },
  secondary: { label: 'See how it works', href: '#overview' },
  productName: 'Scriptia',
  iconUrl: icon,
  screenshotUrl: screenshot(0).url
} as const;

/** The usual shipped state: App Store only. One badge beside the secondary button. */
export const HeroAppStoreOnly: Story = {
  render: () => <ProductHero {...shippedHero} storeBadges={<StoreBadges locale="en" appStoreUrl={appStoreUrl} labels={badgeLabels} />} />
};

export const HeroBothStores: Story = {
  render: () => (
    <ProductHero {...shippedHero} storeBadges={<StoreBadges locale="en" appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} labels={badgeLabels} />} />
  )
};

/** Icon imported but the listing returned no screenshots: the drawn screen, with the real icon. */
export const HeroIconOnly: Story = {
  render: () => (
    <ProductHero
      {...shippedHero}
      screenshotUrl={undefined}
      highlights={['Drafts in your voice', 'Structure long-form work', 'Edit with a second reader']}
      storeBadges={<StoreBadges locale="es" appStoreUrl={appStoreUrl} labels={badgeLabels} />}
    />
  )
};

export const ScreenshotsTwo: Story = {
  render: () => <ProductScreenshots eyebrow="Inside the app" accent="scriptia" productName="Scriptia" screenshots={screenshots(2)} />
};

export const ScreenshotsFive: Story = {
  render: () => <ProductScreenshots eyebrow="Inside the app" accent="scriptia" productName="Scriptia" screenshots={screenshots(5)} />
};

export const ScreenshotsEight: Story = {
  render: () => <ProductScreenshots eyebrow="Inside the app" accent="scriptia" productName="Scriptia" screenshots={screenshots(8)} />
};
