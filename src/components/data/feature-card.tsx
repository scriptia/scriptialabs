import * as React from 'react';

import { Card } from './card';

export type FeatureCardProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  description: React.ReactNode;
};

export function FeatureCard({ title, description, ...props }: FeatureCardProps) {
  return (
    <Card {...props}>
      <h3 className="text-h3 font-medium text-text-primary">{title}</h3>
      <p className="mt-2 text-body-small leading-[1.55] text-text-secondary">{description}</p>
    </Card>
  );
}
