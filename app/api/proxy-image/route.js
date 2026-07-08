// app/api/proxy-image/route.js
// Version 1.0
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
// Only http(s) URLs are allowed (blocks file://, data:, javascript:, etc.
// to avoid this becoming an open SSRF proxy), and the response is capped
// at 8MB to avoid abuse.

import { NextResponse } from 'next/server';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch (e) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: { 'User-Agent': 'TNT-House-Image-Proxy/1.0' },
    });

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

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (e) {
    console.error('Image proxy error:', e);
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}
