import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

// Intentionally locale-independent: this file renders for requests outside
// the [locale] segment (e.g. Next's generated /404 fallback), where no
// request-scoped i18n context is available, so it can't use next-intl hooks.
// It is still nested inside the root layout's <html>/<body>.
export default function NotFound() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: '1rem', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link href="/">Go home</Link>
    </div>
  );
}
