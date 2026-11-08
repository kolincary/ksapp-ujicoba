import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase, extractProjectRef } from './supabaseClient';

/**
 * DUAL-SUPABASE SERVICE (ACTIVE-STANDBY REAL-TIME REPLICATION & 7-DAY RETENTION)
 * 
 * Arsitektur:
 * 1. Primary DB (Supabase VPS 103.52.114.209): Menangani seluruh proses READ, SEARCH, dan VALIDASI scanner.
 * 2. Secondary DB (Supabase Cadangan): Menerima salinan seluruh operasi WRITE secara real-time (asynchronous non-blocking).
 * 3. 7-Day Retention: Hanya data pada Supabase Cadangan yang dibersihkan jika berumur > 7 hari (data VPS tetap utuh).
 */

export const STORAGE_BACKUP_URL = 'ks_dual_backup_supabase_url';
export const STORAGE_BACKUP_KEY = 'ks_dual_backup_supabase_key';
export const STORAGE_LAST_PURGE = 'last_backup_retention_run';

// Default Secondary Supabase instance (Supabase Archive / Backup)
export const DEFAULT_BACKUP_URL = 'https://ymolrxscthxxtlmnxmob.supabase.co';
export const DEFAULT_BACKUP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltb2xyeHNjdGh4eHRsbW54bW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjgzNzgsImV4cCI6MjA3OTk0NDM3OH0.Hv64EHm_eZE3QHKN8QkdDFnYAQT1f_7KTDcaRoFobi8';

export interface BackupSupabaseConfig {
  url: string;
  key: string;
  projectRef: string;
  isConfigured: boolean;
}

/**
 * Ambil konfigurasi Supabase Cadangan dari localStorage atau default
 */
export const getBackupSupabaseConfig = (): BackupSupabaseConfig => {
  let url = DEFAULT_BACKUP_URL;
  let key = DEFAULT_BACKUP_KEY;

  try {
    const savedUrl = localStorage.getItem(STORAGE_BACKUP_URL);
    const savedKey = localStorage.getItem(STORAGE_BACKUP_KEY);
    if (savedUrl && savedUrl.trim().startsWith('http')) {
      url = savedUrl.trim();
    }
    if (savedKey && savedKey.trim().length > 10) {
      key = savedKey.trim();
    }
  } catch (e) {
    console.warn('[DualSupabase] Failed to read backup config from storage', e);
  }

  return {
    url,
    key,
    projectRef: extractProjectRef(url),
    isConfigured: Boolean(url && key)
  };
};

// Singleton Client untuk Supabase Cadangan
let backupClientInstance: SupabaseClient | null = null;
let currentBackupUrl = '';
let currentBackupKey = '';

/**
 * Inisialisasi atau dapatkan client Supabase Cadangan
 */
export const getBackupClient = (): SupabaseClient | null => {
  const config = getBackupSupabaseConfig();
  if (!config.url || !config.key) return null;

  if (backupClientInstance && currentBackupUrl === config.url && currentBackupKey === config.key) {
    return backupClientInstance;
  }

  try {
    currentBackupUrl = config.url;
    currentBackupKey = config.key;

    backupClientInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `sb-backup-${config.projectRef}`,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      }
    });

    return backupClientInstance;
  } catch (err) {
    console.warn('[DualSupabase] Error creating backup client:', err);
    return null;
  }
};

/**
 * Simpan konfigurasi baru untuk Supabase Cadangan:
 * 1. Simpan ke localStorage (instan untuk perangkat Admin)
 * 2. Simpan ke tabel app_settings di Supabase VPS agar OTOMATIS tersinkron ke SELURUH user/scanner!
 */
