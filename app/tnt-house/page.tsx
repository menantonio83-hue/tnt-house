// Version 1.0 — app/tnt-house/page.tsx
//
// This route was a dead stub — a never-finished separate $MRDT-themed
// page — that shipped to production and rendered literally
// "Fixed by Grok for $MRDT" (plus dead imports for wallet libs it never
// used) to anyone who found the URL. Nothing in the app links to it,
// but the path is guessable (it matches the site's own name), so it
// was live and crawlable at https://tnt-audit.com/tnt-house.
//
// The real TNT House experience already lives at the site root (/).
// Redirecting here instead of deleting the route in case an old
// share/backlink/QR code still points at this exact path.

import { redirect } from 'next/navigation';

export default function TntHouseRedirect() {
  redirect('/');
}
