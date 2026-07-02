import * as React from 'react';

export type TabsItem = {
  id: string;
  label: React.ReactNode;
  panel: React.ReactNode;
};

export type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  items: TabsItem[];
  activeId?: string;
};

export function Tabs({ items, activeId, ...props }: TabsProps) {
  return <div {...props}>{items.map((item) => <div key={item.id}>{item.label}</div>)}</div>;
}
