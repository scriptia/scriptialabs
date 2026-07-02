import type { Meta, StoryObj } from '@storybook/react';

import { Accordion, Drawer, Loader, Modal, SectionHeading, Tabs, Toast } from './index';

const meta = {
  title: 'Design System/Display',
  component: SectionHeading,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Surfaces: Story = {
  render: () => (
    <div className="grid gap-4">
      <SectionHeading eyebrow="Label" title="Section heading" description="Supporting description." />
      <Accordion items={[{ title: 'Accordion', content: 'Content' }]} />
      <Tabs items={[{ id: 'a', label: 'Tab A', panel: 'Panel' }]} />
      <div className="flex gap-4"><Loader /><Modal open>Modal</Modal><Drawer open>Drawer</Drawer><Toast>Toast</Toast></div>
    </div>
  )
};
