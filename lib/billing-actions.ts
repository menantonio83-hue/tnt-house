// Version 1.1 — lib/billing-actions.ts
//
// v1.1: exports verifyPaymentForKeyId(keyId, paymentId) so owner-handoff polling can verify a payment without exposing or requiring the full ApiKeyRecord; verifyPaymentForKey(key, paymentId) is now a thin wrapper.
//
// Shared by the REST billing routes and the MCP create_topup_invoice / check_payment tools so both have the same auth, tier rules, pending-invoice cap (MAX_PENDING_INVOICES_PER_KEY), salt-collision handling and verification.

import type { ApiKeyRecord } from '@/lib/api-key-store';
import {
  resolveBaseAmount,
  applySalt,
  formatPayAmount,
  WALLET_ADDRESS,
  MRDT_CA,
  USDC_CA,
  SUBSCRIPTION_USD,
  MIN_TOPUP_USD,
  MAX_TOPUP_USD,
  MAX_PENDING_INVOICES_PER_KEY,
  MAX_SALT_ATTEMPTS,
  PENDING_INVOICE_TTL_MINUTES,
  type Currency,
  type InvoiceKind,
} from '@/lib/billing-pricing';
import {
  createPaymentInvoice,
  countPendingInvoicesForKey,
  getPaymentById,
  confirmPayment,
  expireStalePendingPayment,
} from '@/lib/billing-store';
import { findMatchingPayment } from '@/lib/billing-verify';

export interface BillingActionResult {
  status: number;
  body: Record<string, any>;
}

const VALID_CURRENCIES: Currency[] = ['SOL', 'MRDT', 'USDC'];

export async function createInvoiceForKey(
  key: ApiKeyRecord,
  input: { kind?: unknown; currency?: unknown; usd_amount?: unknown },
): Promise<BillingActionResult> {
  try {
    const kind: InvoiceKind = input.kind === 'topup' ? 'topup' : 'subscription';
    const currency: Currency = VALID_CURRENCIES.includes(input.currency as Currency)
      ? (input.currency as Currency)
      : 'USDC';

    let usdAmount: number;
    let label: string;

    if (kind === 'subscription') {
      if (key.tier === 'paid') {
        return {
          status: 400,
          body: { error: 'This key already has unlimited access — no subscription needed.' },
        };
      }
      usdAmount = SUBSCRIPTION_USD;
      label = 'TNT House Risk-Data API — 30-day subscription';
    } else {
      if (key.tier === 'paid') {
        return {
          status: 400,
          body: { error: 'This key already has unlimited access — no call credits needed.' },
        };
      }
      const requested = Number(input.usd_amount);
      if (!Number.isFinite(requested) || requested < MIN_TOPUP_USD || requested > MAX_TOPUP_USD) {
        return {
          status: 400,
          body: { error: `usd_amount must be between $${MIN_TOPUP_USD} and $${MAX_TOPUP_USD}` },
        };
      }
      usdAmount = Math.round(requested * 100) / 100;
      label = `TNT House Risk-Data API — $${usdAmount} call credit top-up`;
    }

    // Anti-salt-flood layer 1: per-key cap, checked before any pricing work.
    const pendingCount = await countPendingInvoicesForKey(key.id);
    if (pendingCount >= MAX_PENDING_INVOICES_PER_KEY) {
      return {
        status: 429,
        body: {
          error: `You already have ${pendingCount} pending invoice(s). Pay or wait for one to expire (${MAX_PENDING_INVOICES_PER_KEY} max at a time) before creating another.`,
        },
      };
    }

    const base = await resolveBaseAmount(usdAmount, currency);

    if (!base) {
      return {
        status: 503,
        body: {
          error: `Could not get a reliable ${currency} price right now — please try USDC instead, or try ${currency} again in a few minutes.`,
          currency_unavailable: currency,
        },
      };
    }

    // Anti-salt-flood layers 2+3: the DB unique index is the real
    // guarantee; retrying with a fresh salt on a collision is what makes
    // that guarantee invisible to legitimate, non-adversarial traffic.
    let payment = null;
    for (let attempt = 0; attempt < MAX_SALT_ATTEMPTS; attempt++) {
      const payAmount = applySalt(base.baseAmount, currency);
      const result = await createPaymentInvoice(key.id, kind, currency, usdAmount, payAmount);

      if (result.payment) {
        payment = result.payment;
        break;
      }
      if (!result.collision) {
        // A real (non-collision) database error — no point retrying blindly.
        return { status: 500, body: { error: 'Failed to create invoice, please try again' } };
      }
      // collision: true — loop again with a fresh salt.
    }

    if (!payment) {
      console.error(
        `[billing/create-invoice] exhausted ${MAX_SALT_ATTEMPTS} salt attempts for ${currency}/$${usdAmount} — possible salt-space exhaustion attempt or extremely unlucky collisions`,
      );
      return {
        status: 503,
        body: {
          error: 'Could not generate a unique invoice amount right now, please try again in a moment.',
        },
      };
    }

    return {
      status: 200,
      body: {
        payment_id: payment.id,
        kind,
        currency,
        usd_amount: usdAmount,
        pay_amount: payment.pay_amount,
        pay_amount_formatted: formatPayAmount(payment.pay_amount, currency),
        wallet_address: WALLET_ADDRESS,
        mrdt_ca: MRDT_CA,
        usdc_ca: USDC_CA,
        label,
        created_at: payment.created_at,
      },
    };
  } catch (error: any) {
    console.error('[billing/create-invoice] error:', error);
    return { status: 500, body: { error: 'Internal error' } };
  }
}

