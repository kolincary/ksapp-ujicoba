import { supabase as mainSupabase } from './supabaseClient';
import { fetchGineeCredentialsFromSupabase } from './gineeCredentialsService';
import { fetchGineeOrders, GineeApiConfig, GineeOrder } from './gineeService';
import { saveGineeOrdersToSupabase, reconcileCancelledOrdersWithTrackings, syncGineeCancelledOrdersToKalindo } from './gineeSupabaseService';
import { saveOrdersToIndexedDB, purgeExpiredOrdersFromIndexedDB } from './gineeIndexedDb';

export interface GineeSyncGlobalState {
  last_sync_time: string | null;  // ISO string timestamp
  status: 'IDLE' | 'SYNCING';
  locked_until: string | null;    // ISO string timestamp (distributed mutex)
  synced_by: string | null;       // Device or Client ID that performed the sync
  orders_count: number;
  last_error?: string | null;
  updated_at: string;
}

const SETTING_KEY = 'ginee_sync_state';
const GINEE_SYNC_ENABLED_KEY = 'ginee_sync_enabled';
const SYNC_THROTTLE_MS = 15 * 60 * 1000; // 15 menit interval aman antar PC
const LOCK_TIMEOUT_MS = 3 * 60 * 1000;   // 3 menit batas lock jika ada PC crash/freeze

/**
 * Memeriksa apakah fitur sinkronisasi Ginee diaktifkan secara global (ON/OFF).
 * Default: false (OFF / NONAKTIF) sehingga pengguna memiliki kendali penuh.
 */
export async function isGineeSyncEnabled(): Promise<boolean> {
  try {
    const { data, error } = await mainSupabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', GINEE_SYNC_ENABLED_KEY)
      .maybeSingle();

    if (!error && data && data.setting_value !== undefined && data.setting_value !== null) {
      const enabled = String(data.setting_value).trim().toLowerCase() === 'true';
      try { localStorage.setItem(GINEE_SYNC_ENABLED_KEY, enabled ? 'true' : 'false'); } catch {}
      return enabled;
    }

    try {
      const cached = localStorage.getItem(GINEE_SYNC_ENABLED_KEY);
      if (cached !== null) return cached === 'true';
    } catch {}
  } catch (err) {
    console.warn('[GineeSync] Warning reading isGineeSyncEnabled:', err);
  }
  return false; // DEFAULT: NONAKTIF (OFF)
}

/**
 * Mengubah status aktif/nonaktif sinkronisasi Ginee secara terpusat di Supabase
 */
