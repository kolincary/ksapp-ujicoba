import { db } from './firebaseClient';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { forceLogoutDeviceSession } from './deviceTracker';

export interface DeviceAccessRule {
  id: string; // Format: `${cleanEmail}_${deviceId}`
  user_email: string;
  device_id: string;
  device_label?: string;
  status: 'ALLOWED' | 'BLOCKED';
  special_features?: string[]; // Hak akses fitur khusus untuk kombinasi akun + perangkat ini
  note?: string;
  created_at: number;
  created_by?: string;
  updated_at?: number;
}

export interface SpecialFeatureItem {
  id: string;
  label: string;
  description: string;
  badge?: string;
}

export const SPECIAL_ADMIN_FEATURES: SpecialFeatureItem[] = [
  {
    id: 'copy_logistik_comparison',
    label: 'Tombol Salin Komparasi Logistik',
    description: 'Menampilkan tombol Salin di kolom Picker/Ojol & Logistik pada menu Data Logistik, serta membuka izin seleksi barcode tanpa perlu ketik devmodenew.',
    badge: 'Data Logistik'
  },
  {
    id: 'devmode_auto_unlock',
    label: 'Auto DevMode Universal',
    description: 'Membuka otomatis semua fitur rahasia DevMode untuk perangkat ini tanpa perlu mengetik kata sandi devmodenew.',
    badge: 'Full DevMode'
  }
];

export interface UserSecuritySetting {
  user_email: string;
  whitelist_enabled: boolean;
  updated_at: number;
  updated_by?: string;
}

export interface DeviceAccessCheckResult {
  allowed: boolean;
  status: 'ALLOWED' | 'BLOCKED' | 'NOT_WHITELISTED' | 'NORMAL';
  reason?: string;
  rule?: DeviceAccessRule;
}

