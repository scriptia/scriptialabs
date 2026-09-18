'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/routing';
import { isPathActive } from '@/lib/routing/paths';
import { motionPresets } from '@/lib/motion';
import { usePathname } from 'next/navigation';

import { groupProductMenuItems, ProductMenuEntry, ProductMenuGroupHeading, type ProductMenuItem } from './product-menu-items';

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
  const groups = React.useMemo(() => groupProductMenuItems(items), [items]);

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
          // Two columns and grouped by status because one column of every
          // published product ran past the bottom of the viewport. `left-0` is
          // safe at this width: the trigger is the leftmost item in the nav, and
          // the max-width keeps the panel inside the page on small screens.
          //
          // The max-height is the part that actually holds: two columns buy back
          // roughly a third of the height today, but "today" is ten products and
          // the whole point of the pipeline is that there will be more. Past that
          // the panel scrolls itself rather than the page.
          <motion.div
            role="menu"
            className="absolute left-0 top-full z-50 mt-3 max-h-[calc(100vh-6rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-surface-elevated p-2 shadow-high backdrop-blur-xl"
            {...motionPresets.scale}
          >
            {groups.map((group) => (
              <div key={group.status ?? 'other'}>
                <ProductMenuGroupHeading>{group.label}</ProductMenuGroupHeading>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <ProductMenuEntry key={item.href} item={item} locale={locale} variant="menu" onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
