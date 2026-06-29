// next.config.js
// Single config file — delete next.config.mjs after uploading this!
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['arweave.net', 'nft.storage', 'ipfs.io', 'gateway.pinata.cloud'],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Allow Phantom/Solflare to POST to our payment API
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