export const setBackupSupabaseConfig = async (url: string, key: string): Promise<void> => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  // 1. Simpan di perangkat lokal
  try {
    localStorage.setItem(STORAGE_BACKUP_URL, cleanUrl);
    localStorage.setItem(STORAGE_BACKUP_KEY, cleanKey);
    // Reset instance agar client dibuat ulang dengan credential baru
    backupClientInstance = null;
    currentBackupUrl = '';
    currentBackupKey = '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kalindo_backup_config_changed'));
    }
  } catch (e) {
    console.error('[DualSupabase] Gagal menyimpan config cadangan ke localStorage', e);
  }

  // 2. Simpan ke database Supabase VPS (app_settings) agar disiarkan ke semua staf/scanner
  try {
    // Simpan URL Cadangan
    const { data: existingUrl } = await supabase
      .from('app_settings')
      .select('id')
      .eq('setting_key', 'backup_supabase_url')
      .maybeSingle();

    if (existingUrl?.id) {
      await supabase.from('app_settings').update({ setting_value: cleanUrl }).eq('id', existingUrl.id);
    } else {
      await supabase.from('app_settings').insert({ setting_key: 'backup_supabase_url', setting_value: cleanUrl });
    }

    // Simpan Key Cadangan
    const { data: existingKey } = await supabase
      .from('app_settings')
      .select('id')
      .eq('setting_key', 'backup_supabase_key')
      .maybeSingle();

    if (existingKey?.id) {
      await supabase.from('app_settings').update({ setting_value: cleanKey }).eq('id', existingKey.id);
    } else {
      await supabase.from('app_settings').insert({ setting_key: 'backup_supabase_key', setting_value: cleanKey });
    }

    console.log('[DualSupabase] ✅ Kredensial Supabase Cadangan berhasil disimpan ke app_settings Supabase VPS!');
  } catch (cloudErr) {
    console.warn('[DualSupabase] Warning: Gagal menyimpan ke app_settings Supabase VPS:', cloudErr);
  }
};

/**
 * Sinkronisasi kredensial Supabase Cadangan dari Supabase VPS (app_settings) ke perangkat user/scanner.
 * Dipanggil otomatis saat aplikasi dimuat di perangkat apapun.
 */
export const syncBackupConfigFromCloud = async (): Promise<BackupSupabaseConfig> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['backup_supabase_url', 'backup_supabase_key']);

    if (!error && data && data.length > 0) {
      const urlRow = data.find(r => r.setting_key === 'backup_supabase_url');
      const keyRow = data.find(r => r.setting_key === 'backup_supabase_key');

      let updated = false;
      if (urlRow?.setting_value && urlRow.setting_value.trim().startsWith('http')) {
        localStorage.setItem(STORAGE_BACKUP_URL, urlRow.setting_value.trim());
        updated = true;
      }
      if (keyRow?.setting_value && keyRow.setting_value.trim().length > 10) {
        localStorage.setItem(STORAGE_BACKUP_KEY, keyRow.setting_value.trim());
        updated = true;
      }

      if (updated) {
        backupClientInstance = null;
        currentBackupUrl = '';
        currentBackupKey = '';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('kalindo_backup_config_changed'));
        }
        console.log('[DualSupabase] ✅ Konfigurasi Supabase Cadangan disinkronkan dari VPS ke perangkat ini.');
      }
    }
  } catch (err) {
    console.warn('[DualSupabase] Error syncing backup config from VPS app_settings:', err);
  }

  return getBackupSupabaseConfig();
};

/**
 * Uji konektivitas ke Supabase Cadangan
 */
export const testBackupConnection = async (
  customUrl?: string,
  customKey?: string
): Promise<{ success: boolean; message: string; rowCount?: number; latencyMs?: number }> => {
  const startTime = Date.now();
  const url = (customUrl !== undefined ? customUrl : getBackupSupabaseConfig().url).trim();
  const key = (customKey !== undefined ? customKey : getBackupSupabaseConfig().key).trim();

  if (!url || !key) {
    return { success: false, message: 'URL dan Anon Key Supabase Cadangan tidak boleh kosong.' };
  }

  let controller: AbortController | null = null;
  let timeoutId: any = null;

  try {
    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timeoutId = setTimeout(() => {
        try { controller?.abort(); } catch {}
      }, 8000);
    }

    const testClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `sb-test-backup-${Date.now()}`,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      },
      global: {
        fetch: (input, init) => {
          return fetch(input, { ...init, signal: controller ? controller.signal : init?.signal });
        }
      }
    });

    // 1. Quick probe to check connectivity & credentials within milliseconds
    const probeRes = await testClient.from('scanned_items').select('id').limit(1);
    if (timeoutId) clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (probeRes.status === 401 || probeRes.error?.message?.toLowerCase().includes('invalid api key') || probeRes.error?.message?.toLowerCase().includes('jwt')) {
      return {
        success: false,
        message: 'Server Cadangan Aktif, namun Anon Key salah/tidak cocok. Harap salin Anon Public Key dari Project Settings > API pada project cadangan.',
        latencyMs
      };
    }

    if (probeRes.error) {
      if (probeRes.error.code === '42P01' || probeRes.error.message?.includes('does not exist')) {
        return {
          success: true,
          message: 'Terkoneksi ke Supabase Cadangan! (Tabel scanned_items belum dibuat, jalankan schema).',
          rowCount: 0,
          latencyMs
        };
      }
      return { success: false, message: `Gagal: ${probeRes.error.message} (${probeRes.error.code || 'ERR'})`, latencyMs };
    }

    // 2. Try fetching count optionally (fast background check)
    let totalRows: number | undefined = undefined;
    try {
      const countRes = await testClient.from('scanned_items').select('id', { count: 'exact', head: true });
      if (countRes.count !== null && countRes.count !== undefined) {
        totalRows = countRes.count;
      }
    } catch {}

    return {
      success: true,
      message: `Terkoneksi Normal ke Supabase Cadangan! (${latencyMs}ms)`,
      rowCount: totalRows,
      latencyMs
    };
  } catch (e: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (e?.name === 'AbortError') {
      return {
        success: false,
        message: 'Koneksi Timeout (>8 detik): Server cadangan tidak merespons tepat waktu.'
      };
    }
    const errMsg = e?.message || '';
    if (errMsg.includes('Failed to fetch') || errMsg.includes('ERR_NAME_NOT_RESOLVED') || errMsg.includes('NetworkError')) {
      return {
        success: false,
        message: 'Koneksi Gagal: Domain Supabase Cadangan tidak dapat diakses (ERR_NAME_NOT_RESOLVED). Periksa apakah ada salah ketik URL atau project di-pause.'
      };
    }
    return { success: false, message: `Error koneksi: ${errMsg || 'Server cadangan tidak merespons'}` };
  }
};

