'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

const items = [
  { href: '/internal/content-engine', label: 'Overview', exact: true },
  { href: '/internal/content-engine/review', label: 'Review', exact: true },
  { href: '/internal/content-engine/knowledge', label: 'Knowledge', exact: true },
  { href: '/internal/content-engine/library', label: 'Library', exact: true },
  { href: '/internal/content-engine/trends', label: 'Trends', exact: true },
  { href: '/internal/content-engine/gallery', label: 'Gallery', exact: true },
  { href: '/internal/content-engine/publications', label: 'Publications', exact: true }
] as const;

// A sub-nav scoped to this section, not five more top-level entries in
// panel-nav.tsx — content-engine alone is already 5 destinations, and mixing
// them flat with Dashboard/Bets/Board would stop reading as one section.
// Preserves the current app_id (if any) across links, same URL-as-state
// reasoning as AppSelector — switching pages shouldn't lose the active app.
export function ContentEngineNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const appId = searchParams.get('app_id');

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-3" aria-label="Content Engine sections">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const href = appId ? `${item.href}?app_id=${appId}` : item.href;

        return (
          <Link
            key={item.href}
            href={href}
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
