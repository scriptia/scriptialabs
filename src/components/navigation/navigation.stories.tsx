import type { Meta, StoryObj } from '@storybook/react';

import { Breadcrumb, Footer, LanguageSwitcher, Navbar, ThemeToggle, Tooltip } from './index';

const meta: Meta = {
  title: 'Design System/Navigation',
  component: Navbar,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

const navbarProps = {
  locale: 'en' as const,
  logoLabel: 'Scriptia Labs',
  primaryLinks: [{ label: 'Products', href: '/products' }],
  productLinks: [],
  localeLinks: [{ locale: 'en' as const, label: 'English', href: '/en' }],
  contactLink: { label: 'Contact', href: '/contact' },
  productMenuLabel: 'Products',
  languageLabel: 'Language',
  themeLabel: 'Theme',
  openMenuLabel: 'Open menu',
  closeMenuLabel: 'Close menu'
};

const footerProps = {
  locale: 'en' as const,
  logoLabel: 'Scriptia Labs',
  description: 'Software & AI Lab.',
  groups: [{ title: 'Company', items: [{ label: 'About', href: '/about' }] }],
  localeLinks: [{ locale: 'en' as const, label: 'English', href: '/en' }],
  copyright: '© Scriptia Labs',
  contactLink: { label: 'Contact', href: '/contact' }
};

export const NavigationSurface: Story = {
  render: () => (
    <div className="grid gap-4">
      <Navbar {...navbarProps} />
      <Breadcrumb items={[{ label: 'Home' }, { label: 'Section' }]} />
      <div className="flex gap-3">
        <Tooltip label="Helpful context">
          <button type="button" className="rounded-md border border-border px-3 py-2 text-body-small">
            Tooltip trigger
          </button>
        </Tooltip>
        <ThemeToggle />
      </div>
      <LanguageSwitcher items={[{ locale: 'en', label: 'English', href: '/en' }, { locale: 'es', label: 'Español', href: '/es' }, { locale: 'ca', label: 'Català', href: '/ca' }]} currentLocale="en" />
      <Footer {...footerProps} />
    </div>
  )
};
