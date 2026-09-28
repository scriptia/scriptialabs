import * as React from 'react';
import { ArrowRight } from 'lucide-react';

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
  /** The app's name, shown on the device card. Without it the card is omitted. */
  productName?: string;
  /** Up to three headline capabilities, listed on the device card's screen. */
  highlights?: string[];
}>;

const accentGradientVar: Record<ProductAccent, string> = {
  scriptia: '--color-product-scriptia',
  padelco: '--color-product-padelco',
  'voice-agents': '--color-product-voice-agents',
  speaklio: '--color-product-speaklio',
  accento: '--color-product-accento',
  nailio: '--color-product-nailio',
  bravo: '--color-product-bravo',
  'auto-1': '--color-product-auto-1',
  'auto-2': '--color-product-auto-2',
  'auto-3': '--color-product-auto-3',
  'auto-4': '--color-product-auto-4',
  'auto-5': '--color-product-auto-5',
  'auto-6': '--color-product-auto-6'
};

// Forwards className and aria props: Button's `asChild` clones its styling
// onto this element, so dropping them would render an unstyled link.
function ActionLink({ action, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { action: ProductHeroAction }) {
  return action.external ? (
    <a href={action.href} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ) : (
    <a href={action.href} {...props}>
      {children}
    </a>
  );
}

// The one section every product page shares in identical structure but
// distinct color: title/status/CTA is the same information architecture for
// every app, tinted by the product's own accent token. The right-hand device
// card sells the app as an app — its icon, its name and what it does — before
// the reader scrolls a single line.
export function ProductHero({ eyebrow, title, description, accent, status, statusLabel, primary, secondary, productName, highlights = [] }: ProductHeroProps) {
  const accentVar = accentGradientVar[accent];

  return (
    <Section spacing="lg" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 78% 30%, hsl(var(${accentVar}) / 0.16), transparent 70%)`
        }}
      />
      <Container size="hero" className="relative">
        <div className={productName ? 'grid items-center gap-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : ''}>
          <Stack gap="lg" align={productName ? 'start' : 'center'} className={productName ? 'text-left' : 'text-center'}>
            <div className={`text-caption font-semibold uppercase tracking-[0.16em] ${productAccentTextClassName[accent]}`}>{eyebrow}</div>
            <Display level="l" className="max-w-[18ch] text-balance">
              {title}
            </Display>
            <Body size="large" className="max-w-reading text-text-secondary">
              {description}
            </Body>
            <ProductStatusBadge status={status}>{statusLabel}</ProductStatusBadge>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" className="px-7" asChild>
                <ActionLink action={primary}>
                  {primary.label}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </ActionLink>
              </Button>
              {secondary ? (
                <Button size="lg" variant="secondary" asChild>
                  <ActionLink action={secondary}>{secondary.label}</ActionLink>
                </Button>
              ) : null}
            </div>
          </Stack>

          {productName ? (
            <div aria-hidden="true" className="relative mx-auto w-full max-w-[18rem]">
              <div
                className="absolute -inset-10 rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle, hsl(var(${accentVar}) / 0.28), transparent 70%)` }}
              />
              <div className="relative aspect-[9/18.5] rounded-[2.75rem] border border-border-strong bg-surface p-3 shadow-high">
                <div className="flex h-full flex-col overflow-hidden rounded-[2.1rem] bg-background">
                  <div className="h-40 shrink-0" style={{ background: `linear-gradient(160deg, hsl(var(${accentVar})), hsl(var(${accentVar}) / 0.55))` }}>
                    <div className="mx-auto mt-3 h-5 w-20 rounded-full bg-text-primary/90" />
                  </div>
                  <div className="-mt-10 flex flex-1 flex-col px-5">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] border-4 border-background text-[2rem] font-semibold text-text-inverse shadow-medium"
                      style={{ background: `hsl(var(${accentVar}))` }}
                    >
                      {productName.charAt(0).toUpperCase()}
                    </div>
                    <div className="mt-3 text-h3 font-semibold text-text-primary">{productName}</div>
                    <div className="mt-4 grid gap-2.5">
                      {highlights.slice(0, 3).map((highlight) => (
                        <div key={highlight} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(var(${accentVar}))` }} />
                          <span className="truncate text-caption font-medium text-text-secondary">{highlight}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mb-6 mt-auto h-11 rounded-full" style={{ background: `hsl(var(${accentVar}))` }} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
