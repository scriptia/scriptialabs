import type { MetadataRoute } from 'next';

import { contentSite } from '@/content/site';

const disallow = ['/api/', '/_next/', '/internal/'];

// AI crawlers, named so the decision to let them in is explicit and reviewable
// (ADR-014). `*` already allowed them; a named group replaces `*` for that bot in
// robots.txt, so each one repeats the same disallow list. Training crawlers
// (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended) and answer-engine
// fetchers are both allowed: being cited by an assistant is the point of GEO.
const aiCrawlers = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot'
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow
      },
      {
        userAgent: aiCrawlers,
        allow: '/',
        disallow
      }
    ],
    sitemap: `${contentSite.url}/sitemap.xml`
  };
}
