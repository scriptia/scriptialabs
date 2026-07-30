'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const items = [
  { href: '/internal', label: 'Dashboard', exact: true },
  { href: '/internal/bets', label: 'Bets', exact: true },
  { href: '/internal/bets/board', label: 'Board', exact: true },
  { href: '/internal/calendar', label: 'Calendar', exact: false }
] as const;

// next/link, not the next-intl Link from @/lib/i18n/routing — the panel lives
// outside the locale tree, so a locale-aware Link would prefix these with /en.
export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Internal sections">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-brand-subtle text-brand-strong' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
