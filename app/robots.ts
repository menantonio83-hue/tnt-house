// Version 1.0 — app/robots.ts
//
// Next.js metadata-route convention: this file generates /robots.txt at
// build/request time — no static public/robots.txt existed before, so
// the file 404'd and crawlers had no explicit crawl policy or sitemap
// pointer for tnt-audit.com.
//
// /api/ is disallowed wholesale: every route under it either requires
// an Authorization/API-key header (Risk-Data API, billing) or is a
// same-origin fetch target for this site's own client code (quick-check,
// listed-tokens, banners, etc.) — none of it is meant to be indexed as a
// page, and letting crawlers spend budget on it just competes with the
// real pages below for that budget.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: 'https://tnt-audit.com/sitemap.xml',
  };
}
