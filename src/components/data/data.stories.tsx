import type { Meta, StoryObj } from '@storybook/react';

import { Card, FeatureCard, ProductCard, ProductStatusBadge, StatCard, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from './index';

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

export const Tables: Story = {
  render: () => (
    <div className="grid gap-8">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Owner</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow interactive>
            <TableCell>Scriptia</TableCell>
            <TableCell>
              <ProductStatusBadge status="live">Live</ProductStatusBadge>
            </TableCell>
            <TableCell>Martí</TableCell>
          </TableRow>
          <TableRow interactive>
            <TableCell>Padelco</TableCell>
            <TableCell>
              <ProductStatusBadge status="teaser">Launching soon</ProductStatusBadge>
            </TableCell>
            <TableCell>Unassigned</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableEmpty colSpan={2}>No records match these filters.</TableEmpty>
        </TableBody>
      </Table>
    </div>
  )
};
