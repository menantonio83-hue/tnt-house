// Version 1.0 — app/providers.js
//
// PostHog client provider for the App Router. Next.js's App Router has no
// router-change event the way the old Pages Router did, so pageviews are
// captured manually here on every pathname/search-param change instead of
// relying on posthog-js's own (Pages-Router-only) autocapture.
//
// Initializes once on the client only. If NEXT_PUBLIC_POSTHOG_KEY is unset
// (e.g. a local dev checkout with no .env.local yet), posthog-js is never
// initialized and every posthog.capture(...) call elsewhere in the app is a
// safe no-op — nothing breaks, it just doesn't send events.

'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // we send $pageview manually below, once per real navigation
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !posthog.__loaded) return;
    let url = window.origin + pathname;
    if (searchParams && searchParams.toString()) {
      url += '?' + searchParams.toString();
    }
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