/* =========================================================================
   ASYNCHRONOUS NON-BLOCKING REPLICATION (FIRE-AND-FORGET)
   Sangat penting: Fungsi ini tidak pernah melempar error dan tidak pernah 
   menahan eksekusi scanner di gudang.
   ========================================================================= */

/**
 * Replikasi INSERT data ke Supabase Cadangan secara asynchronous di latar belakang.
 */
export const replicateBackupInsert = (table: string, records: any | any[]): void => {
  // Jalankan di next tick microtask agar tidak menahan proses UI scanner
  queueMicrotask(async () => {
    try {
      const client = getBackupClient();
      if (!client) return;

      const payload = Array.isArray(records) ? records : [records];
      if (payload.length === 0) return;

      const { error } = await client.from(table).insert(payload);
      if (error) {
        // Jika error unik (duplicate), tidak masalah karena data sudah ada di cadangan
        if (error.code === '23505') {
          return;
        }
        console.warn(`[DualSupabaseBackup] Replicate insert to "${table}" warning:`, error.message);
      }
    } catch (err) {
      console.warn(`[DualSupabaseBackup] Replicate insert to "${table}" network error (non-blocking):`, err);
    }
  });
};

/**
 * Replikasi UPSERT data ke Supabase Cadangan secara asynchronous.
 */
export const replicateBackupUpsert = (table: string, records: any | any[], onConflict?: string): void => {
  queueMicrotask(async () => {
    try {
      const client = getBackupClient();
      if (!client) return;

      const payload = Array.isArray(records) ? records : [records];
      if (payload.length === 0) return;

      const opts: any = {};
      if (onConflict) opts.onConflict = onConflict;

      const { error } = await client.from(table).upsert(payload, opts);
      if (error) {
        console.warn(`[DualSupabaseBackup] Replicate upsert to "${table}" warning:`, error.message);
      }
    } catch (err) {
      console.warn(`[DualSupabaseBackup] Replicate upsert to "${table}" network error (non-blocking):`, err);
    }
  });
};

/**
 * Replikasi UPDATE data ke Supabase Cadangan secara asynchronous.
 */
export const replicateBackupUpdate = (
  table: string,
  updates: any,
  matchFilter: { column: string; value?: any; inValues?: any[] }
): void => {
  queueMicrotask(async () => {
    try {
      const client = getBackupClient();
      if (!client) return;

      let query = client.from(table).update(updates);

      if (matchFilter.inValues && Array.isArray(matchFilter.inValues)) {
        query = query.in(matchFilter.column, matchFilter.inValues);
      } else if (matchFilter.value !== undefined) {
        query = query.eq(matchFilter.column, matchFilter.value);
      } else {
        return;
      }

      const { error } = await query;
      if (error) {
        console.warn(`[DualSupabaseBackup] Replicate update to "${table}" warning:`, error.message);
      }
    } catch (err) {
      console.warn(`[DualSupabaseBackup] Replicate update to "${table}" network error (non-blocking):`, err);
    }
  });
};

