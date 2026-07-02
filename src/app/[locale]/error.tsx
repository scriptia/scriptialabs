'use client';

import { RouteErrorState } from '@/components/layout/route-states';

export default function ErrorBoundary({
  error,
  reset
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  void error;
  void reset;
  return <RouteErrorState />;
}
