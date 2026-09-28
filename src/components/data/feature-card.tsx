import * as React from 'react';

import { Card } from './card';

export type FeatureCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: React.ReactNode;
  description: React.ReactNode;
  /** Optional mono index ("01", "02"…) set above the title. */
  index?: React.ReactNode;
};

export function FeatureCard({ title, description, index, ...props }: FeatureCardProps) {
  return (
    <Card {...props}>
      {index ? <div className="mb-4 font-mono text-caption tracking-[0.12em] text-brand">{index}</div> : null}
      <h3 className="text-h3 font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-body-small leading-[1.6] text-text-secondary">{description}</p>
    </Card>
  );
}
