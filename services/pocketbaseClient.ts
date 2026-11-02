// Deprecated: System has transitioned completely back to Supabase.
// PocketBase client is disabled to prevent any connection timeouts.
export const POCKETBASE_URL = '';

export const pb: any = {
  autoCancellation: () => {},
  collection: () => ({
    getList: async () => ({ items: [], totalItems: 0 }),
    getFullList: async () => [],
    getOne: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => true,
    subscribe: () => () => {},
    unsubscribe: () => {},
  }),
};

export default pb;
