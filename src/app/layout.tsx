import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Montserrat } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import '@/styles/global.css';

import { buildMetadata } from '@/lib/seo/metadata';
import { routing, type Locale } from '@/lib/i18n/routing';

// Idion's type system: Montserrat (light, wide-tracked) is the logo's geometric
// face and carries display type; Inter carries body copy; JetBrains Mono sets
// the technical eyebrows and stage labels. Exposed as CSS variables that the
// token layer in global.css composes into --font-display/--font-sans/--font-mono.
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-montserrat', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains', display: 'swap' });

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
    <html lang={locale} className={`${montserrat.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
