import * as React from 'react';

export type TableOfContentsItem = { id: string; label: string };

export type TableOfContentsProps = {
  label: string;
  items: TableOfContentsItem[];
};

// Sticky only from lg up — on smaller viewports a sticky side rail would
// steal vertical space from the document itself, which matters more.
export function TableOfContents({ label, items }: TableOfContentsProps) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-3 text-caption font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</div>
      <ul className="grid gap-2 border-l border-border pl-4">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="text-body-small text-text-secondary transition-colors hover:text-text-primary">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
