// Version 1.0 — app/sitemap.ts
//
// Next.js metadata-route convention: this file generates /sitemap.xml at
// request time — no sitemap existed before, so Google had no crawl map
// for tnt-audit.com and had no way to discover individual /audit/{ca}
// report pages (they carry no internal links from anywhere except a
// shared widget/social-card URL, so without a sitemap they were
// effectively orphaned for search).
//
// Static routes are listed by hand below. Per-token pages come from
// listed_tokens via the same public PostgREST read used client-side in
// app/page.js (SUPABASE_URL + the publishable key) — this is public,
// already-displayed data, so no service-role key is needed here.
// Capped at the same limit: 100 tokens, the site's own existing depth of
// its "verified tokens" load, ordered by last_audit_at desc so freshly
// re-audited tokens resurface near the top of the sitemap too.

import type { MetadataRoute } from 'next';

const SUPABASE_URL = 'https://pjtvjslcffuulsqxerpx.supabase.co';
const SUPABASE_KEY = 'sb_publishable__gmhE8SE_blCu-v90fV2OQ_YmFCkfFU';
const SITE_URL = 'https://tnt-audit.com';

interface ListedTokenRow {
  ca: string;
  last_audit_at?: string | null;
  created_at?: string | null;
}

async function getListedTokenEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(
      SUPABASE_URL +
        '/rest/v1/listed_tokens?select=ca,last_audit_at,created_at&order=last_audit_at.desc&limit=100',
      {
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
        // Sitemap is regenerated at most once an hour — token audits
        // don't churn fast enough to justify request-time no-store here,
        // and a cached sitemap is friendlier to crawl budget.
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const rows: ListedTokenRow[] = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => !!row.ca)
      .map((row) => ({
        url: SITE_URL + '/audit/' + row.ca,
        lastModified: row.last_audit_at || row.created_at || undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
  } catch (e) {
    // Fail closed on the dynamic part only — a broken Supabase call
    // should never take down the whole sitemap (and with it, crawling
    // of the static pages below).
    console.error('[sitemap] listed_tokens fetch failed:', (e as Error)?.message);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL + '/', changeFrequency: 'daily', priority: 1.0 },
    { url: SITE_URL + '/quick-check', changeFrequency: 'daily', priority: 0.8 },
    { url: SITE_URL + '/risk-api', changeFrequency: 'weekly', priority: 0.8 },
    { url: SITE_URL + '/risk-api/docs', changeFrequency: 'weekly', priority: 0.7 },
    { url: SITE_URL + '/disclaimer', changeFrequency: 'yearly', priority: 0.2 },
    { url: SITE_URL + '/terms', changeFrequency: 'yearly', priority: 0.2 },
    { url: SITE_URL + '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  ];

  const tokenEntries = await getListedTokenEntries();

  return [...staticEntries, ...tokenEntries];
}
