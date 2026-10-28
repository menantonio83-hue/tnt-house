// Version 1.1 — lib/refusal-options.ts
//
// v1.1: topUpOption now carries an mcp_tool (create_topup_invoice) and its next_step mentions the MCP tool first (create_topup_invoice then check_payment), followed by the REST fallback. All other options unchanged.
//
// Version 1.0 — lib/refusal-options.ts
// One source of truth for the options[] block attached to every quota/credit refusal, used by lib/rate-limit.ts (REST + MCP keyed), the MCP anonymous refusal and the REST public-demo refusal.

import { MIN_TOPUP_USD, MAX_TOPUP_USD, SUBSCRIPTION_USD, SUBSCRIPTION_MONTHLY_QUOTA } from '@/lib/billing-pricing';

export const SITE_ORIGIN = 'https://www.tnt-audit.com';
export const X402_PRICE_USD = 0.02;

export type RefusalOptionId = 'free_key' | 'x402' | 'top_up';

export interface RefusalOption {
  id: RefusalOptionId;
  title: string;
  price: string;
  next_step: string;
  mcp_tool?: { name: string; arguments: Record<string, unknown> };
  http?: { method: 'GET' | 'POST'; url: string; body?: Record<string, unknown> };
}

export type RefusalErrorCode = 'anon_limit_reached' | 'anon_unavailable' | 'free_daily_limit_reached' | 'free_pool_capacity' | 'paid_balance_exceeded' | 'demo_limit_reached';

export function freeKeyOption(): RefusalOption {
  return {
    id: 'free_key',
    title: 'Get a free API key',
    price: 'free — 15 checks/day',
    next_step: 'Call the MCP tool get_free_api_key with {"email":"<your email>"} (or POST ' + SITE_ORIGIN + '/api/v1/signup with the same JSON). Then send the key as Authorization: Bearer <api_key>, or as the api_key argument of check_token_risk.',
    mcp_tool: { name: 'get_free_api_key', arguments: { email: '<your email>' } },
    http: { method: 'POST', url: SITE_ORIGIN + '/api/v1/signup', body: { email: '<your email>' } },
  };
}

export function x402Option(): RefusalOption {
  return {
    id: 'x402',
    title: 'Pay per call with x402 (no account)',
    price: '$0.02 per call, USDC on Solana',
    next_step: 'GET ' + SITE_ORIGIN + '/api/v1/token-risk/x402?mint=<mint>, then answer the HTTP 402 payment challenge with an x402 USDC payment and retry with the X-PAYMENT header.',
    http: { method: 'GET', url: SITE_ORIGIN + '/api/v1/token-risk/x402?mint=<mint>' },
  };
}

export function topUpOption(overageRateUsd: number): RefusalOption {
  return {
    id: 'top_up',
    title: 'Top up call credit or subscribe',
    price: `$${MIN_TOPUP_USD}-$${MAX_TOPUP_USD} credit (then $${overageRateUsd}/call), or $${SUBSCRIPTION_USD} for ${SUBSCRIPTION_MONTHLY_QUOTA} calls/30 days`,
    next_step: `Call the MCP tool create_topup_invoice (then check_payment), or POST ${SITE_ORIGIN}/api/v1/billing/create-invoice with {"api_key":"<your key>","kind":"topup","currency":"USDC","usd_amount":${MIN_TOPUP_USD}} (or "kind":"subscription"), send exactly pay_amount to wallet_address, then POST ${SITE_ORIGIN}/api/v1/billing/verify-payment with {"payment_id":"<payment_id>","api_key":"<your key>"} until verified is true.`,
    mcp_tool: { name: 'create_topup_invoice', arguments: { api_key: '<your key>', kind: 'topup', currency: 'USDC', usd_amount: MIN_TOPUP_USD } },
    http: { method: 'POST', url: SITE_ORIGIN + '/api/v1/billing/create-invoice', body: { api_key: '<your key>', kind: 'topup', currency: 'USDC', usd_amount: MIN_TOPUP_USD } },
  };
}

export function buildRefusalBody(errorCode: RefusalErrorCode, message: string, options: RefusalOption[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...extra, error: message, error_code: errorCode, message, options };
}
