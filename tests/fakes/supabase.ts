import { rows, type Row } from './state';

type Filter =
  | { kind: 'eq'; col: string; val: unknown }
  | { kind: 'in'; col: string; val: unknown[] };

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    if (filter.kind === 'eq') return row[filter.col] === filter.val;
    return filter.val.includes(row[filter.col]);
  });
}

function clone(row: Row): Row {
  return { ...row };
}

class Query {
  private filters: Filter[] = [];
  private operation: 'select' | 'insert' | 'update' = 'select';
  private payload: Row | Row[] | null = null;

  constructor(private table: string) {}

  select(_columns?: string): this {
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', col: column, val: value });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ kind: 'in', col: column, val: value });
    return this;
  }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve(this.run('maybe'));
  }

  single(): Promise<{ data: Row | null; error: { message: string; code?: string } | null }> {
    const result = this.run('one');
    return Promise.resolve(result);
  }

  then<T>(
    onFulfilled: (value: { data: Row[] | null; error: null }) => T,
    onRejected?: (reason: unknown) => T,
  ): Promise<T> {
    return Promise.resolve(this.run('many')).then(onFulfilled, onRejected);
  }

  private run(mode: 'maybe' | 'one' | 'many'): { data: any; error: any } {
    const table = rows(this.table);

    if (this.operation === 'insert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const stored = incoming.map((row) => ({ ...row }));
      table.push(...stored);
      if (mode === 'many') return { data: stored.map(clone), error: null };
      return { data: clone(stored[0]), error: null };
    }

    const found = table.filter((row) => matches(row, this.filters));

    if (this.operation === 'update') {
      const patch = (this.payload ?? {}) as Row;
      for (const row of found) Object.assign(row, patch);
      if (mode === 'many') return { data: found.map(clone), error: null };
      return { data: found[0] ? clone(found[0]) : null, error: null };
    }

    if (mode === 'many') return { data: found.map(clone), error: null };
    return { data: found[0] ? clone(found[0]) : null, error: null };
  }
}

function addUsage(keyId: string, usageDate: string, amount: number): number {
  const table = rows('api_key_usage_daily');
  let row = table.find((item) => item.key_id === keyId && item.usage_date === usageDate);
  if (!row) {
    row = { key_id: keyId, usage_date: usageDate, request_count: 0 };
    table.push(row);
  }
  row.request_count = Number(row.request_count) + amount;
  return Number(row.request_count);
}

function rpc(name: string, args: Record<string, unknown>): { data: unknown; error: { message: string } | null } {
  if (name === 'increment_daily_usage') {
    return { data: addUsage(String(args.p_key_id), String(args.p_usage_date), 1), error: null };
  }
  if (name === 'increment_daily_usage_by') {
    const amount = Number(args.p_amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return { data: null, error: { message: 'p_amount must be positive' } };
    }
    return { data: addUsage(String(args.p_key_id), String(args.p_usage_date), amount), error: null };
  }
  if (name === 'increment_subscription_usage') {
    const key = rows('api_keys').find((item) => item.id === args.p_key_id);
    if (!key) return { data: null, error: { message: 'key not found' } };
    const quota = Number(args.p_quota);
    const next = Math.min(Number(key.subscription_cycle_calls_used ?? 0) + 1, quota + 1);
    key.subscription_cycle_calls_used = next;
    return { data: next, error: null };
  }
  if (name === 'decrement_credit_if_sufficient') {
    const key = rows('api_keys').find((item) => item.id === args.p_key_id);
    if (!key) return { data: null, error: null };
    const have = Math.round(Number(key.credit_balance_usd) * 1_000_000);
    const cost = Math.round(Number(args.p_amount) * 1_000_000);
    if (have < cost) return { data: null, error: null };
    const left = (have - cost) / 1_000_000;
    key.credit_balance_usd = left;
    return { data: left, error: null };
  }
  return { data: null, error: { message: `rpc ${name} is not stubbed` } };
}

export function createFakeClient() {
  return {
    from(table: string) {
      return new Query(table);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      const result = rpc(name, args);
      return Promise.resolve(result);
    },
  };
}
