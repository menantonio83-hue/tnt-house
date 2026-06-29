// app/layout.js
// Clean layout — removed @solana/wallet-adapter-react-ui/styles.css (unused, causes conflicts)
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
      </head>
      <body className="bg-black text-white" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
