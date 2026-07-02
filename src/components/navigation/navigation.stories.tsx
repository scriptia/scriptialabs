import type { Meta, StoryObj } from '@storybook/react';

import { Breadcrumb, Dropdown, Footer, LanguageSwitcher, Navbar, Popover, ThemeToggle, Tooltip } from './index';

const meta = {
  title: 'Design System/Navigation',
  component: Navbar,
  tags: ['autodocs']
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const NavigationSurface: Story = {
  render: () => (
    <div className="grid gap-4">
      <Navbar>Navbar</Navbar>
      <Breadcrumb items={[{ label: 'Home' }, { label: 'Section' }]} />
      <div className="flex gap-3"><Dropdown>Dropdown</Dropdown><Popover>Popover</Popover><Tooltip label="Tooltip">Tooltip trigger</Tooltip><ThemeToggle /></div>
      <LanguageSwitcher items={[{ locale: 'en', label: 'English', href: '/en' }, { locale: 'es', label: 'Español', href: '/es' }, { locale: 'ca', label: 'Català', href: '/ca' }]} />
      <Footer>Footer</Footer>
    </div>
  )
};
