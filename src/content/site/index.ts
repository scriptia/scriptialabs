export const contentSite = {
  name: 'Idion Labs',
  descriptor: 'Venture Studio',
  description:
    'Idion Labs is an AI venture studio. Autonomous agents conceive, build, ship and scale consumer apps on the App Store and Google Play, end to end.',
  // Canonical origin for canonicals, sitemap, robots and OG. Read from the
  // environment so production can keep serving (and canonicalising to) the
  // old domain until idionlabs.com is pointed at the deployment — then it's a
  // one-variable change, no deploy of code. Trailing slash stripped.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://idionlabs.com').replace(/\/$/, ''),
  localeFallback: 'en',
  brandAccent: 'sage',
  social: {
    x: 'https://x.com/idionlabs',
    linkedin: 'https://www.linkedin.com/company/idionlabs'
  }
} as const;
