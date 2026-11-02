import { gineeSupabase as supabase } from './supabaseGineeClient';

export interface GineeCredentials {
  id?: number;
  appKey: string;
  appSecret: string;
  country: string;
  proxyMode: 'auto' | 'supabase' | 'server' | 'custom';
  customProxyUrl?: string;
  description?: string;
  isActive?: boolean;
}

const STORAGE_APP_KEY = 'ginee_app_key';
const STORAGE_APP_SECRET = 'ginee_app_secret';
const STORAGE_COUNTRY = 'ginee_country';
const STORAGE_PROXY_MODE = 'ginee_proxy_mode';
const STORAGE_CUSTOM_PROXY_URL = 'ginee_custom_proxy_url';

/**
 * Mengambil kredensial Ginee yang tersimpan di localStorage secara instan (synchronous).
 */
export function getLocalGineeCredentials(): GineeCredentials {
  try {
    return {
      appKey: localStorage.getItem(STORAGE_APP_KEY) || '',
      appSecret: localStorage.getItem(STORAGE_APP_SECRET) || '',
      country: localStorage.getItem(STORAGE_COUNTRY) || 'ID',
      proxyMode: ((localStorage.getItem(STORAGE_PROXY_MODE) as any) || 'auto'),
      customProxyUrl: localStorage.getItem(STORAGE_CUSTOM_PROXY_URL) || '',
    };
  } catch {
    return {
      appKey: '',
      appSecret: '',
      country: 'ID',
      proxyMode: 'auto',
      customProxyUrl: '',
    };
  }
}

/**
 * Menyimpan kredensial Ginee ke localStorage.
 */
export function setLocalGineeCredentials(cred: Partial<GineeCredentials>): void {
  try {
    if (cred.appKey !== undefined) localStorage.setItem(STORAGE_APP_KEY, cred.appKey.trim());
    if (cred.appSecret !== undefined) localStorage.setItem(STORAGE_APP_SECRET, cred.appSecret.trim());
    if (cred.country !== undefined) localStorage.setItem(STORAGE_COUNTRY, cred.country.trim());
    if (cred.proxyMode !== undefined) localStorage.setItem(STORAGE_PROXY_MODE, cred.proxyMode);
    if (cred.customProxyUrl !== undefined) localStorage.setItem(STORAGE_CUSTOM_PROXY_URL, cred.customProxyUrl.trim());
  } catch (err) {
    console.warn('[GineeCredentials] Error saving local credentials:', err);
  }
}

/**
 * Mengambil kredensial Ginee langsung dari tabel Supabase `ginee_credentials`.
 * Otomatis memperbarui cache localStorage jika data di Supabase lebih baru/valid.
 */
export async function fetchGineeCredentialsFromSupabase(): Promise<GineeCredentials> {
  const local = getLocalGineeCredentials();

  try {
    const { data, error } = await supabase
      .from('ginee_credentials')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[GineeCredentials] Supabase fetch notice:', error.message);
      return local;
    }

    if (data && data.length > 0) {
      const rec = data[0];
      const remoteCred: GineeCredentials = {
        id: rec.id,
        appKey: (rec.app_key || '').trim(),
        appSecret: (rec.app_secret || '').trim(),
        country: rec.country || 'ID',
        proxyMode: rec.proxy_mode || 'auto',
        customProxyUrl: rec.custom_proxy_url || '',
        description: rec.description,
        isActive: rec.is_active,
      };

      // Perbarui localStorage hanya jika ada nilai valid dari Supabase
      if (remoteCred.appKey && remoteCred.appSecret) {
        setLocalGineeCredentials(remoteCred);
        return remoteCred;
      }
    }
  } catch (err) {
    console.warn('[GineeCredentials] Failed to fetch credentials from Supabase:', err);
  }

  return local;
}

/**
 * Menyimpan atau memperbarui kredensial Ginee ke tabel Supabase `ginee_credentials`.
 * Sekaligus memperbarui localStorage di browser.
 */
export async function saveGineeCredentialsToSupabase(cred: Partial<GineeCredentials>): Promise<{ success: boolean; error?: any }> {
  // Simpan terlebih dahulu ke localStorage
  setLocalGineeCredentials(cred);

  try {
    const payload: any = {
      id: cred.id || 1,
      app_key: cred.appKey?.trim() || '',
      app_secret: cred.appSecret?.trim() || '',
      country: cred.country || 'ID',
      proxy_mode: cred.proxyMode || 'auto',
      custom_proxy_url: cred.customProxyUrl || '',
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (cred.description) payload.description = cred.description;

    const { error } = await supabase
      .from('ginee_credentials')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('[GineeCredentials] Error saving to Supabase:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[GineeCredentials] Exception saving to Supabase:', err);
    return { success: false, error: err };
  }
}

/**
 * Berlangganan (Subscribe) perubahan realtime kredensial Ginee di Supabase.
 * Ketika admin mengubah kunci API di Supabase, semua browser langsung diperbarui seketika.
 */
export function subscribeGineeCredentialsRealtime(onUpdate: (cred: GineeCredentials) => void) {
  try {
    const channel = supabase
      .channel('realtime_ginee_credentials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ginee_credentials' },
        (payload: any) => {
          const rec = payload.new;
          if (rec && rec.is_active) {
            const updated: GineeCredentials = {
              id: rec.id,
              appKey: (rec.app_key || '').trim(),
              appSecret: (rec.app_secret || '').trim(),
              country: rec.country || 'ID',
              proxyMode: rec.proxy_mode || 'auto',
              customProxyUrl: rec.custom_proxy_url || '',
              description: rec.description,
            };
            setLocalGineeCredentials(updated);
            onUpdate(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[GineeCredentials] Realtime subscription error:', err);
    return () => {};
  }
}
