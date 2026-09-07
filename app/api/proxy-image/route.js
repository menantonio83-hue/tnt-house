// app/api/proxy-image/route.js
// Version 1.1
//
// WHY THIS EXISTS: the "Download branded logo for X" feature in the audit
// success modal draws the token's logo onto a <canvas>, then overlays the
// TNT shield and exports it with toDataURL(). Browsers only allow that
// export if every image drawn onto the canvas was loaded with CORS
// permission — and most external logo CDNs (DexScreener's included) don't
// reliably send Access-Control-Allow-Origin, which "taints" the canvas and
// makes toDataURL() throw a SecurityError. Fetching the image through our
// own domain sidesteps this entirely: the browser sees an image served
// from tnt-audit.com, not a cross-origin one, so no CORS permission is
// needed at all.
//
// FIX v1.1 — SSRF.
//
// v1.0 checked only that the scheme was http(s). That does not stop the
// URL pointing INTO our own infrastructure: cloud metadata at
// 169.254.169.254, loopback, or anything on the private ranges a
// serverless function can reach. Three separate holes are closed here:
//
//   1. The destination is now validated with lib/webhook-ssrf-guard.ts —
//      the same module already used for webhook callback URLs. It resolves
//      the hostname and rejects if ANY resolved address falls in a
//      private, loopback or link-local range, which a string check on the
//      hostname alone would miss for an attacker-controlled domain that
//      simply resolves to 127.0.0.1.
//   2. Redirects are no longer followed automatically. fetch() follows
//      them by default, so a perfectly safe-looking URL could 302 straight
//      to the metadata endpoint AFTER passing validation. Each hop is now
//      re-validated with the same guard, and there are at most two.
//   3. The 8MB cap was applied AFTER arrayBuffer() had already pulled the
//      whole body into memory, so it protected nothing. The body is now
//      read incrementally and aborted the moment it goes over.
//
// The guard requires https. All 48 external logo URLs currently stored in
// listed_tokens are https, so this rejects nothing that works today.
//
// KNOWN RESIDUAL RISK: DNS rebinding. The guard resolves the hostname, and
// fetch() then resolves it again independently — a domain that answers
// differently between those two lookups can still slip through. Closing
// that needs pinning the resolved IP and connecting to it directly, which
// Node's fetch doesn't expose. Documented rather than silently ignored;
// the same limitation is already noted in webhook-ssrf-guard.ts itself.

import { NextResponse } from 'next/server';
import { isCallbackUrlSafe } from '@/lib/webhook-ssrf-guard';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_REDIRECTS = 2;

// Read the body incrementally and give up as soon as it exceeds the cap,
// instead of buffering an unbounded response and measuring it afterwards.
async function readCapped(response) {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > MAX_BYTES) return null;

  const reader = response.body ? response.body.getReader() : null;
  if (!reader) return null;

  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let currentUrl = imageUrl;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Re-validated on every hop, not just the first — a redirect target
      // is just as attacker-controlled as the original URL.
      const verdict = await isCallbackUrlSafe(currentUrl);
      if (!verdict.safe) {
        console.error(`[proxy-image] blocked URL (${verdict.reason}): ${currentUrl}`);
        return NextResponse.json(
          { error: `URL not allowed: ${verdict.reason}` },
          { status: 400 },
        );
      }

      const upstream = await fetch(currentUrl, {
        headers: { 'User-Agent': 'TNT-House-Image-Proxy/1.1' },
        redirect: 'manual',
      });

      // 3xx: take the Location and loop, so the next hop goes through the
      // guard above rather than being followed blindly by fetch().
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (!location) {
          return NextResponse.json({ error: 'Redirect without a location' }, { status: 502 });
        }
        if (hop === MAX_REDIRECTS) {
          return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
        }
        // Relative Location values are resolved against the current URL.
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!upstream.ok) {
        return NextResponse.json(
          { error: 'Upstream fetch failed with status ' + upstream.status },
          { status: 502 },
        );
      }

      const contentType = upstream.headers.get('content-type') || 'image/png';
      if (!contentType.startsWith('image/')) {
        return NextResponse.json({ error: 'URL did not return an image' }, { status: 415 });
      }

      const body = await readCapped(upstream);
      if (body === null) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400, immutable',
        },
      });
    }

    return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
  } catch (e) {
    console.error('Image proxy error:', e);
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}
