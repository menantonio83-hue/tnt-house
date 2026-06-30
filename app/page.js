// app/layout.js
import './globals.css';

export const metadata = {
  title: 'TNT House — AI Token Audits',
  description: 'AI-powered Solana token security audits and listings',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        {/* TEMP DEBUG — Eruda mobile console, remove after diagnosing the banner button issue */}
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script dangerouslySetInnerHTML={{ __html: 'eruda.init();' }} />
      </head>
      <body className="bg-black text-white" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