export async function verifyPaymentForKeyId(
  keyId: string,
  paymentId: unknown,
): Promise<BillingActionResult> {
  try {
    const id = typeof paymentId === 'string' && paymentId !== '' ? paymentId : '';
    if (!id) {
      return { status: 400, body: { verified: false, reason: 'Missing payment_id' } };
    }

    const payment = await getPaymentById(id);
    if (!payment) {
      return { status: 404, body: { verified: false, reason: 'Unknown payment_id' } };
    }

    if (payment.key_id !== keyId) {
      // Deliberately the same generic shape as "unknown payment_id" —
      // don't confirm to a caller that a payment_id exists but belongs
      // to someone else.
      return { status: 404, body: { verified: false, reason: 'Unknown payment_id' } };
    }

    if (payment.status === 'confirmed') {
      // Already resolved by an earlier poll — idempotent success, not an error.
      return {
        status: 200,
        body: {
          verified: true,
          already: true,
          kind: payment.kind,
          tx_signature: payment.tx_signature,
        },
      };
    }

    if (payment.status === 'expired') {
      return {
        status: 200,
        body: {
          verified: false,
          expired: true,
          reason: 'This invoice has expired. Please create a new one.',
        },
      };
    }

    // payment.status === 'pending' from here on. Always search for a
    // match FIRST — only consider expiring if genuinely not found, so a
    // payment that landed on-chain just before the TTL boundary always
    // gets at least one real chance to be matched on this exact poll.
    const match = await findMatchingPayment(
      payment.pay_amount,
      payment.currency,
      new Date(payment.created_at).getTime(),
    );

    if (!match.found || !match.signature) {
      const justExpired = await expireStalePendingPayment(payment.id, PENDING_INVOICE_TTL_MINUTES);
      if (justExpired) {
        return {
          status: 200,
          body: {
            verified: false,
            expired: true,
            reason: 'This invoice expired before payment was detected. Please create a new one.',
          },
        };
      }
      return { status: 200, body: { verified: false, reason: match.reason || 'Not found yet' } };
    }

    const result = await confirmPayment(payment.id, match.signature);

    if (!result.claimed) {
      if (result.reason) {
        // Genuine collision caught by the DB constraint — this specific
        // invoice did NOT get credited. Tell the truth instead of
        // reporting success.
        return {
          status: 200,
          body: {
            verified: false,
            reason:
              'This payment amount matched a transaction already used for a different invoice. Please start a new top-up/subscription — you were not charged twice.',
          },
        };
      }

      // No reason: ambiguous. Could be "a concurrent poll for this same
      // payment_id already confirmed it" (fine) OR "it expired
      // concurrently" OR some other state change. Never assume success —
      // re-read the real status and answer honestly.
      const recheck = await getPaymentById(payment.id);

      if (recheck?.status === 'confirmed') {
        return {
          status: 200,
          body: {
            verified: true,
            already: true,
            kind: recheck.kind,
            tx_signature: recheck.tx_signature,
          },
        };
      }
      if (recheck?.status === 'expired') {
        return {
          status: 200,
          body: {
            verified: false,
            expired: true,
            reason: 'This invoice expired before payment was detected. Please create a new one.',
          },
        };
      }
      return {
        status: 200,
        body: {
          verified: false,
          reason: 'Could not confirm payment right now — please try again in a moment.',
        },
      };
    }

    return {
      status: 200,
      body: {
        verified: true,
        kind: result.kind,
        subscription_expires_at: result.subscription_expires_at ?? null,
        credit_balance_usd: result.credit_balance_usd ?? null,
        tx_signature: match.signature,
      },
    };
  } catch (error: any) {
    console.error('[billing/verify-payment] error:', error);
    return { status: 500, body: { verified: false, reason: error.message } };
  }
}

export async function verifyPaymentForKey(
  key: ApiKeyRecord,
  paymentId: unknown,
): Promise<BillingActionResult> {
  return verifyPaymentForKeyId(key.id, paymentId);
}
