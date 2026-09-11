// Version 1.1 — next.config.js
//
// CORS v1.1: the blanket rule is gone.
//
// WHAT IT WAS. One entry, source: '/api/:path*', handing
// Access-Control-Allow-Origin: * to every route in the project. The
// comment said it was so Phantom and Solflare could POST to the payment
// API — a real need, but it was granted to everything rather than to the
// payment API.
//
// WHY THAT MATTERS, and why it is NOT about the paid endpoints. On
// /api/v1/token-risk and its siblings the wildcard is correct and stays:
// those authenticate with an Authorization: Bearer header, which a
// browser never attaches on its own, there is no cookie session, and the
// product is explicitly a public JSON API for bots and browser-based
// agents. Removing it there would break integrations and close no hole.
//
// The hole was on the routes that identify a caller by AMBIENT identity —
// their IP or a browser fingerprint — rather than by something they
// present. For those, a wildcard means any other website can make its own
// visitors call ours: we pay, and the quota burns against the visitor's
// IP rather than the attacker's. That covers the chat routes (every
// message is a paid DeepSeek call), the fingerprint free trial, the
// insider-cluster trace, and order creation, which caps unpaid orders per
// IP.
//
// So the list below is an allowlist of the routes that genuinely serve
// cross-origin callers. Everything else is same-origin, which is all our
// own pages ever needed — they fetch these with relative paths.
//
// NOT wildcarded as /api/v1/:path* on purpose: /api/v1/trial/check lives
// under that prefix and is exactly one of the fingerprint-gated routes
// this change is meant to close. The paths are enumerated so that adding
// a new /api/v1 route does not silently opt it into cross-origin access.

/** @type {import('next').NextConfig} */
const corsHeaders = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
];

// Each entry needs both forms: the bare path and the subpath pattern.
const crossOriginPaths = [
  // The paid JSON API. Key- or x402-authenticated, built to be called
  // from anywhere.
  '/api/v1/token-risk',
  '/api/v1/token-risk/:path*',
  '/api/v1/billing/:path*',
  '/api/v1/webhooks/:path*',
  // MCP server — clients are Claude Desktop, Cursor, Glama, Inspector.
  '/api/mcp',
  '/api/mcp/:path*',
  // The reason the original blanket rule existed: wallet in-app browsers
  // posting to the payment endpoint.
  '/api/pay',
  // Images are fetched into a canvas, which taints without this header.
  '/api/proxy-image',
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['arweave.net', 'nft.storage', 'ipfs.io', 'gateway.pinata.cloud'],
    unoptimized: true,
  },
  async headers() {
    return crossOriginPaths.map((source) => ({ source, headers: corsHeaders }));
  },
};

module.exports = nextConfig;
