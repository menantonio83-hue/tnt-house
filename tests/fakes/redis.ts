import { redisData, redisDown } from './state';

function rejectIfDown(): void {
  if (redisDown) throw new Error('redis unavailable');
}

function readNumber(key: string): number {
  const raw = redisData.get(key);
  if (raw === undefined || raw === null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

// INCR changes the number before the promise is returned, so two
// overlapping calls cannot both observe the same value.
export class FakeRedis {
  constructor(_options?: { url?: string; token?: string }) {}

  incr(key: string): Promise<number> {
    rejectIfDown();
    const next = readNumber(key) + 1;
    redisData.set(key, next);
    return Promise.resolve(next);
  }

  incrby(key: string, amount: number): Promise<number> {
    rejectIfDown();
    const next = readNumber(key) + amount;
    redisData.set(key, next);
    return Promise.resolve(next);
  }

  decr(key: string): Promise<number> {
    rejectIfDown();
    const next = readNumber(key) - 1;
    redisData.set(key, next);
    return Promise.resolve(next);
  }

  get<T = unknown>(key: string): Promise<T | null> {
    rejectIfDown();
    if (!redisData.has(key)) return Promise.resolve(null);
    return Promise.resolve(redisData.get(key) as T);
  }

  set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<string | null> {
    rejectIfDown();
    if (opts?.nx && redisData.has(key)) return Promise.resolve(null);
    redisData.set(key, value);
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    rejectIfDown();
    const existed = redisData.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }

  expire(key: string, _seconds: number): Promise<number> {
    rejectIfDown();
    return Promise.resolve(redisData.has(key) ? 1 : 0);
  }

  // The only script in the app releases an MCP identity slot:
  // delete when the value is 1, otherwise decrement while it stays positive.
  eval(script: string, keys: string[], _args?: string[]): Promise<number> {
    rejectIfDown();
    const key = keys[0];
    if (!script.includes('DECR') || !key) return Promise.resolve(0);
    const current = readNumber(key);
    if (current <= 0) return Promise.resolve(0);
    if (current === 1) {
      redisData.delete(key);
      return Promise.resolve(0);
    }
    redisData.set(key, current - 1);
    return Promise.resolve(current - 1);
  }
}
