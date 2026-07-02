import * as React from 'react';

export type AccordionItem = {
  title: React.ReactNode;
  content: React.ReactNode;
};

export type AccordionProps = React.HTMLAttributes<HTMLDivElement> & {
  items: AccordionItem[];
};

export function Accordion({ items, ...props }: AccordionProps) {
  return <div {...props}>{items.map((item, index) => <details key={index}><summary>{item.title}</summary><div>{item.content}</div></details>)}</div>;
}
