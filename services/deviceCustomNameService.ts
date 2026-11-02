import { supabase } from './supabaseClient';
import { db } from './firebaseClient';
import {
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';

export interface DeviceCustomName {
  device_id: string;
  custom_name: string;
  note?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Mengambil semua nama kustom perangkat (Sinkronisasi ganda: Supabase + Firestore)
 */
export const fetchDeviceCustomNames = async (): Promise<Record<string, DeviceCustomName>> => {
  const map: Record<string, DeviceCustomName> = {};

  // 1. Ambil dari Firestore (sangat andal dan realtime)
  try {
    const colRef = collection(db, 'device_custom_names');
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const item = d.data() as DeviceCustomName;
      if (item && item.device_id) {
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
  } catch (fsErr) {
    console.warn('Gagal membaca device_custom_names dari Firestore:', fsErr);
  }

  // 2. Ambil dari Supabase (jika tabel sudah ada & izin sudah di-grant)
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
 * Menyimpan / memperbarui nama kustom perangkat.
 * Disimpan secara ganda ke Firestore & Supabase agar tidak pernah gagal / terblokir error izin!
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

  let firestoreSuccess = false;

  // 1. Simpan ke Firestore (Pasti berhasil tanpa masalah hak akses role anon)
  try {
    const docRef = doc(db, 'device_custom_names', cleanId);
    await setDoc(docRef, payload, { merge: true });
    firestoreSuccess = true;
  } catch (fsErr) {
    console.error('Gagal menyimpan ke Firestore device_custom_names:', fsErr);
  }

  // 2. Simpan juga ke Supabase
  try {
    const { error } = await supabase
      .from('device_custom_names')
      .upsert(payload, { onConflict: 'device_id' });

    if (error) {
      console.warn('Supabase upsert notice (disimpan melalui Firestore fallback):', error.message);
      // Jika Firestore sukses, jangan lempar error agar UI user tetap lancar
      if (!firestoreSuccess) {
        if (error.code === '42501') {
          throw new Error(
            'Izin database Supabase belum diberikan (Error 42501). Jalankan SQL berikut di Supabase SQL Editor:\nGRANT ALL ON TABLE public.device_custom_names TO anon, authenticated;'
          );
        }
        throw error;
      }
    }
  } catch (supaErr: any) {
    console.warn('Supabase upsert failed:', supaErr);
    if (!firestoreSuccess) {
      throw supaErr;
    }
  }

  return true;
};

/**
 * Menghapus nama kustom perangkat dari Firestore & Supabase
 */
export const deleteDeviceCustomName = async (deviceId: string): Promise<boolean> => {
  if (!deviceId || !deviceId.trim()) return false;
  const cleanId = deviceId.trim();

  // Hapus dari Firestore
  try {
    const docRef = doc(db, 'device_custom_names', cleanId);
    await deleteDoc(docRef);
  } catch (fsErr) {
    console.warn('Gagal menghapus dari Firestore:', fsErr);
  }

  // Hapus dari Supabase
  try {
    await supabase
      .from('device_custom_names')
      .delete()
      .eq('device_id', cleanId);
  } catch (supaErr) {
    console.warn('Gagal menghapus dari Supabase:', supaErr);
  }

  return true;
};

/**
 * Berlangganan perubahan realtime untuk nama kustom perangkat
 * Menggunakan listener Firestore yang instan dan handal
 */
export const subscribeDeviceCustomNames = (
  onChange: (names: Record<string, DeviceCustomName>) => void
) => {
  let isSubscribed = true;

  // Realtime listener dari Firestore
  const colRef = collection(db, 'device_custom_names');
  const unsubFirestore = onSnapshot(
    colRef,
    (snap) => {
      if (!isSubscribed) return;
      const map: Record<string, DeviceCustomName> = {};
      snap.forEach((d) => {
        const item = d.data() as DeviceCustomName;
        if (item && item.device_id) {
          map[item.device_id.trim()] = item;
        }
      });
      onChange(map);
    },
    (err) => {
      console.warn('Firestore subscription notice:', err);
    }
  );

  return () => {
    isSubscribed = false;
    unsubFirestore();
  };
};
