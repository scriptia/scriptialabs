'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/routing';
import { productAccentBackgroundClassName, type ProductAccent } from '@/design/theme';
import { publicProductStatusOrder, type ProductStatus } from '@/content/products';

export type ProductMenuItem = Readonly<{
  label: string;
  href: string;
  description?: string;
  status?: ProductStatus;
  statusLabel?: string;
  accent?: ProductAccent;
  external?: boolean;
}>;

export type ProductMenuGroup = Readonly<{
  status: ProductStatus | null;
  label: string;
  items: ProductMenuItem[];
}>;

/**
 * Products bucketed by status, shipped first.
 *
 * The list arrives in `products.createdAt` order, which is stable but says
 * nothing a visitor cares about — a two-year-old draft sat above the thing we
 * actually launched. Grouping is also what makes the menu fit: headings let the
 * items run two-up without losing which status each one is.
 *
 * Anything with no status, or a status outside the public order (only
 * `archived`, which cannot be published anyway), falls into a trailing group
 * rather than disappearing — a menu that silently drops a product is how you get
 * a page nothing links to.
 */
export function groupProductMenuItems(items: readonly ProductMenuItem[]): ProductMenuGroup[] {
  const groups: ProductMenuGroup[] = [];

  for (const status of publicProductStatusOrder) {
    const matching = items.filter((item) => item.status === status);

    if (matching.length > 0) {
      // The label is the translated one the server already resolved per item;
      // taking it from the first member keeps this component free of next-intl.
      groups.push({ status, label: matching[0].statusLabel ?? status, items: matching });
    }
  }

  const grouped = new Set(groups.flatMap((group) => group.items));
  const rest = items.filter((item) => !grouped.has(item));

  if (rest.length > 0) {
    groups.push({ status: null, label: 'Other', items: rest });
  }

  return groups;
}

export type ProductMenuEntryProps = Readonly<{
  item: ProductMenuItem;
  locale: Locale;
  variant: 'menu' | 'drawer';
  onNavigate?: () => void;
}>;

/**
 * One product row, in the dropdown or the mobile drawer.
 *
 * This body used to exist three times — the menu's external branch, its internal
 * branch, and the drawer's copy in navbar.tsx — which is why the accent dot and
 * the description had to be kept in sync by hand.
 *
 * No status badge: the group heading above it carries the status now, and the
 * old per-item badge labelled `live` products too, which `badgedProductStatuses`
 * says is not news worth a badge.
 */
export function ProductMenuEntry({ item, locale, variant, onNavigate }: ProductMenuEntryProps) {
  const className = cn(
    'block rounded-lg text-left transition-colors',
    variant === 'drawer' ? 'border border-border bg-surface px-4 py-3 hover:bg-surface-subtle' : 'px-3 py-2 hover:bg-surface-subtle'
  );

  const body = (
    <>
      <div className="flex items-center gap-2 text-body-small font-medium text-text-primary">
        {item.accent ? <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', productAccentBackgroundClassName[item.accent])} /> : null}
        <span className="truncate">{item.label}</span>
      </div>
      {/* Clamped, and harder in the dropdown than in the drawer. Taglines run
          past a hundred characters, so at half the panel's width an unclamped
          one wraps to four lines and ten products stop fitting on screen — the
          drawer scrolls, so it can afford two. */}
      {item.description ? (
        <div className={cn('mt-0.5 text-body-small text-text-secondary', variant === 'drawer' ? 'line-clamp-2' : 'line-clamp-1')}>{item.description}</div>
      ) : null}
    </>
  );

  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={className} onClick={onNavigate}>
      {body}
    </a>
  ) : (
    <Link href={`/${locale}${item.href === '/' ? '' : item.href}`} className={className} onClick={onNavigate}>
      {body}
    </Link>
  );
}

/** The caption above each group, shared so the menu and the drawer read alike. */
export function ProductMenuGroupHeading({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="px-3 pb-1 pt-2 text-caption font-medium uppercase tracking-[0.08em] text-text-tertiary">{children}</div>;
}
