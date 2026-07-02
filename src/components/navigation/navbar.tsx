'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button, Divider } from '@/components/primitives';
import { Container, Stack } from '@/components/surfaces';
import { Drawer } from '@/components/display';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { ProductMenu, type ProductMenuItem } from './product-menu';
import { cn } from '@/lib/utils';
import { isPathActive } from '@/lib/routing/paths';
import type { Locale } from '@/lib/i18n/routing';

export type NavbarLink = Readonly<{
  label: string;
  href: string;
  external?: boolean;
}>;

export type NavbarLocaleLink = Readonly<{
  locale: Locale;
  label: string;
  href: string;
}>;

export type NavbarProps = Readonly<{
  locale: Locale;
  logoLabel: string;
  primaryLinks: NavbarLink[];
  productLinks: ProductMenuItem[];
  localeLinks: NavbarLocaleLink[];
  contactLink: NavbarLink;
  productMenuLabel: string;
  languageLabel: string;
  themeLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
}>;

export function Navbar({
  locale,
  logoLabel,
  primaryLinks,
  productLinks,
  localeLinks,
  contactLink,
  productMenuLabel,
  languageLabel,
  themeLabel,
  openMenuLabel,
  closeMenuLabel
}: NavbarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const mobileLinks = [...primaryLinks, contactLink];

  return (
    <header className={cn('sticky top-0 z-50 px-4 pt-4 transition-all duration-200 md:px-6', scrolled && 'pt-3')}>
      <Container size="hero">
        <div
          className={cn(
            'rounded-xl border border-border/70 bg-surface/80 px-4 py-3 shadow-low backdrop-blur-2xl transition-all duration-200',
            scrolled && 'bg-surface/90 shadow-medium'
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <Link href={`/${locale}`} className="inline-flex items-center gap-3 rounded-pill px-1 py-1 text-body font-medium text-text-primary transition-colors hover:text-brand">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-text-inverse">S</span>
              <span>{logoLabel}</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
              <ProductMenu locale={locale} label={productMenuLabel} items={productLinks} />
              {primaryLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.external ? item.href : `/${locale}${item.href === '/' ? '' : item.href}`}
                  className={cn(
                    'rounded-pill px-3 py-2 text-body-small font-medium transition-colors',
                    isPathActive(pathname, item.href, locale) ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <LanguageSwitcher items={localeLinks} ariaLabel={languageLabel} />
              <ThemeToggle aria-label={themeLabel} />
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/${locale}${contactLink.href === '/' ? '' : contactLink.href}`}>{contactLink.label}</Link>
              </Button>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle aria-label={themeLabel} />
              <Button variant="ghost" size="sm" aria-label={openMenuLabel} onClick={() => setMobileOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
            <div className="mx-auto w-full max-w-lg p-4">
              <Stack gap="lg">
                <div className="flex items-center justify-between">
                  <div className="text-body font-medium text-text-primary">{logoLabel}</div>
                  <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
                    {closeMenuLabel}
                  </Button>
                </div>

                <div className="grid gap-3">
                  <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{productMenuLabel}</div>
                  {productLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={`/${locale}${item.href === '/' ? '' : item.href}`}
                      className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-subtle"
                    >
                      <div className="text-body-small font-medium text-text-primary">{item.label}</div>
                      {item.description ? <div className="mt-1 text-body-small text-text-secondary">{item.description}</div> : null}
                    </Link>
                  ))}
                </div>

                <Divider />

                <nav className="grid gap-2" aria-label="Mobile navigation">
                  {mobileLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.external ? item.href : `/${locale}${item.href === '/' ? '' : item.href}`}
                      className={cn(
                        'rounded-lg px-3 py-3 text-body-small font-medium transition-colors',
                        isPathActive(pathname, item.href, locale) ? 'bg-surface-subtle text-text-primary' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                      )}
                      target={item.external ? '_blank' : undefined}
                      rel={item.external ? 'noreferrer' : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="grid gap-3">
                  <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{languageLabel}</div>
                  <LanguageSwitcher items={localeLinks} ariaLabel={languageLabel} />
                </div>
              </Stack>
            </div>
          </Drawer>
        </div>
      </Container>
    </header>
  );
}
