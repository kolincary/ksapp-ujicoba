import { supabase } from './supabaseClient';

export interface DeviceCustomName {
  device_id: string;
  custom_name: string;
  note?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Mengambil semua nama kustom perangkat dari Supabase VPS
 */
export const fetchDeviceCustomNames = async (): Promise<Record<string, DeviceCustomName>> => {
  const map: Record<string, DeviceCustomName> = {};

  try {
    const { data, error } = await supabase
      .from('device_custom_names')
      .select('*');

    if (!error && Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.device_id) {
          map[item.device_id.trim()] = {
            device_id: item.device_id.trim(),
            custom_name: item.custom_name || '',
            note: item.note || '',
            updated_by: item.updated_by || 'admin',
            created_at: item.created_at,
            updated_at: item.updated_at
          };
        }
      });
    }
  } catch (supaErr) {
    console.warn('Gagal membaca device_custom_names dari Supabase:', supaErr);
  }

  return map;
};

/**
 * Menyimpan / memperbarui nama kustom perangkat ke Supabase VPS
 */
export const saveDeviceCustomName = async (
  deviceId: string,
  customName: string,
  note: string = '',
  updatedBy: string = 'admin'
): Promise<boolean> => {
  if (!deviceId || !deviceId.trim()) return false;
  const cleanId = deviceId.trim();
  const cleanName = (customName || '').trim();
  const nowIso = new Date().toISOString();

  const payload: DeviceCustomName = {
    device_id: cleanId,
    custom_name: cleanName,
    note: (note || '').trim(),
    updated_by: updatedBy,
    updated_at: nowIso
  };

  try {
    const { error } = await supabase
      .from('device_custom_names')
      .upsert(payload, { onConflict: 'device_id' });

    if (error) {
      console.error('Supabase upsert device_custom_names error:', error);
      throw error;
    }
    return true;
  } catch (supaErr: any) {
    console.error('Gagal menyimpan nama kustom perangkat:', supaErr);
    throw supaErr;
  }
};

/**
 * Menghapus nama kustom perangkat dari Supabase VPS
 */
export const deleteDeviceCustomName = async (deviceId: string): Promise<boolean> => {
  if (!deviceId || !deviceId.trim()) return false;
  const cleanId = deviceId.trim();

  try {
    const { error } = await supabase
      .from('device_custom_names')
      .delete()
      .eq('device_id', cleanId);

    if (error) {
      console.error('Gagal menghapus dari Supabase:', error);
      throw error;
    }
    return true;
  } catch (supaErr) {
    console.error('Gagal menghapus device_custom_names dari Supabase:', supaErr);
    throw supaErr;
  }
};

/**
 * Berlangganan perubahan realtime untuk nama kustom perangkat via Supabase Realtime
 */
export const subscribeDeviceCustomNames = (
  onChange: (names: Record<string, DeviceCustomName>) => void
) => {
  let isSubscribed = true;

  const fetchLatest = async () => {
    if (!isSubscribed) return;
    const names = await fetchDeviceCustomNames();
    if (isSubscribed) onChange(names);
  };

  // Ambil segera
  fetchLatest();

  // Berlangganan realtime Supabase
  const channel = supabase
    .channel('device_custom_names_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'device_custom_names' }, () => {
      fetchLatest();
    })
    .subscribe();

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
};
