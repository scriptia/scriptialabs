import * as React from 'react';

import { Button } from '@/components/primitives';
import { Body, Display } from '@/components/typography';
import { Container, Section, Stack } from '@/components/surfaces';
import { ProductStatusBadge } from '@/components/data';
import { productAccentTextClassName, type ProductAccent } from '@/design/theme';
import type { ProductStatus } from '@/content/products';

export type ProductHeroAction = {
  label: string;
  href: string;
  external?: boolean;
};

export type ProductHeroProps = Readonly<{
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  accent: ProductAccent;
  status: ProductStatus;
  statusLabel: string;
  primary: ProductHeroAction;
  secondary?: ProductHeroAction;
}>;

const accentGradientVar: Record<ProductAccent, string> = {
  scriptia: '--color-product-scriptia',
  padelco: '--color-product-padelco',
  'voice-agents': '--color-product-voice-agents',
  speaklio: '--color-product-speaklio'
};

// The one section every product page shares in identical structure but
// distinct color: title/status/CTA is the same information architecture
// across Scriptia/Padelco/Voice Agents, tinted by the product's own accent
// token rather than the shared brand color used on the homepage hero.
export function ProductHero({ eyebrow, title, description, accent, status, statusLabel, primary, secondary }: ProductHeroProps) {
  return (
    <Section spacing="lg" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 55% at 50% -10%, hsl(var(${accentGradientVar[accent]}) / 0.16), transparent 70%)`
        }}
      />
      <Container size="hero">
        <Stack gap="lg" align="center" className="text-center">
          <div className={`text-caption font-medium uppercase tracking-[0.14em] ${productAccentTextClassName[accent]}`}>{eyebrow}</div>
          <Display level="l" className="max-w-[20ch]">
            {title}
          </Display>
          <Body size="large" className="max-w-reading text-text-secondary">
            {description}
          </Body>
          <ProductStatusBadge status={status}>{statusLabel}</ProductStatusBadge>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button size="lg" asChild>
              {primary.external ? (
                <a href={primary.href} target="_blank" rel="noreferrer">
                  {primary.label}
                </a>
              ) : (
                <a href={primary.href}>{primary.label}</a>
              )}
            </Button>
            {secondary ? (
              <Button size="lg" variant="secondary" asChild>
                {secondary.external ? (
                  <a href={secondary.href} target="_blank" rel="noreferrer">
                    {secondary.label}
                  </a>
                ) : (
                  <a href={secondary.href}>{secondary.label}</a>
                )}
              </Button>
            ) : null}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
