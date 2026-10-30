export type Row = Record<string, unknown>;

export const tables: Record<string, Row[]> = {};

export const redisData = new Map<string, unknown>();

export let redisDown = false;

export function setRedisDown(down: boolean): void {
  redisDown = down;
}

export type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

let fetchHandler: FetchHandler | null = null;

export function setFetchHandler(handler: FetchHandler | null): void {
  fetchHandler = handler;
}

export function currentFetchHandler(): FetchHandler | null {
  return fetchHandler;
}

export function resetFakes(): void {
  for (const name of Object.keys(tables)) delete tables[name];
  redisData.clear();
  redisDown = false;
  fetchHandler = null;
}

export function rows(table: string): Row[] {
  if (!tables[table]) tables[table] = [];
  return tables[table];
}

export function creditOf(keyId: string): number {
  const row = rows('api_keys').find((item) => item.id === keyId);
  return row ? Number(row.credit_balance_usd) : NaN;
}

export function usageOf(keyId: string, usageDate: string): number {
  const row = rows('api_key_usage_daily').find(
    (item) => item.key_id === keyId && item.usage_date === usageDate,
  );
  return row ? Number(row.request_count) : 0;
}
