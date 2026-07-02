import * as React from 'react';

import type { Locale } from '@/lib/i18n/routing';

export type LanguageSwitchItem = {
  locale: Locale;
  label: string;
  href: string;
};

export type LanguageSwitcherProps = Readonly<{
  items: LanguageSwitchItem[];
  className?: string;
  ariaLabel?: string;
}>;

export function LanguageSwitcher({ items, className, ariaLabel = 'Language switcher' }: LanguageSwitcherProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <li key={item.locale}>
            <a className="text-body-small text-text-secondary transition-colors hover:text-text-primary" href={item.href} lang={item.locale}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
