import type { ReactNode } from 'react';

import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { AppShell, Footer, Navbar } from '@/components/layout';
import { contentSite } from '@/content/site';
import { navigationModel } from '@/content/navigation';
import { routing, type Locale } from '@/lib/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: requestedLocale } = await params;

  if (!routing.locales.includes(requestedLocale as Locale)) {
    notFound();
  }

  const locale = requestedLocale as Locale;

  const [tCommon, tNav, tLanguages, tProducts, tSocial, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'navigation' }),
    getTranslations({ locale, namespace: 'languages' }),
    getTranslations({ locale, namespace: 'products' }),
    getTranslations({ locale, namespace: 'social' }),
    getTranslations({ locale, namespace: 'footer' })
  ]);

  const resolveLabel = (key: string) => {
    const [namespace, ...path] = key.split('.');
    const value = path.join('.');

    switch (namespace) {
      case 'navigation':
        return tNav(value);
      case 'products':
        return tProducts(value);
      case 'social':
        return tSocial(value);
      case 'footer':
        return tFooter(value);
      case 'common':
        return tCommon(value);
      case 'languages':
        return tLanguages(value);
      default:
        return key;
    }
  };

  const localeLinks = routing.locales.map((entry) => ({
    locale: entry,
    label: tLanguages(entry),
    href: `/${entry}`
  }));

  const navbar = (
    <Navbar
      locale={locale}
      logoLabel={contentSite.name}
      primaryLinks={navigationModel.primary.map((item) => ({
        label: resolveLabel(item.labelKey),
        href: item.href,
        external: item.external
      }))}
      productLinks={navigationModel.products.map((item) => ({
        label: resolveLabel(item.labelKey),
        href: item.href,
        description: resolveLabel(item.descriptionKey),
        status: item.status,
        statusLabel: tCommon(`productStatus.${item.status}`),
        accent: item.accent,
        external: item.external
      }))}
      localeLinks={localeLinks}
      contactLink={{ label: tNav('contact'), href: '/contact' }}
      productMenuLabel={tNav('products')}
      languageLabel={tCommon('languages')}
      themeLabel={tCommon('toggleTheme')}
      openMenuLabel={tCommon('openMenu')}
      closeMenuLabel={tCommon('closeMenu')}
    />
  );

  const footer = (
    <Footer
      locale={locale}
      logoLabel={contentSite.name}
      description={contentSite.description}
      groups={Object.values(navigationModel.footer).map((group) => ({
        title: resolveLabel(group.titleKey),
        items: group.items.map((item) => ({
          label: resolveLabel(item.labelKey),
          href: item.href,
          external: item.external
        }))
      }))}
      localeLinks={localeLinks}
      copyright={tFooter('copyright')}
      contactLink={{ label: tNav('contact'), href: '/contact' }}
    />
  );

  return <AppShell navbar={navbar} footer={footer}>{children}</AppShell>;
}
