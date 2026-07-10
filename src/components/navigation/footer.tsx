import * as React from 'react';
import Link from 'next/link';

import { Container, Grid, Section, Stack } from '@/components/surfaces';
import { Divider } from '@/components/primitives';
import { Logo } from '@/components/media/logo';
import { contentSite } from '@/content/site';
import type { Locale } from '@/lib/i18n/routing';
import { localizePath } from '@/lib/routing/paths';

export type FooterLink = Readonly<{
  label: string;
  href: string;
  external?: boolean;
}>;

export type FooterGroup = Readonly<{
  title: string;
  items: FooterLink[];
}>;

export type FooterProps = Readonly<{
  locale: Locale;
  logoLabel: string;
  description: string;
  groups: FooterGroup[];
  localeLinks: { locale: Locale; label: string; href: string }[];
  copyright: string;
  contactLink: FooterLink;
}>;

export function Footer({ locale, logoLabel, description, groups, localeLinks, copyright, contactLink }: FooterProps) {
  return (
    <footer className="border-t border-border bg-background">
      <Section spacing="lg">
        <Container size="content">
          <Stack gap="xl">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
              <Stack gap="sm">
                <Logo label={logoLabel} className="text-body text-text-primary" />
                <p className="max-w-reading text-body-small text-text-secondary">{description || contentSite.description}</p>
                <div className="flex flex-wrap gap-3">
                  <Link className="rounded-pill border border-border bg-surface px-4 py-2 text-body-small font-medium text-text-primary transition-colors hover:bg-surface-subtle" href={localizePath(locale, contactLink.href)}>
                    {contactLink.label}
                  </Link>
                </div>
              </Stack>

              <Grid cols={4} gap="lg">
                {groups.map((group) => (
                  <Stack key={group.title} gap="sm">
                    <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{group.title}</div>
                    <div className="grid gap-2">
                      {group.items.map((item) =>
                        item.external ? (
                          <a key={item.href} href={item.href} className="text-body-small text-text-secondary transition-colors hover:text-text-primary" target="_blank" rel="noreferrer">
                            {item.label}
                          </a>
                        ) : (
                          <Link key={item.href} href={localizePath(locale, item.href)} className="text-body-small text-text-secondary transition-colors hover:text-text-primary">
                            {item.label}
                          </Link>
                        )
                      )}
                    </div>
                  </Stack>
                ))}
              </Grid>
            </div>

            <Divider />

            <div className="flex flex-col gap-4 text-body-small text-text-tertiary md:flex-row md:items-center md:justify-between">
              <div>{copyright}</div>
              <div className="flex flex-wrap gap-3">
                {localeLinks.map((item) => (
                  <Link key={item.locale} href={item.href} className="transition-colors hover:text-text-primary" lang={item.locale}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </Stack>
        </Container>
      </Section>
    </footer>
  );
}
