import './globals.css'

export const metadata = {
  title: 'TNT House | Trench Construction Site',
  description: 'Safe micro-cap tokens platform on Solana. AI-powered audits for verified gems ($5K-$100K MC). Powered by $MRDT.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}