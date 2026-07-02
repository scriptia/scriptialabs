import type { Meta, StoryObj } from '@storybook/react';

import { Footer, LanguageSwitcher, Navbar, ThemeToggle } from './index';

const meta = {
  title: 'Design System/Layout',
  component: Navbar,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Shell: Story = {
  render: () => (
    <div className="grid gap-4">
      <Navbar>Navigation</Navbar>
      <LanguageSwitcher items={[{ locale: 'en', label: 'English', href: '/en' }]} />
      <ThemeToggle />
      <Footer>Footer</Footer>
    </div>
  )
};
