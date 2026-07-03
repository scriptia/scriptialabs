'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type TabsItem = {
  id: string;
  label: React.ReactNode;
  panel: React.ReactNode;
};

export type TabsProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> & {
  items: TabsItem[];
  defaultId?: string;
};

// Follows the WAI-ARIA tabs pattern: roving tabindex, Arrow/Home/End
// keyboard navigation between tabs, and a single visible panel driven by
// aria-controls/aria-labelledby rather than showing every panel at once.
export function Tabs({ items, defaultId, className, ...props }: TabsProps) {
  const [activeId, setActiveId] = React.useState(defaultId ?? items[0]?.id);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId)
  );

  const focusTab = (index: number) => {
    const item = items[index];
    if (!item) return;
    setActiveId(item.id);
    tabRefs.current[item.id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTab((activeIndex + 1) % items.length);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTab((activeIndex - 1 + items.length) % items.length);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(items.length - 1);
        break;
    }
  };

  return (
    <div className={cn('grid gap-3', className)} {...props}>
      <div role="tablist" className="flex gap-1 border-b border-border" onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-body-small font-medium transition-colors',
                selected ? 'border-brand text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`panel-${item.id}`}
          aria-labelledby={`tab-${item.id}`}
          hidden={item.id !== activeId}
        >
          {item.panel}
        </div>
      ))}
    </div>
  );
}
