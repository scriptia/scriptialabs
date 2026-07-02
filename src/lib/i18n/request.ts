import { getRequestConfig } from 'next-intl/server';

import caMessages from '@/messages/ca';
import enMessages from '@/messages/en';
import esMessages from '@/messages/es';

import { routing } from './routing';

const messageMap = {
  en: enMessages,
  es: esMessages,
  ca: caMessages
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: messageMap[locale as keyof typeof messageMap]
  };
});
