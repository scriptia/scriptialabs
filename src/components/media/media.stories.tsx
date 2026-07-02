import type { Meta, StoryObj } from '@storybook/react';

import { Logo, ProductLogo, SocialLinks } from './index';

const meta = {
  title: 'Design System/Media',
  component: Logo,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Identity: Story = {
  render: () => (
    <div className="grid gap-4">
      <Logo />
      <ProductLogo label="Scriptia" />
      <SocialLinks links={[{ label: 'X', href: '#' }, { label: 'LinkedIn', href: '#' }]} />
    </div>
  )
};
