'use client';

// Intentionally locale-independent: a segment error boundary can fire before
// next-intl context is available, so it must not depend on next-intl hooks.
// It is still nested inside the root layout's <html>/<body>.
export default function ErrorBoundary({
  error,
  reset
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  void error;

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: '1rem', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
