import type { Meta, StoryObj } from '@storybook/react';

import { Body, Code, Display, Heading, Label, Typography } from './index';

const meta = {
  title: 'Design System/Typography',
  component: Display,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const DisplayScale: Story = {
  render: () => (
    <div className="grid gap-4">
      <Display level="xl">Display XL</Display>
      <Display level="l">Display L</Display>
      <Display level="m">Display M</Display>
    </div>
  )
};

export const HeadingsAndBody: Story = {
  render: () => (
    <Typography className="grid gap-4">
      <Heading level={1}>Heading 1</Heading>
      <Heading level={2}>Heading 2</Heading>
      <Heading level={3}>Heading 3</Heading>
      <Body size="large">Body Large</Body>
      <Body>Body</Body>
      <Body size="small">Body Small</Body>
      <Body size="caption">Caption</Body>
      <Label htmlFor="code">Label</Label>
      <Code id="code">Code</Code>
    </Typography>
  )
};
