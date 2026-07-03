import type { Meta, StoryObj } from '@storybook/react';

import { Card, FeatureCard, ProductCard, ProductStatusBadge, StatCard } from './index';

const meta = {
  title: 'Design System/Data',
  component: Card,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Cards: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>Card</Card>
      <Card interactive>Interactive Card</Card>
      <FeatureCard title="Feature" description="Short supporting description." />
      <ProductCard title="Product" description="Product summary." />
      <StatCard value="128" label="Stat label" />
      <div className="flex flex-wrap gap-2">
        <ProductStatusBadge status="teaser">Launching soon</ProductStatusBadge>
        <ProductStatusBadge status="beta">Beta</ProductStatusBadge>
        <ProductStatusBadge status="live">Live</ProductStatusBadge>
        <ProductStatusBadge status="alpha">Private alpha</ProductStatusBadge>
        <ProductStatusBadge status="deprecated">Deprecated</ProductStatusBadge>
        <ProductStatusBadge status="archived">Archived</ProductStatusBadge>
      </div>
    </div>
  )
};
