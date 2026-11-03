import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from './firebaseClient';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// Default Fallback Supabase credentials (Self-Hosted VPS)
const FALLBACK_URL = 'http://103.52.114.209:8000';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const DEFAULT_URL = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const DEFAULT_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

const DEFAULT_NEW_URL = 'https://ymolrxscthxxtlmnxmob.supabase.co';
const DEFAULT_NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltb2xyeHNjdGh4eHRsbW54bW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjgzNzgsImV4cCI6MjA3OTk0NDM3OH0.Hv64EHm_eZE3QHKN8QkdDFnYAQT1f_7KTDcaRoFobi8';

const DEFAULT_SPECIAL_OLD_URL = 'https://opdcyccwracapxfxisfw.supabase.co';
const DEFAULT_SPECIAL_OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZGN5Y2N3cmFjYXB4Znhpc2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzkyMDUsImV4cCI6MjA5NTM1NTIwNX0.p4gmiTKIjcljdjoqzQn-S6z5YyrU9XvZPPKgnNF5_Cs';

export interface ActiveSupabaseConfig {
  url: string;
  key: string;
  newUrl: string;
  newKey: string;
  specialOldUrl: string;
  specialOldKey: string;
  projectRef: string;
  isCustom: boolean;
}

// Extract project ref from URL (e.g. https://abcdef.supabase.co -> abcdef)
export const extractProjectRef = (url: string): string => {
  try {
    const clean = (url || '').trim().replace(/^https?:\/\//, '');
    if (clean.includes('103.52.114.209')) {
      return 'VPS Supabase (103.52.114.209:8000)';
    }
    return clean.split('.')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
};

// Helper to get config
export const getConfig = (): ActiveSupabaseConfig => {
  // Khusus project 'kalindo scan server ujicoba', selalu gunakan DEFAULT_URL (VPS)
  // Bersihkan cache localStorage lama agar browser tidak pernah tertinggal di instance lama
  try {
    const keysToClean = ['active_supabase_url', 'active_supabase_key', 'supabase_url', 'supabase_key'];
    keysToClean.forEach(k => {
      const val = localStorage.getItem(k);
      if (val && !val.includes('103.52.114.209')) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {}

  return {
    url: DEFAULT_URL,
    key: DEFAULT_KEY,
    newUrl: DEFAULT_NEW_URL,
    newKey: DEFAULT_NEW_KEY,
    specialOldUrl: DEFAULT_SPECIAL_OLD_URL,
    specialOldKey: DEFAULT_SPECIAL_OLD_KEY,
    projectRef: extractProjectRef(DEFAULT_URL),
    isCustom: false
  };
};

// Resilient fetch handler to intercept and auto-recover from 401 Unauthorized errors caused by expired user sessions
const createCustomFetch = (validAnonKey: string, projectRef: string) => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let res = await fetch(input, init);
    if (res.status === 401) {
      console.warn('⚠️ Supabase 401 Unauthorized detected on:', typeof input === 'string' ? input : (input as any)?.url || 'request');
      const authHeader = (init?.headers as any)?.['Authorization'] || (init?.headers as any)?.['authorization'];
      
      // 1. If an expired user session JWT token was sent instead of the anon key, clean it and retry
      if (authHeader && authHeader !== `Bearer ${validAnonKey}`) {
        console.warn('🔄 Clearing stale/expired Supabase auth session from localStorage and retrying...');
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('sb-') && k.includes('auth-token')) {
              localStorage.removeItem(k);
            }
          });
        } catch (e) {}

        const newHeaders = new Headers(init?.headers);
        newHeaders.set('Authorization', `Bearer ${validAnonKey}`);
        newHeaders.set('apikey', validAnonKey);

        res = await fetch(input, {
          ...init,
          headers: newHeaders
        });
      }

      // 2. If still 401 and the project is the primary/fallback URL, ensure it uses the verified FALLBACK_KEY
      if (res.status === 401 && (String(input).includes('103.52.114.209') || String(input).includes('ldzsudeqrpmpjolpybsx') || String(input).includes('mpsmbmfsembyhmmvdtao') || String(input).includes('eekxcrkgsnaatgivccso') || String(input).includes('nufvlqrtpzfiqghsxsze'))) {
        console.warn('🔄 Retrying request with verified FALLBACK_KEY...');
        try {
          localStorage.setItem('active_supabase_key', FALLBACK_KEY);
          localStorage.setItem('supabase_key', FALLBACK_KEY);
        } catch (e) {}

        const newHeaders = new Headers(init?.headers);
        newHeaders.set('Authorization', `Bearer ${FALLBACK_KEY}`);
        newHeaders.set('apikey', FALLBACK_KEY);

        res = await fetch(input, {
          ...init,
          headers: newHeaders
        });
      }

      if (res.status !== 401) {
        console.log('✅ Supabase request auto-recovered successfully!');
      }
    }
    return res;
  };
};

let activeConfig = getConfig();

