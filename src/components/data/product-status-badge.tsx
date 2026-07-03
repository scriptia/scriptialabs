import * as React from 'react';

import { Badge, type BadgeTone } from '@/components/primitives';
import type { ProductStatus } from '@/content/products';

export type ProductStatusBadgeProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
  status: ProductStatus;
  children: React.ReactNode;
};

// Maps every current and future ProductStatus to a visual tone so a new
// status (e.g. a future "deprecated" launch) never needs a new component,
// only a new entry here and a translated label passed in by the caller.
const toneByStatus: Record<ProductStatus, BadgeTone> = {
  draft: 'neutral',
  alpha: 'warning',
  beta: 'brand',
  teaser: 'brand',
  live: 'success',
  deprecated: 'warning',
  archived: 'neutral'
};

export function ProductStatusBadge({ status, children, ...props }: ProductStatusBadgeProps) {
  return (
    <Badge tone={toneByStatus[status]} {...props}>
      {children}
    </Badge>
  );
}
