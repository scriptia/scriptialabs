import { articlesSegment } from '@/content/articles';
import { contentSite } from '@/content/site';
import { routing, type Locale } from '@/lib/i18n/routing';
import { buildCanonicalPath } from '@/lib/seo/canonical';
import { listProductArticleUrls, listProductCards } from '@/server/content/products';

// /llms.txt (https://llmstxt.org): a plain-Markdown map of the pages worth
// reading, for language models and answer engines (ADR-014). Lists only what the
// sitemap lists — indexable apps and their published articles — so the two
// machine-readable maps cannot disagree.
//
// Route handlers are not tag-aware: purged by path from revalidate.ts.
export const revalidate = 3600;

const localeNames: Record<Locale, string> = { en: 'English', es: 'Español', ca: 'Català' };

export async function GET() {
  const [cards, articles] = await Promise.all([listProductCards(routing.defaultLocale), listProductArticleUrls()]);
  const apps = cards.filter((card) => card.indexable);

  const lines = [`# ${contentSite.name}`, '', `> ${contentSite.description}`, '', '## Apps', ''];

  for (const app of apps) {
    lines.push(`- [${app.name}](${buildCanonicalPath(routing.defaultLocale, app.canonical)}): ${app.cardDescription}`);
  }

  for (const app of apps) {
    const appArticles = articles.filter((article) => article.indexable && article.productSlug === app.slug);
    if (appArticles.length === 0) continue;

    lines.push('', `## ${app.name} guides`, '');
    for (const locale of routing.locales) {
      const inLocale = appArticles.filter((article) => article.locale === locale);
      if (inLocale.length === 0) continue;
      if (routing.locales.length > 1) lines.push(`### ${localeNames[locale]}`, '');
      for (const article of inLocale) {
        lines.push(`- [${article.title}](${buildCanonicalPath(locale, `/${app.slug}/${articlesSegment}/${article.slug}`)}): ${article.description}`);
      }
      lines.push('');
    }
  }

  lines.push('', '## Company', '', `- [About ${contentSite.name}](${buildCanonicalPath(routing.defaultLocale, '/')})`, `- [All apps](${buildCanonicalPath(routing.defaultLocale, '/products')})`, '');

  return new Response(lines.join('\n').replace(/\n{3,}/g, '\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