/**
 * Replikasi DELETE data ke Supabase Cadangan secara asynchronous.
 */
export const replicateBackupDelete = (
  table: string,
  matchFilter: { column: string; value?: any; inValues?: any[] }
): void => {
  queueMicrotask(async () => {
    try {
      const client = getBackupClient();
      if (!client) return;

      let query = client.from(table).delete();

      if (matchFilter.inValues && Array.isArray(matchFilter.inValues)) {
        query = query.in(matchFilter.column, matchFilter.inValues);
      } else if (matchFilter.value !== undefined) {
        query = query.eq(matchFilter.column, matchFilter.value);
      } else {
        return;
      }

      const { error } = await query;
      if (error) {
        console.warn(`[DualSupabaseBackup] Replicate delete to "${table}" warning:`, error.message);
      }
    } catch (err) {
      console.warn(`[DualSupabaseBackup] Replicate delete to "${table}" network error (non-blocking):`, err);
    }
  });
};

/* =========================================================================
   7-DAY RETENTION ENGINE (HANYA MENGHAPUS DI SUPABASE CADANGAN)
   Data di Supabase VPS TIDAK PERNAH disentuh/dihapus oleh fungsi ini.
   ========================================================================= */

/**
 * Hitung cutoff timestamp 7 hari.
 * Contoh: Jika hari ini 8 Nov 2026, 7 hari yang disimpan adalah 2 Nov s/d 8 Nov.
 * Data tanggal 1 Nov 23:59:59 ke belakang (< 2 Nov 00:00:00) akan dihapus.
 */
export const calculate7DayRetentionCutoff = (daysToKeep = 7): { cutoffTimestamp: number; cutoffDateStr: string } => {
  const cutoffDate = new Date();
  // Hari ini + 6 hari sebelumnya = total 7 hari disimpan
  cutoffDate.setDate(cutoffDate.getDate() - (daysToKeep - 1));
  cutoffDate.setHours(0, 0, 0, 0); // Tepat pukul 00:00:00

  const yyyy = cutoffDate.getFullYear();
  const mm = String(cutoffDate.getMonth() + 1).padStart(2, '0');
  const dd = String(cutoffDate.getDate()).padStart(2, '0');
  const cutoffDateStr = `${dd}-${mm}-${yyyy}`;

  return {
    cutoffTimestamp: cutoffDate.getTime(),
    cutoffDateStr
  };
};

export interface RetentionPurgeResult {
  success: boolean;
  deletedCount: number;
  cutoffDateStr: string;
  message: string;
  tableDetails?: Record<string, number>;
}

/**
 * Hapus data scan yang lebih lama dari 7 hari HANYA di Supabase Cadangan.
 */
export const purgeBackupOlderThan7Days = async (daysToKeep = 7): Promise<RetentionPurgeResult> => {
  const client = getBackupClient();
  if (!client) {
    return {
      success: false,
      deletedCount: 0,
      cutoffDateStr: '-',
      message: 'Client Supabase Cadangan belum terkonfigurasi.'
    };
  }

  const { cutoffTimestamp, cutoffDateStr } = calculate7DayRetentionCutoff(daysToKeep);
  let totalDeleted = 0;
  const tableDetails: Record<string, number> = {};

  try {
    // 1. Hapus di tabel scanned_items cadangan
    const { count: scanDeleted, error: scanErr } = await client
      .from('scanned_items')
      .delete({ count: 'exact' })
      .lt('timestamp', cutoffTimestamp);

    if (scanErr) {
      console.warn('[DualSupabasePurge] scanned_items purge warning:', scanErr.message);
    } else {
      const c = scanDeleted || 0;
      totalDeleted += c;
      tableDetails['scanned_items'] = c;
    }

    // 2. Hapus di tabel sortir_eliminations cadangan
    try {
      const { count: sortirDeleted } = await client
        .from('sortir_eliminations')
        .delete({ count: 'exact' })
        .lt('timestamp', cutoffTimestamp);
      if (sortirDeleted) {
        totalDeleted += sortirDeleted;
        tableDetails['sortir_eliminations'] = sortirDeleted;
      }
    } catch (e) {}

    // 3. Hapus di tabel leader_scan_2 cadangan
    try {
      const { count: leaderDeleted } = await client
        .from('leader_scan_2')
        .delete({ count: 'exact' })
        .lt('timestamp', cutoffTimestamp);
      if (leaderDeleted) {
        totalDeleted += leaderDeleted;
        tableDetails['leader_scan_2'] = leaderDeleted;
      }
    } catch (e) {}

    // 4. Hapus di tabel failed_scans cadangan
    try {
      const { count: failedDeleted } = await client
        .from('failed_scans')
        .delete({ count: 'exact' })
        .lt('timestamp', cutoffTimestamp);
      if (failedDeleted) {
        totalDeleted += failedDeleted;
        tableDetails['failed_scans'] = failedDeleted;
      }
    } catch (e) {}

    // Simpan log keberhasilan retensi
    try {
      const summary = {
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('id-ID'),
        cutoffDateStr,
        totalDeleted,
        tableDetails
      };
      localStorage.setItem(STORAGE_LAST_PURGE, JSON.stringify(summary));
    } catch (e) {}

    return {
      success: true,
      deletedCount: totalDeleted,
      cutoffDateStr,
      tableDetails,
      message: `Pembersihan berhasil! ${totalDeleted.toLocaleString()} data di Supabase Cadangan sebelum ${cutoffDateStr} telah dihapus.`
    };
  } catch (err: any) {
    console.error('[DualSupabasePurge] Error executing 7-day retention purge:', err);
    return {
      success: false,
      deletedCount: totalDeleted,
      cutoffDateStr,
      message: `Error pembersihan: ${err?.message || 'Gagal menghapus data lama'}`
    };
  }
};

