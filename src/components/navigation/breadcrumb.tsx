import * as React from 'react';

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
};

export type BreadcrumbProps = React.OlHTMLAttributes<HTMLOListElement> & {
  items: BreadcrumbItem[];
  ariaLabel?: string;
};

export function Breadcrumb({ items, ariaLabel = 'Breadcrumb', ...props }: BreadcrumbProps) {
  return (
    <ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-2 text-body-small text-text-secondary" {...props}>
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-2">
          {item.href ? <a className="transition-colors hover:text-text-primary" href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}
          {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </li>
      ))}
    </ol>
  );
}
