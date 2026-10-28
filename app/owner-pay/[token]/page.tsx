// Version 1.0 — app/owner-pay/[token]/page.tsx
//
// v1.0: owner payment page reached by the unguessable link attached to keyed quota refusals. It resolves the token to a payment record without fetching our own API and never renders the key_id.

import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { getPaymentById } from '@/lib/billing-store';
import { resolveHandoffToken, toHandoffView, tokenMintFor } from '@/lib/owner-handoff';
import CopyField from './CopyField';
import HandoffStatus from './HandoffStatus';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pay for your AI agent — RiskDataApi',
  robots: { index: false, follow: false },
};

export default async function OwnerPayPage({ params }: { params: { token: string } }) {
  const rec = await resolveHandoffToken(params.token);
  if (!rec) notFound();

  const payment = await getPaymentById(rec.payment_id);
  if (!payment || payment.key_id !== rec.key_id) notFound();

  const view = toHandoffView(payment);
  const qrSvg = await QRCode.toString(view.solana_pay_url, {
    type: 'svg',
    margin: 1,
    width: 240,
  });
  const mint = tokenMintFor(view.currency);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold">Your AI agent needs a top-up</h1>
        <p className="mt-3 text-sm text-neutral-300">
          Your agent&apos;s RiskDataApi key ran out of calls. Pay ${view.usd_amount} once and it
          continues automatically — no account or login needed.
        </p>

        <div className="mt-8 rounded border border-neutral-800 bg-neutral-950 p-5">
          <p className="text-sm text-neutral-400">Exact amount</p>
          <p className="mt-1 text-3xl font-bold">
            {view.pay_amount_formatted} {view.currency}
          </p>
          <p className="mt-2 text-xs text-amber-300">
            Send EXACTLY this amount in ONE transaction — the payment is matched by its exact amount.
          </p>
          <CopyField label="Copy amount" value={view.pay_amount_formatted} />

          <div className="mt-6">
            <p className="text-sm text-neutral-400">Wallet address</p>
            <CopyField label="Copy wallet address" value={view.wallet_address} />
            {mint ? (
              <p className="mt-2 break-all text-xs text-neutral-500">
                {view.currency} mint: <span className="text-neutral-300">{mint}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex justify-center rounded bg-white p-3">
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>

          <a
            href={view.solana_pay_url}
            className="mt-5 block rounded bg-white px-4 py-2 text-center text-sm font-semibold text-black hover:bg-neutral-200"
          >
            Open in wallet (Solana Pay)
          </a>

          <p className="mt-3 text-xs text-neutral-500">
            Some wallets (e.g. Phantom on Android) drop the amount from Solana Pay links — always
            check the amount before you confirm.
          </p>

          <p className="mt-3 text-xs text-neutral-500">
            Link expires:{' '}
            <span className="text-neutral-300">
              {view.expires_at.replace('T', ' ').slice(0, 16)} UTC
            </span>
          </p>
        </div>

        <HandoffStatus token={params.token} initialStatus={view.status} />
      </div>
    </main>
  );
}