export async function setGineeSyncEnabled(enabled: boolean): Promise<boolean> {
  try {
    try { localStorage.setItem(GINEE_SYNC_ENABLED_KEY, enabled ? 'true' : 'false'); } catch {}
    const { error } = await mainSupabase
      .from('app_settings')
      .upsert({
        setting_key: GINEE_SYNC_ENABLED_KEY,
        setting_value: enabled ? 'true' : 'false'
      }, { onConflict: 'setting_key' });

    if (error) {
      console.warn('[GineeSync] Warning setGineeSyncEnabled:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[GineeSync] Error setGineeSyncEnabled:', e);
    return false;
  }
}

/**
 * Mendapatkan ID unik browser/PC ini (stabil di localStorage)
 */
export function getLocalClientId(): string {
  try {
    let id = localStorage.getItem('kalindo_device_id');
    if (!id) {
      id = 'pc_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('kalindo_device_id', id);
    }
    const staffName = localStorage.getItem('kalindo_employee_name') || '';
    return staffName ? `${id} (${staffName})` : id;
  } catch {
    return 'pc_unknown';
  }
}

/**
 * Membaca status sinkronisasi global dari database pusat Supabase (app_settings)
 */
export async function getGlobalGineeSyncState(): Promise<GineeSyncGlobalState> {
  const defaultState: GineeSyncGlobalState = {
    last_sync_time: null,
    status: 'IDLE',
    locked_until: null,
    synced_by: null,
    orders_count: 0,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await mainSupabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle();

    if (error || !data || !data.setting_value) {
      // Fallback ke localStorage jika belum pernah ada di database
      const localLast = localStorage.getItem('ginee_last_sync_time');
      if (localLast) defaultState.last_sync_time = localLast;
      return defaultState;
    }

    const parsed = typeof data.setting_value === 'string'
      ? JSON.parse(data.setting_value)
      : data.setting_value;

    return {
      last_sync_time: parsed.last_sync_time || null,
      status: parsed.status === 'SYNCING' ? 'SYNCING' : 'IDLE',
      locked_until: parsed.locked_until || null,
      synced_by: parsed.synced_by || null,
      orders_count: typeof parsed.orders_count === 'number' ? parsed.orders_count : 0,
      last_error: parsed.last_error || null,
      updated_at: parsed.updated_at || new Date().toISOString()
    };
  } catch (err) {
    console.warn('[GineeGlobalSync] Gagal membaca state dari Supabase:', err);
    const localLast = localStorage.getItem('ginee_last_sync_time');
    if (localLast) defaultState.last_sync_time = localLast;
    return defaultState;
  }
}

/**
 * Mencoba mengunci status sinkronisasi (Distributed Mutex)
 * Mencegah 5 PC melakukan sinkronisasi serentak atau bentrok
 */
export async function acquireGlobalSyncLock(
  clientId: string,
  isManual = false
): Promise<{ canSync: boolean; reason?: 'LOCKED' | 'FRESH' | 'ERROR'; state: GineeSyncGlobalState }> {
  const state = await getGlobalGineeSyncState();
  const now = Date.now();

  // 1. Cek apakah ada PC lain yang sedang aktif melakukan sinkronisasi
  if (state.status === 'SYNCING' && state.locked_until) {
    const lockTime = new Date(state.locked_until).getTime();
    if (!isNaN(lockTime) && lockTime > now) {
      // Masih terkunci oleh PC lain
      console.log(`[GineeGlobalSync] Sinkronisasi sedang dijalankan oleh PC lain: ${state.synced_by}. Dilewati.`);
      return { canSync: false, reason: 'LOCKED', state };
    }
  }

  // 2. Throttling: Jika bukan sinkron manual, cek apakah sudah pernah disinkron oleh PC manapun dalam 15 menit terakhir
  if (!isManual && state.last_sync_time) {
    const lastSyncMs = new Date(state.last_sync_time).getTime();
    if (!isNaN(lastSyncMs) && now - lastSyncMs < SYNC_THROTTLE_MS) {
      console.log(`[GineeGlobalSync] Data di Supabase masih segar (<15 menit lalu oleh ${state.synced_by || 'PC lain'}). Sinkron Ginee Open API dilewati.`);
      return { canSync: false, reason: 'FRESH', state };
    }
  }

  // 3. Ambil Kunci (Acquire Lock)
  const lockedUntil = new Date(now + LOCK_TIMEOUT_MS).toISOString();
  const newState: GineeSyncGlobalState = {
    ...state,
    status: 'SYNCING',
    locked_until: lockedUntil,
    synced_by: clientId,
    updated_at: new Date().toISOString()
  };

  try {
    await mainSupabase
      .from('app_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: JSON.stringify(newState)
      }, { onConflict: 'setting_key' });

    return { canSync: true, state: newState };
  } catch (err) {
    console.error('[GineeGlobalSync] Gagal klaim lock di Supabase:', err);
    return { canSync: false, reason: 'ERROR', state };
  }
}

/**
 * Melepaskan kunci sinkronisasi setelah selesai atau error
 */
export async function releaseGlobalSyncLock(
  clientId: string,
  success: boolean,
  ordersCount: number,
  errorMsg?: string
): Promise<void> {
  const state = await getGlobalGineeSyncState();
  const nowIso = new Date().toISOString();

  const finalState: GineeSyncGlobalState = {
    last_sync_time: success ? nowIso : state.last_sync_time,
    status: 'IDLE',
    locked_until: null,
    synced_by: clientId,
    orders_count: success ? ordersCount : state.orders_count,
    last_error: errorMsg || null,
    updated_at: nowIso
  };

  try {
    await mainSupabase
      .from('app_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: JSON.stringify(finalState)
      }, { onConflict: 'setting_key' });

    // Perbarui juga cache lokal browser
    if (success) {
      localStorage.setItem('ginee_last_sync_time', nowIso);
    }
  } catch (err) {
    console.warn('[GineeGlobalSync] Gagal melepas lock di Supabase:', err);
  }
}

/**
 * Menjalankan Sinkronisasi Ginee Terpusat di Latar Belakang (Universal: di menu manapun)
 * Aman untuk multi-PC, otomatis mengunci dan menggunakan last_sync_time terpusat.
 */
