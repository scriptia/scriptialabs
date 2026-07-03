import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import '@/styles/global.css';

import { buildMetadata } from '@/lib/seo/metadata';
import { routing, type Locale } from '@/lib/i18n/routing';

// getLocale()/getMessages() need request scope (headers/cookies) and throw
// when Next statically prerenders the generated /404 and /500 fallback
// pages, which run outside any request. Fall back to the default locale
// there so the root layout can still render.
async function resolveLocale(): Promise<Locale> {
  try {
    return (await getLocale()) as Locale;
  } catch {
    return routing.defaultLocale;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return buildMetadata({ locale, path: '/' });
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await resolveLocale();
  const messages = await getMessages({ locale }).catch(() => undefined);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
