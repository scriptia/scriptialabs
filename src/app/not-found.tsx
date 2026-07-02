import type { Metadata } from 'next';

import { RouteNotFoundState } from '@/components/layout/route-states';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return <RouteNotFoundState />;
}
