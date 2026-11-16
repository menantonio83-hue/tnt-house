import { afterEach, expect, it, vi } from 'vitest';
import { getDexScreenerData, pickDexScreenerPair } from '@/lib/helius-client';

const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const JUP = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function pair(base: string, quote: string, priceUsd: string, priceNative: string, liq: number) {
  return {
    chainId: 'solana',
    baseToken: { address: base },
    quoteToken: { address: quote },
    priceUsd,
    priceNative,
    liquidity: { usd: liq },
    volume: { h24: 1000 },
    priceChange: { h24: 1.5 },
    pairCreatedAt: Date.now() - 10 * 86400000,
  };
}

// Shape of the live DexScreener answer for BONK on 2026-11-16: the
// biggest pool is quoted in JUP and DexScreener mis-prices it (~4,900x).
const BONK_PAIRS = [
  pair(BONK, JUP, '0.01146', '0.000009351', 29756933.94),
  pair(BONK, SOL, '0.000002349', '0.00000003281', 230455.22),
  pair(BONK, USDC, '0.000002356', '0.000002356', 194633.94),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

it('prefers a SOL/USDC/USDT-quoted base-side pair over a bigger pool quoted in another token', () => {
  const best = pickDexScreenerPair(BONK_PAIRS, BONK);
  expect(best.quoteToken.address).toBe(SOL);
  expect(best.priceUsd).toBe('0.000002349');
});

it('falls back to the highest-liquidity base-side pair when no trusted quote exists', () => {
  const pairs = [pair(BONK, JUP, '0.01146', '0.000009351', 100), pair(BONK, 'Other111', '0.02', '1', 50)];
  expect(pickDexScreenerPair(pairs, BONK).liquidity.usd).toBe(100);
});

it('still uses a quote-side pair only when no base-side pair exists (USDC case)', () => {
  const pairs = [pair(BONK, USDC, '0.000002356', '0.000002356', 500)];
  expect(pickDexScreenerPair(pairs, USDC).baseToken.address).toBe(BONK);
});

it('does not mutate the input array', () => {
  const copy = [...BONK_PAIRS];
  pickDexScreenerPair(BONK_PAIRS, BONK);
  expect(BONK_PAIRS).toEqual(copy);
});

it('getDexScreenerData reports the real BONK price and the trusted pool liquidity', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ pairs: BONK_PAIRS }), { status: 200 })));
  const data = await getDexScreenerData(BONK);
  expect(data.price).toBeCloseTo(0.000002349, 12);
  expect(data.liquidity).toBe(230455.22);
});
