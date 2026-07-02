import type { Meta, StoryObj } from '@storybook/react';

import { Card, FeatureCard, ProductCard, StatCard } from './index';

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
    </div>
  )
};