export const getCleanEmailKey = (userEmail: string): string => {
  return (userEmail || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
};

export const getDeviceRuleDocId = (userEmail: string, deviceId: string): string => {
  const cleanEmail = getCleanEmailKey(userEmail);
  return `${cleanEmail}_${(deviceId || '').trim()}`;
};

/**
 * Validasi apakah perangkat diizinkan untuk login ke user tertentu
 */
export const checkDeviceAccess = async (
  userEmail: string,
  deviceId: string
): Promise<DeviceAccessCheckResult> => {
  if (!userEmail || !deviceId) {
    return { allowed: true, status: 'NORMAL' };
  }

  const cleanEmail = getCleanEmailKey(userEmail);
  const ruleDocId = getDeviceRuleDocId(userEmail, deviceId);

  try {
    // 1. Cek aturan khusus perangkat untuk user ini
    const ruleRef = doc(db, 'device_access_rules', ruleDocId);
    const ruleSnap = await getDoc(ruleRef);

    if (ruleSnap.exists()) {
      const rule = ruleSnap.data() as DeviceAccessRule;
      if (rule.status === 'BLOCKED') {
        return {
          allowed: false,
          status: 'BLOCKED',
          reason: `ID Perangkat ini (${deviceId}) telah diblokir untuk akun ${userEmail}.`,
          rule
        };
      }
      if (rule.status === 'ALLOWED') {
        return { allowed: true, status: 'ALLOWED', rule };
      }
    }

    // 2. Cek apakah ada aturan global blacklist (_ALL_)
    const globalRuleRef = doc(db, 'device_access_rules', `_all_${deviceId.trim()}`);
    const globalSnap = await getDoc(globalRuleRef);
    if (globalSnap.exists()) {
      const gRule = globalSnap.data() as DeviceAccessRule;
      if (gRule.status === 'BLOCKED') {
        return {
          allowed: false,
          status: 'BLOCKED',
          reason: `ID Perangkat ini (${deviceId}) diblokir dari sistem.`,
          rule: gRule
        };
      }
    }

    // 3. Cek pengaturan Whitelist untuk user ini
    const settingRef = doc(db, 'user_security_settings', cleanEmail);
    const settingSnap = await getDoc(settingRef);

    if (settingSnap.exists()) {
      const setting = settingSnap.data() as UserSecuritySetting;
      if (setting.whitelist_enabled) {
        // Jika mode whitelist aktif dan perangkat belum berstatus ALLOWED, maka tolak
        return {
          allowed: false,
          status: 'NOT_WHITELISTED',
          reason: `Akun ${userEmail} mewajibkan perangkat terdaftar. ID Perangkat Anda (${deviceId}) belum diizinkan.`
        };
      }
    }

    // Default: Boleh login normal
    return { allowed: true, status: 'NORMAL' };
  } catch (err) {
    console.warn('Gagal memvalidasi akses perangkat, fallback izinkan:', err);
    return { allowed: true, status: 'NORMAL' };
  }
};

/**
 * Daftarkan / Izinkan perangkat ke Whitelist
 */
export const allowDevice = async (
  userEmail: string,
  deviceId: string,
  deviceLabel?: string,
  note?: string,
  createdBy: string = 'admin'
): Promise<boolean> => {
  const cleanEmail = getCleanEmailKey(userEmail);
  const ruleDocId = getDeviceRuleDocId(userEmail, deviceId);
  const ruleRef = doc(db, 'device_access_rules', ruleDocId);

  const payload: DeviceAccessRule = {
    id: ruleDocId,
    user_email: userEmail.toLowerCase().trim(),
    device_id: deviceId.trim(),
    device_label: deviceLabel || 'Perangkat Web',
    status: 'ALLOWED',
    note: note || '',
    created_at: Date.now(),
    created_by: createdBy,
    updated_at: Date.now()
  };

  await setDoc(ruleRef, payload, { merge: true });
  return true;
};

/**
 * Blokir perangkat (Blacklist) & otomatis putus sesi aktif
 */
export const blockDevice = async (
  userEmail: string,
  deviceId: string,
  deviceLabel?: string,
  note?: string,
  createdBy: string = 'admin'
): Promise<boolean> => {
  const cleanEmail = getCleanEmailKey(userEmail);
  const ruleDocId = getDeviceRuleDocId(userEmail, deviceId);
  const ruleRef = doc(db, 'device_access_rules', ruleDocId);

  const payload: DeviceAccessRule = {
    id: ruleDocId,
    user_email: userEmail.toLowerCase().trim(),
    device_id: deviceId.trim(),
    device_label: deviceLabel || 'Perangkat Web',
    status: 'BLOCKED',
    note: note || '',
    created_at: Date.now(),
    created_by: createdBy,
    updated_at: Date.now()
  };

  await setDoc(ruleRef, payload, { merge: true });

  // Otomatis kick sesi aktif jika ada
  try {
    await forceLogoutDeviceSession(ruleDocId);
  } catch (e) {
    // abaikan jika sesi tidak ada
  }

  return true;
};

/**
 * Hapus aturan perangkat (kembali ke netral)
 */
export const deleteDeviceRule = async (userEmail: string, deviceId: string): Promise<boolean> => {
  const ruleDocId = getDeviceRuleDocId(userEmail, deviceId);
  const ruleRef = doc(db, 'device_access_rules', ruleDocId);
  await deleteDoc(ruleRef);
  return true;
};

/**
 * Aktifkan / Nonaktifkan mode Whitelist ketat untuk user tertentu
 */
export const setUserWhitelistMode = async (
  userEmail: string,
  enabled: boolean,
  updatedBy: string = 'admin'
): Promise<boolean> => {
  const cleanEmail = getCleanEmailKey(userEmail);
  const settingRef = doc(db, 'user_security_settings', cleanEmail);

  const payload: UserSecuritySetting = {
    user_email: userEmail.toLowerCase().trim(),
    whitelist_enabled: enabled,
    updated_at: Date.now(),
    updated_by: updatedBy
  };

  await setDoc(settingRef, payload, { merge: true });
  return true;
};

/**
 * Cek apakah mode Whitelist aktif untuk user tertentu
 */
export const getUserWhitelistMode = async (userEmail: string): Promise<boolean> => {
  const cleanEmail = getCleanEmailKey(userEmail);
  const settingRef = doc(db, 'user_security_settings', cleanEmail);
  const snap = await getDoc(settingRef);
  if (snap.exists()) {
    const data = snap.data() as UserSecuritySetting;
    return !!data.whitelist_enabled;
  }
  return false;
};

/**
 * Real-time listener seluruh aturan akses perangkat
 */
export const subscribeAllDeviceRules = (
  onUpdate: (rules: DeviceAccessRule[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, 'device_access_rules');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: DeviceAccessRule[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as DeviceAccessRule);
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Error subscribing device access rules:', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Real-time listener seluruh pengaturan keamanan user (whitelist mode)
 */
export const subscribeAllUserSecuritySettings = (
  onUpdate: (settings: Record<string, UserSecuritySetting>) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, 'user_security_settings');
  return onSnapshot(
    colRef,
    (snap) => {
      const map: Record<string, UserSecuritySetting> = {};
      snap.forEach((d) => {
        const item = d.data() as UserSecuritySetting;
        if (item.user_email) {
          map[item.user_email.toLowerCase().trim()] = item;
        }
      });
      onUpdate(map);
    },
    (err) => {
      console.warn('Error subscribing user security settings:', err);
      if (onError) onError(err);
    }
  );
};

/**
 * Perbarui daftar fitur khusus untuk kombinasi akun + ID perangkat
 */
export const updateDeviceSpecialFeatures = async (
  userEmail: string,
  deviceId: string,
  features: string[],
  deviceLabel?: string,
  updatedBy: string = 'admin'
): Promise<boolean> => {
  if (!userEmail || !deviceId) return false;
  const cleanEmail = getCleanEmailKey(userEmail);
  const ruleDocId = getDeviceRuleDocId(userEmail, deviceId);
  const ruleRef = doc(db, 'device_access_rules', ruleDocId);

  const payload: Partial<DeviceAccessRule> = {
    id: ruleDocId,
    user_email: userEmail.toLowerCase().trim(),
    device_id: deviceId.trim(),
    status: 'ALLOWED', // Otomatis pastikan status ALLOWED saat fitur diberikan
    special_features: features,
    updated_at: Date.now()
  };

  if (deviceLabel) {
    payload.device_label = deviceLabel;
  }

  await setDoc(ruleRef, payload, { merge: true });
  return true;
};

/**
 * Toggle (aktif/nonaktif) satu fitur khusus pada suatu perangkat
 */
export const toggleDeviceSpecialFeature = async (
  userEmail: string,
  deviceId: string,
  featureId: string,
  currentFeatures: string[] = [],
  deviceLabel?: string
): Promise<boolean> => {
  const hasFeature = currentFeatures.includes(featureId);
  const nextFeatures = hasFeature
    ? currentFeatures.filter(f => f !== featureId)
    : [...currentFeatures, featureId];

  return updateDeviceSpecialFeatures(userEmail, deviceId, nextFeatures, deviceLabel);
};

/**
 * Cek apakah perangkat saat ini memiliki izin untuk fitur khusus tertentu
 */
export const checkDeviceHasFeature = (
  rules: DeviceAccessRule[] | Map<string, DeviceAccessRule> | undefined | null,
  userEmail: string | undefined | null,
  deviceId: string | undefined | null,
  featureKey: string
): boolean => {
  if (!rules || !userEmail || !deviceId || !featureKey) return false;

  const cleanEmail = getCleanEmailKey(userEmail);
  const cleanDeviceId = deviceId.trim();
  const ruleDocId = `${cleanEmail}_${cleanDeviceId}`;

  let rule: DeviceAccessRule | undefined;
  if (rules instanceof Map) {
    rule = rules.get(ruleDocId);
  } else if (Array.isArray(rules)) {
    rule = rules.find(r => r.id === ruleDocId || (r.user_email?.toLowerCase().trim() === cleanEmail && r.device_id?.trim() === cleanDeviceId));
  }

  if (!rule || rule.status === 'BLOCKED') return false;

  const features = rule.special_features || [];
  // Izin granted jika fitur spesifik ada atau jika memiliki devmode_auto_unlock
  return features.includes(featureKey) || features.includes('devmode_auto_unlock');
};
