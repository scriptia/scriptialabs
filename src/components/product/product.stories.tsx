import type { Meta, StoryObj } from '@storybook/react';

import { ProductHero } from './index';

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
      eyebrow="Scriptia Labs"
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
      eyebrow="Scriptia Labs"
      title="An AI coach for padel players."
      description="Padelco brings structured, AI-driven coaching to padel training — launching soon."
      accent="padelco"
      status="teaser"
      statusLabel="Launching soon"
      primary={{ label: 'Get notified', href: '#status' }}
    />
  )
};
