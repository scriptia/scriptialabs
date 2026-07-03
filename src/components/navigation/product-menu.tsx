'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import { ProductStatusBadge } from '@/components/data';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/routing';
import { isPathActive } from '@/lib/routing/paths';
import { motionPresets } from '@/lib/motion';
import { productAccentBackgroundClassName, type ProductAccent } from '@/design/theme';
import type { ProductStatus } from '@/content/products';
import { usePathname } from 'next/navigation';

export type ProductMenuItem = Readonly<{
  label: string;
  href: string;
  description?: string;
  status?: ProductStatus;
  statusLabel?: string;
  accent?: ProductAccent;
  external?: boolean;
}>;

export type ProductMenuProps = Readonly<{
  locale: Locale;
  label: string;
  items: ProductMenuItem[];
}>;

export function ProductMenu({ locale, label, items }: ProductMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const active = items.some((item) => !item.external && isPathActive(pathname, item.href, locale));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex items-center gap-2 rounded-pill px-3 py-2 text-body-small font-medium transition-colors',
          active || open ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        {label}
        <span aria-hidden="true" className="text-[0.7em]">▾</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            className="absolute left-0 top-full z-50 mt-3 w-[20rem] rounded-xl border border-border bg-surface-elevated p-2 shadow-high backdrop-blur-xl"
            {...motionPresets.scale}
          >
            <div className="grid gap-2">
              {items.map((item) =>
                item.external ? (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-subtle"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-body-small font-medium text-text-primary">
                        {item.accent ? <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', productAccentBackgroundClassName[item.accent])} /> : null}
                        {item.label}
                      </div>
                      {item.status && item.statusLabel ? <ProductStatusBadge status={item.status}>{item.statusLabel}</ProductStatusBadge> : null}
                    </div>
                    {item.description ? <div className="mt-1 text-body-small text-text-secondary">{item.description}</div> : null}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={`/${locale}${item.href === '/' ? '' : item.href}`}
                    className="rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-subtle"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-body-small font-medium text-text-primary">
                        {item.accent ? <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', productAccentBackgroundClassName[item.accent])} /> : null}
                        {item.label}
                      </div>
                      {item.status && item.statusLabel ? <ProductStatusBadge status={item.status}>{item.statusLabel}</ProductStatusBadge> : null}
                    </div>
                    {item.description ? <div className="mt-1 text-body-small text-text-secondary">{item.description}</div> : null}
                  </Link>
                )
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
