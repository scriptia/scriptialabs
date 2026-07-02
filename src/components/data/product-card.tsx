import * as React from 'react';

import { Card } from './card';

export type ProductCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  description: React.ReactNode;
  badge?: React.ReactNode;
};

export function ProductCard({ title, description, badge, ...props }: ProductCardProps) {
  return (
    <Card interactive {...props}>
      {badge ? <div className="mb-3">{badge}</div> : null}
      <h3 className="text-h3 font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-body-small leading-[1.55] text-text-secondary">{description}</p>
    </Card>
  );
}
