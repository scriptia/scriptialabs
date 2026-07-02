import * as React from 'react';

import { Card } from './card';

export type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  value: React.ReactNode;
  label: React.ReactNode;
};

export function StatCard({ value, label, ...props }: StatCardProps) {
  return (
    <Card {...props}>
      <div className="text-display-m font-medium text-text-primary">{value}</div>
      <p className="mt-2 text-body-small text-text-secondary">{label}</p>
    </Card>
  );
}