export async function runGlobalGineeBackgroundSync(options: {
  isManual?: boolean;
  onProgress?: (msg: string) => void;
} = {}): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  count?: number;
  error?: string;
}> {
  const { isManual = false, onProgress } = options;

  // 0. Cek apakah fitur sinkronisasi sedang DINONAKTIFKAN (Status: OFF)
  const isEnabled = await isGineeSyncEnabled();
  if (!isEnabled && !isManual) {
    return {
      success: true,
      skipped: true,
      reason: 'Fitur sinkronisasi Ginee sedang dinonaktifkan (Status: OFF).',
      count: 0
    };
  }

  const clientId = getLocalClientId();

  // 1. Klaim lock
  const lockResult = await acquireGlobalSyncLock(clientId, isManual);
  if (!lockResult.canSync) {
    return {
      success: true,
      skipped: true,
      reason: lockResult.reason === 'LOCKED'
        ? `Sedang disinkronkan oleh ${lockResult.state.synced_by || 'PC lain'}`
        : 'Data sudah tersinkron baru (<15 menit lalu)',
      count: lockResult.state.orders_count
    };
  }

  if (onProgress) onProgress('Mengambil kredensial API Ginee...');

  let totalFetched = 0;
  try {
    // 2. Ambil Kredensial aktif dari Supabase
    const cred = await fetchGineeCredentialsFromSupabase();
    if (!cred.appKey || !cred.appSecret) {
      await releaseGlobalSyncLock(clientId, false, 0, 'Kredensial API Ginee belum diatur');
      return { success: false, error: 'Kredensial API Ginee belum diatur di tabel ginee_credentials.' };
    }

    const config: GineeApiConfig = {
      appKey: cred.appKey,
      appSecret: cred.appSecret,
      country: cred.country || 'ID',
      proxyMode: cred.proxyMode || 'auto',
      customProxyUrl: cred.customProxyUrl || ''
    };

    // 3. Tentukan Rentang Tanggal Pintar Berdasarkan last_sync_time Pusat
    const now = new Date();
    let from: Date;

    if (lockResult.state.last_sync_time) {
      const lastSyncDate = new Date(lockResult.state.last_sync_time);
      if (!isNaN(lastSyncDate.getTime())) {
        // Buffer 2 jam sebelum lastSyncDate untuk menangkap update status / pembatalan terbaru
        const bufferedStart = new Date(lastSyncDate.getTime() - 2 * 3600000);
        const maxBacktrackMs = 14 * 86400000; // batas aman maksimal 14 hari
        if (now.getTime() - bufferedStart.getTime() > maxBacktrackMs) {
          from = new Date(now.getTime() - maxBacktrackMs);
        } else {
          from = bufferedStart;
        }
      } else {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      }
    } else {
      // Default: hari ini
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }

    const formatLocalDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const dateFromStr = formatLocalDate(from);
    const dateToStr = formatLocalDate(now);

    if (onProgress) onProgress(`Mengambil pesanan toko dari Ginee (${dateFromStr} s/d ${dateToStr})...`);

    // 4. Tarik data dari Ginee Open API
    const fetchedOrders = await fetchGineeOrders({
      config,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      onProgress: (step, total, msg) => {
        if (onProgress) onProgress(`(${step}/${total}) ${msg}`);
      }
    });

    totalFetched = fetchedOrders.length;

    // 5. Simpan ke IndexedDB lokal PC ini (agar Scan & Kirim instan tanpa loading)
    try {
      await saveOrdersToIndexedDB(fetchedOrders);
      await purgeExpiredOrdersFromIndexedDB(7);
    } catch (idbErr) {
      console.warn('[GineeGlobalSync] IndexedDB warning:', idbErr);
    }

    // 6. Simpan ke database terpusat Supabase (ginee_orders & cancelled_orders)
    if (onProgress) onProgress(`Menyimpan ${totalFetched} pesanan ke database Supabase pusat...`);
    const saveRes = await saveGineeOrdersToSupabase(fetchedOrders);
    if (!saveRes.success) {
      console.warn('[GineeGlobalSync] Supabase save notice:', saveRes.error);
    }

    // 7. Sinkronkan pembatalan ke Kalindo cancelled_orders
    try {
      await reconcileCancelledOrdersWithTrackings();
      await syncGineeCancelledOrdersToKalindo();
    } catch (cancelErr) {
      console.warn('[GineeGlobalSync] Cancel reconcile notice:', cancelErr);
    }

    // 8. Lepas lock dengan status BERHASIL
    await releaseGlobalSyncLock(clientId, true, totalFetched);

    console.log(`[GineeGlobalSync] ✓ Selesai! ${totalFetched} pesanan tersinkron dari Ginee ke database pusat oleh ${clientId}.`);
    return { success: true, count: totalFetched };
  } catch (err: any) {
    console.error('[GineeGlobalSync] Error sinkronisasi Ginee:', err);
    await releaseGlobalSyncLock(clientId, false, totalFetched, err?.message || 'Error tidak diketahui');
    return { success: false, error: err?.message || 'Gagal sinkronisasi Ginee' };
  }
}

/**
 * Inisialisasi scheduler otomatis di level aplikasi (App.tsx)
 * Berjalan di latar belakang di MENU APAPUN tanpa mengganggu user.
 */
let isSchedulerRunning = false;
export function initGineeGlobalSyncScheduler(): void {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  // 1. Eksekusi pertama kali 5 detik setelah aplikasi terbuka (memberi waktu UI render mulus)
  setTimeout(() => {
    runGlobalGineeBackgroundSync({ isManual: false }).catch(err => {
      console.warn('[GineeGlobalSync] Initial background sync error:', err);
    });
  }, 5000);

  // 2. Cek berkala setiap 10 menit
  setInterval(() => {
    runGlobalGineeBackgroundSync({ isManual: false }).catch(err => {
      console.warn('[GineeGlobalSync] Periodic background sync error:', err);
    });
  }, 10 * 60 * 1000);
}
