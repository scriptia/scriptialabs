import type { Meta, StoryObj } from '@storybook/react';

import { Container, Grid, Section, Stack, Surface } from './index';

const meta = {
  title: 'Design System/Surfaces',
  component: Surface,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Containers: Story = {
  render: () => (
    <div className="grid gap-4">
      <Container size="reading"><Surface className="p-4">Reading Container</Surface></Container>
      <Container size="content"><Surface className="p-4">Content Container</Surface></Container>
      <Container size="hero"><Surface className="p-4">Hero Container</Surface></Container>
    </div>
  )
};

export const LayoutPrimitives: Story = {
  render: () => (
    <Section>
      <Stack gap="lg">
        <Grid cols={3}>
          <Surface className="p-4">One</Surface>
          <Surface className="p-4">Two</Surface>
          <Surface className="p-4">Three</Surface>
        </Grid>
        <Surface elevated className="p-4">Elevated Surface</Surface>
      </Stack>
    </Section>
  )
};
