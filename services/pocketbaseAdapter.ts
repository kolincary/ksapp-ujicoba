import { rawSupabase } from './supabaseClient';

export const isValidPbId = (id: any): boolean => {
  return typeof id === 'string' && /^[a-z0-9]{15}$/.test(id);
};

export const generatePbId = (): string => {
  return (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9)).padEnd(15, '0');
};

export class PocketBaseQueryBuilder<T = any> implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private query: any;
  private isIgnored: boolean = false;

  constructor(collectionName: string) {
    if (collectionName === 'admin_batch_imports') {
      this.isIgnored = true;
    } else {
      this.query = rawSupabase.from(collectionName);
    }
  }

  select(columns = '*', options?: any) {
    if (!this.isIgnored) this.query = this.query.select(columns, options);
    return this;
  }

  insert(payload: any) {
    if (!this.isIgnored) this.query = this.query.insert(payload);
    return this;
  }

  update(payload: any) {
    if (!this.isIgnored) this.query = this.query.update(payload);
    return this;
  }

  upsert(payload: any, options?: any) {
    if (!this.isIgnored) this.query = this.query.upsert(payload, options);
    return this;
  }

  delete() {
    if (!this.isIgnored) this.query = this.query.delete();
    return this;
  }

  eq(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.eq(field, val);
    return this;
  }

  neq(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.neq(field, val);
    return this;
  }

  gt(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.gt(field, val);
    return this;
  }

  gte(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.gte(field, val);
    return this;
  }

  lt(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.lt(field, val);
    return this;
  }

  lte(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.lte(field, val);
    return this;
  }

  like(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.like(field, val);
    return this;
  }

  ilike(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.ilike(field, val);
    return this;
  }

  is(field: string, val: any) {
    if (!this.isIgnored) this.query = this.query.is(field, val);
    return this;
  }

  in(field: string, vals: any[]) {
    if (!this.isIgnored) this.query = this.query.in(field, vals);
    return this;
  }

  order(field: string, options?: any) {
    if (!this.isIgnored) this.query = this.query.order(field, options);
    return this;
  }

  limit(count: number) {
    if (!this.isIgnored) this.query = this.query.limit(count);
    return this;
  }

  range(from: number, to: number) {
    if (!this.isIgnored) this.query = this.query.range(from, to);
    return this;
  }

  single() {
    if (!this.isIgnored) this.query = this.query.single();
    return this;
  }

  maybeSingle() {
    if (!this.isIgnored) this.query = this.query.maybeSingle();
    return this;
  }

  async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    if (this.isIgnored) return { data: [], error: null, count: 0 };
    return await this.query;
  }

  then<TResult1 = { data: any; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (this.isIgnored) return Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected);
    return this.query.then(onfulfilled, onrejected);
  }
}

export class PocketBaseSupabaseAdapter {
  from(collectionName: string) {
    if (collectionName === 'admin_batch_imports') {
      return new PocketBaseQueryBuilder(collectionName);
    }
    return rawSupabase.from(collectionName);
  }

  rpc(funcName: string, params?: any) {
    return rawSupabase.rpc(funcName, params);
  }

  channel(channelName: string) {
    return rawSupabase.channel(channelName);
  }

  removeChannel(channel: any) {
    return rawSupabase.removeChannel(channel);
  }

  get auth() {
    return rawSupabase.auth;
  }
}

export const pocketbaseAdapter = new PocketBaseSupabaseAdapter();
export default pocketbaseAdapter;