export let rawSupabase: SupabaseClient = createClient(activeConfig.url, activeConfig.key, {
  auth: {
    storageKey: `sb-${extractProjectRef(activeConfig.url)}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: createCustomFetch(activeConfig.key, extractProjectRef(activeConfig.url))
  }
});

// PRIMARY BACKEND: Supabase VPS (http://103.52.114.209:8000)
export let supabase: SupabaseClient = rawSupabase;

export let supabaseNew: SupabaseClient = createClient(activeConfig.newUrl, activeConfig.newKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
export let supabaseSpecialOld: SupabaseClient = createClient(activeConfig.specialOldUrl, activeConfig.specialOldKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

/**
 * Re-initialize Supabase clients safely.
 */
export const refreshSupabaseClients = () => {
  activeConfig = getConfig();

  rawSupabase = createClient(activeConfig.url, activeConfig.key, {
    auth: {
      storageKey: `sb-${extractProjectRef(activeConfig.url)}-auth-token`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: createCustomFetch(activeConfig.key, extractProjectRef(activeConfig.url))
    }
  });

  supabase = rawSupabase;

  supabaseNew = createClient(activeConfig.newUrl, activeConfig.newKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-sec-${extractProjectRef(activeConfig.newUrl)}`
    }
  });
  supabaseSpecialOld = createClient(activeConfig.specialOldUrl, activeConfig.specialOldKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `sb-spec-${extractProjectRef(activeConfig.specialOldUrl)}`
    }
  });
};

/**
 * Test connectivity to Supabase instance
 */
export const testSupabaseConnection = async (
  url?: string,
  key?: string
): Promise<{ success: boolean; message: string; rowCount?: number }> => {

  try {
    const cleanUrl = (url || '').trim();
    const cleanKey = (key || '').trim();

    if (!cleanUrl || !cleanKey) {
      return { success: false, message: 'URL dan Key tidak boleh kosong.' };
    }
    if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
      return { success: false, message: 'URL harus diawali dengan http:// atau https://' };
    }

    const testClient = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `test-${extractProjectRef(cleanUrl)}-${Date.now()}`
      },
      global: {
        fetch: createCustomFetch(cleanKey, extractProjectRef(cleanUrl))
      }
    });

    // Check table accessibility safely with head: true to count total rows without fetching data
    const { count, error } = await testClient
      .from('scanned_items')
      .select('id', { count: 'exact', head: true });

    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      const errCode = error.code || '';

      // 401 Unauthorized diagnostics
      if (errCode === '401' || errMsg.includes('jwt') || errMsg.includes('unauthorized') || errMsg.includes('invalid api key')) {
        return {
          success: false,
          message: 'Error 401 (Unauthorized): Anon Key tidak valid untuk project ini atau schema public belum diberi hak akses (GRANT). Pastikan menyalin Anon Key dari Project Settings > API project Supabase baru dan jalankan perintah Grant Permission.'
        };
      }

      // Permission denied
      if (errMsg.includes('permission denied') || errCode === '42501') {
        return {
          success: false,
          message: 'Error 42501 (Permission Denied): PostgREST belum memiliki izin akses ke schema public. Jalankan perintah Grant Permissions di SQL Editor atau via CMD.'
        };
      }

      // 404 or Table doesn't exist yet diagnostics
      if (errCode === '42P01' || errCode === '404' || errMsg.includes('relation "public.scanned_items" does not exist') || errMsg.includes('not found')) {
        return {
          success: true,
          message: 'Terkoneksi ke Supabase! (Catatan: Tabel scanned_items belum dibuat, silakan jalankan Master SQL Schema atau restore database).',
          rowCount: 0
        };
      }
      return { success: false, message: `Koneksi gagal: ${error.message}` };
    }

    return {
      success: true,
      message: 'Koneksi Berhasil! Terhubung ke tabel scanned_items.',
      rowCount: count !== null && count !== undefined ? count : 0
    };
  } catch (err: any) {
    return { success: false, message: `Error koneksi: ${err?.message || 'Tidak dapat menghubungi server'}` };
  }
};

/**
 * Set active Supabase credentials dynamically and optionally broadcast to all users via Firestore
 */
export const setActiveSupabaseCredentials = async (
  url: string,
  key: string,
  broadcastToAllUsers = true,
  adminUsername = 'Admin'
): Promise<void> => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  // 1. Save locally
  localStorage.setItem('active_supabase_url', cleanUrl);
  localStorage.setItem('active_supabase_key', cleanKey);
  localStorage.setItem('supabase_url', cleanUrl);
  localStorage.setItem('supabase_key', cleanKey);

  // 2. Refresh local client
  refreshSupabaseClients();

  // 3. Broadcast to all users via Firestore Real-Time Config
  // (Dinonaktifkan di project ujicoba ini agar tidak menimpa settingan Firestore project lain)
  if (false && broadcastToAllUsers && db) {
    try {
      const configRef = doc(db, 'system_config', 'supabase_active');
      await setDoc(configRef, {
        url: cleanUrl,
        key: cleanKey,
        project_ref: extractProjectRef(cleanUrl),
        updated_at: Date.now(),
        updated_by: adminUsername
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to broadcast active Supabase config to Firestore:', err);
    }
  }
};

/**
 * Listen to Firestore Remote Config for real-time hot-swap notifications across all user devices
 */
export const initRemoteSupabaseConfigListener = () => {
  // Dinonaktifkan khusus untuk project 'kalindo scan server ujicoba'
  // agar project ujicoba ini 100% mandiri dan tidak pernah mengganggu atau dipengaruhi Firestore project lain
  return () => {};
};

/**
 * Helper to check if a specific error implies a critical configuration mismatch
 */
export const isCriticalSupabaseError = (error: any): boolean => {
  if (!error) return false;

  const msg = typeof error === 'string' ? error.toLowerCase() : (error.message || '').toLowerCase();
  const code = error.code || '';

  if (msg.includes('project not found') || (msg.includes('not found') && code === '404')) {
    return true;
  }

  if (msg.includes('connection refused') || msg.includes('upstream connect error')) {
    return true;
  }

  return false;
};
