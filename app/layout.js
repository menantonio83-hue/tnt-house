import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-black text-white" style={{ margin: 0 }}>{children}</body>
    </html>
  );
}