/**
 * Jalankan retensi otomatis 7 hari sekali setiap hari (senyap di latar belakang).
 */
export const autoRunBackupRetentionOnceDaily = () => {
  if (typeof window === 'undefined') return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastRunKey = 'kalindo_last_backup_retention_date';

  try {
    if (localStorage.getItem(lastRunKey) === todayStr) {
      // Sudah dijalankan hari ini, lewati
      return;
    }

    // Jalankan dengan sedikit delay setelah inisialisasi aplikasi
    setTimeout(async () => {
      try {
        const res = await purgeBackupOlderThan7Days(7);
        if (res.success) {
          localStorage.setItem(lastRunKey, todayStr);
          console.log(`[DualSupabase] ✅ Retensi 7 hari berjalan otomatis. Dihapus: ${res.deletedCount} baris (sebelum ${res.cutoffDateStr}).`);
        }
      } catch (e) {
        console.warn('[DualSupabase] Background retention check error:', e);
      }
    }, 15000); // 15 detik setelah app start
  } catch (e) {}
};

/**
 * SCRIPT SQL RETENSI OTOMATIS (Bisa dijalankan langsung di SQL Editor Supabase Cadangan)
 */
export const RETENTION_7_DAYS_SQL = `-- =========================================================================
-- FUNGSI & TRIGGER RETENSI 7 HARI (JALANKAN DI SQL EDITOR SUPABASE CADANGAN)
-- Menghapus data scan yang lebih dari 7 hari secara otomatis
-- =========================================================================

CREATE OR REPLACE FUNCTION public.purge_cadangan_older_than_7_days()
RETURNS TABLE(scanned_deleted bigint, sortir_deleted bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_ts bigint;
  v_scan_cnt bigint;
  v_sortir_cnt bigint;
BEGIN
  -- Hitung cutoff 7 hari dalam milidetik (epoch ms)
  v_cutoff_ts := (EXTRACT(EPOCH FROM (now() - interval '7 days')) * 1000)::bigint;

  -- 1. Hapus dari scanned_items
  WITH deleted AS (
    DELETE FROM public.scanned_items
    WHERE timestamp < v_cutoff_ts
    RETURNING id
  )
  SELECT count(*) INTO v_scan_cnt FROM deleted;

  -- 2. Hapus dari sortir_eliminations
  WITH deleted AS (
    DELETE FROM public.sortir_eliminations
    WHERE timestamp < v_cutoff_ts
    RETURNING id
  )
  SELECT count(*) INTO v_sortir_cnt FROM deleted;

  -- 3. Hapus dari leader_scan_2
  DELETE FROM public.leader_scan_2 WHERE timestamp < v_cutoff_ts;

  -- 4. Hapus dari failed_scans
  DELETE FROM public.failed_scans WHERE timestamp < v_cutoff_ts;

  RETURN QUERY SELECT v_scan_cnt, v_sortir_cnt;
END;
$$;

-- Berikan izin akses eksekusi fungsi
GRANT EXECUTE ON FUNCTION public.purge_cadangan_older_than_7_days() TO anon, authenticated, service_role;
`;

