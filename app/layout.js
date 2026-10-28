// app/layout.js
// 2026-10-28: metadataBase / og:url moved to https://www.tnt-audit.com (the
// canonical host); removed the manual viewport <meta> — Next 14 already
// emits width=device-width, initial-scale=1, so it was duplicated. The
// Tailwind Play CDN script stays: app/globals.css has no @tailwind
// directives, so the whole site's styling depends on it for now.
import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  metadataBase: new URL('https://www.tnt-audit.com'),
  title: 'TNT House — AI Token Audits',
  description: 'AI-powered Solana token security audits and listings',
  openGraph: {
    title: 'TNT House — AI Token Audits',
    description: 'AI-powered Solana token security audits and listings for Solana traders.',
    url: 'https://www.tnt-audit.com',
    siteName: 'TNT House',
    images: [
      {
        url: '/tnt-shield-green.png',
        width: 362,
        height: 427,
        alt: 'TNT House — AI Token Audits',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'TNT House — AI Token Audits',
    description: 'AI-powered Solana token security audits and listings for Solana traders.',
    images: ['/tnt-shield-green.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-black text-white" style={{ margin: 0 }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
