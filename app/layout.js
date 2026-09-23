// app/layout.js
import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  metadataBase: new URL('https://tnt-audit.com'),
  title: 'TNT House — AI Token Audits',
  description: 'AI-powered Solana token security audits and listings',
  openGraph: {
    title: 'TNT House — AI Token Audits',
    description: 'AI-powered Solana token security audits and listings for Solana traders.',
    url: 'https://tnt-audit.com',
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-black text-white" style={{ margin: 0 }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
