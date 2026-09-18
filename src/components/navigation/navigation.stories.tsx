import type { Meta, StoryObj } from '@storybook/react';

import { Breadcrumb, Footer, LanguageSwitcher, Navbar, ThemeToggle, Tooltip } from './index';

const meta: Meta = {
  title: 'Design System/Navigation',
  component: Navbar,
  tags: ['autodocs']
};

export default meta;

type Story = StoryObj<typeof meta>;

// Spans four statuses on purpose: the dropdown groups by status and runs its
// items two-up, so an empty list (what this story used to pass) exercised none
// of it.
const productLinks = [
  { label: 'Accento', href: '/accento', description: 'Pronunciation coaching that listens back.', status: 'live' as const, statusLabel: 'Live', accent: 'auto-1' as const },
  { label: 'Nailio', href: '/nailio', description: 'Nail-care routines that survive a real week.', status: 'live' as const, statusLabel: 'Live', accent: 'auto-2' as const },
  { label: 'Bravo', href: '/bravo', description: 'Rehearsal tracking for performers.', status: 'beta' as const, statusLabel: 'Public beta', accent: 'auto-3' as const },
  { label: 'Kettle', href: '/kettle', description: 'In front of a few people.', status: 'alpha' as const, statusLabel: 'Private alpha', accent: 'auto-4' as const },
  { label: 'Vantage', href: '/vantage', description: 'Coming soon.', status: 'teaser' as const, statusLabel: 'Launching soon', accent: 'auto-5' as const }
];

const navbarProps = {
  locale: 'en' as const,
  logoLabel: 'Scriptia Labs',
  primaryLinks: [{ label: 'Products', href: '/products' }],
  productLinks,
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
