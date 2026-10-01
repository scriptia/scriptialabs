'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const items = [
  { href: '/internal', label: 'Dashboard', exact: true, adminOnly: false },
  { href: '/internal/bets', label: 'Bets', exact: true, adminOnly: false },
  { href: '/internal/bets/board', label: 'Board', exact: true, adminOnly: false },
  { href: '/internal/runs', label: 'Jobs', exact: false, adminOnly: false },
  // The vault: credentials that spend money and publish apps (requireAdmin).
  { href: '/internal/accounts', label: 'Accounts', exact: false, adminOnly: true },
  { href: '/internal/products', label: 'Products', exact: false, adminOnly: false },
  { href: '/internal/calendar', label: 'Calendar', exact: false, adminOnly: false },
  { href: '/internal/content-engine', label: 'Content Engine', exact: false, adminOnly: false },
  { href: '/internal/metrics', label: 'Metrics', exact: false, adminOnly: false }
] as const;

// next/link, not the next-intl Link from @/lib/i18n/routing — the panel lives
// outside the locale tree, so a locale-aware Link would prefix these with /en.
export function PanelNav({ isAdmin = false }: Readonly<{ isAdmin?: boolean }>) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Internal sections">
      {items.filter((item) => isAdmin || !item.adminOnly).map((item) => {
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
