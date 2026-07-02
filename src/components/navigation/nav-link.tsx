import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { isPathActive, stripLocalePrefix } from '@/lib/routing/paths';
import type { Locale } from '@/lib/i18n/routing';

export type NavLinkProps = Readonly<{
  href: string;
  label: string;
  locale: Locale;
  external?: boolean;
  className?: string;
}>;

export function NavLink({ href, label, locale, external = false, className }: NavLinkProps) {
  const pathname = usePathname();
  const active = isPathActive(pathname, href, locale);
  const content = (
    <span
      className={cn(
        'rounded-pill px-3 py-2 text-body-small font-medium transition-colors',
        active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
        className
      )}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </span>
  );

  if (external) {
    return (
      <a href={href} className="inline-flex" target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link href={stripLocalePrefix(`/${locale}${href === '/' ? '' : href}`, locale) === '/' ? `/${locale}` : `/${locale}${href}`}>{content}</Link>
  );
}
