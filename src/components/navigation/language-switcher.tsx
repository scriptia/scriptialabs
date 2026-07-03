'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import { motionPresets } from '@/lib/motion';
import type { Locale } from '@/lib/i18n/routing';

export type LanguageSwitchItem = {
  locale: Locale;
  label: string;
  href: string;
};

export type LanguageSwitcherProps = Readonly<{
  items: LanguageSwitchItem[];
  currentLocale: Locale;
  className?: string;
  ariaLabel?: string;
}>;

// Same dropdown interaction as ProductMenu (button, click-outside, Escape) —
// kept as its own small implementation rather than extracted into a shared
// primitive yet; see ADR-002 on why this repo doesn't build a generic
// Dropdown ahead of a third real consumer needing one.
export function LanguageSwitcher({ items, currentLocale, className, ariaLabel = 'Language switcher' }: LanguageSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const current = items.find((item) => item.locale === currentLocale) ?? items[0];

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

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-body-small font-medium uppercase transition-colors',
          open ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        {current?.locale}
        <span aria-hidden="true" className="text-[0.7em]">▾</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            aria-label={ariaLabel}
            className="absolute right-0 top-full z-50 mt-2 min-w-[9rem] rounded-xl border border-border bg-surface-elevated p-1.5 shadow-high backdrop-blur-xl"
            {...motionPresets.scale}
          >
            {items.map((item) => (
              <a
                key={item.locale}
                href={item.href}
                lang={item.locale}
                role="menuitemradio"
                aria-checked={item.locale === currentLocale}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-body-small transition-colors hover:bg-surface-subtle',
                  item.locale === currentLocale ? 'font-medium text-text-primary' : 'text-text-secondary'
                )}
              >
                {item.label}
                {item.locale === currentLocale ? (
                  <span aria-hidden="true" className="text-brand">
                    ✓
                  </span>
                ) : null}
              </a>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
