import { db } from './firebaseClient';
import { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';

export interface DeviceInfo {
  deviceId: string;
  deviceLabel: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
  screenRes: string;
}

export interface UserDeviceSession {
  id: string;
  user_email: string;
  employee_name: string;
  role: string;
  device_id: string;
  device_label: string;
  device_type: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  browser: string;
  screen_res: string;
  last_active: number;
  login_time: number;
  login_status: 'LOGGED_IN' | 'LOGGED_OUT';
  force_logout: boolean;
  ip?: string;
}

// 1. Dapatkan atau buat Device ID unik per browser/perangkat
export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'DEV-UNKNOWN';
  const STORAGE_KEY = 'kalindo_device_id';
  let devId = localStorage.getItem(STORAGE_KEY);
  if (!devId) {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const prefix = isMobile ? 'MOB' : 'PC';
    let osShort = 'GEN';
    if (/Windows/i.test(ua)) osShort = 'WIN';
    else if (/Android/i.test(ua)) osShort = 'AND';
    else if (/iPhone|iPad|iPod/i.test(ua)) osShort = 'IOS';
    else if (/Mac/i.test(ua)) osShort = 'MAC';
    else if (/Linux/i.test(ua)) osShort = 'LIN';

    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    devId = `DEV-${prefix}-${osShort}-${rand}`;
    localStorage.setItem(STORAGE_KEY, devId);
  }
  return devId;
};

// 2. Deteksi detail info hardware & browser
export const getDeviceInfo = (): DeviceInfo => {
  const deviceId = getDeviceId();
  if (typeof window === 'undefined') {
    return {
      deviceId,
      deviceLabel: 'Perangkat Web',
      deviceType: 'Desktop',
      os: 'Unknown OS',
      browser: 'Unknown Browser',
      screenRes: 'Unknown'
    };
  }

  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iPhone/i.test(ua)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(ua)) os = 'iPad (iPadOS)';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser Web';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/iPad|Tablet/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024 && window.innerWidth > 600)) {
    deviceType = 'Tablet';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth <= 600) {
    deviceType = 'Mobile';
  }

  const screenRes = `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`;
  const deviceLabel = `${deviceType === 'Mobile' ? 'HP' : (deviceType === 'Tablet' ? 'Tablet' : 'PC/Laptop')} (${os} • ${browser})`;

  return {
    deviceId,
    deviceLabel,
    deviceType,
    os,
    browser,
    screenRes
  };
};

// 3. Heartbeat & Activity Tracker
let activeHeartbeatInterval: any = null;
let activeUnsubSession: (() => void) | null = null;

export const startDeviceTracking = (
  userEmail: string,
  employeeName: string,
  role: string,
  onForceLogout?: () => void
) => {
  if (!userEmail) return;

  const device = getDeviceInfo();
  const cleanEmail = userEmail.toLowerCase().trim();
  const sessionDocId = `${cleanEmail.replace(/[^a-z0-9_-]/g, '_')}_${device.deviceId}`;

  const sendHeartbeat = async (status: 'LOGGED_IN' | 'LOGGED_OUT' = 'LOGGED_IN') => {
    try {
      const sessionRef = doc(db, 'user_device_sessions', sessionDocId);
      await setDoc(sessionRef, {
        id: sessionDocId,
        user_email: cleanEmail,
        employee_name: employeeName || userEmail,
        role: role || 'STAFF',
        device_id: device.deviceId,
        device_label: device.deviceLabel,
        device_type: device.deviceType,
        os: device.os,
        browser: device.browser,
        screen_res: device.screenRes,
        last_active: Date.now(),
        login_status: status,
        login_time: status === 'LOGGED_IN' ? (localStorage.getItem(`login_time_${sessionDocId}`) ? Number(localStorage.getItem(`login_time_${sessionDocId}`)) : Date.now()) : Date.now(),
        force_logout: false
      }, { merge: true });

      if (status === 'LOGGED_IN' && !localStorage.getItem(`login_time_${sessionDocId}`)) {
        localStorage.setItem(`login_time_${sessionDocId}`, Date.now().toString());
      }
    } catch (err) {
      console.warn("Device tracking heartbeat error:", err);
    }
  };

  // Initial update
  sendHeartbeat('LOGGED_IN');

  // Bersihkan interval & listener sebelumnya jika ada
  if (activeHeartbeatInterval) clearInterval(activeHeartbeatInterval);
  if (activeUnsubSession) activeUnsubSession();

  // Heartbeat setiap 25 detik
  activeHeartbeatInterval = setInterval(() => {
    sendHeartbeat('LOGGED_IN');
  }, 25000);

  // Listener real-time untuk Force Logout khusus perangkat ini
  try {
    const sessionRef = doc(db, 'user_device_sessions', sessionDocId);
    activeUnsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.force_logout === true) {
          if (onForceLogout) {
            onForceLogout();
          }
        }
      }
    });
  } catch (listenerErr) {
    console.warn("Device session listener error:", listenerErr);
  }
};

export const stopDeviceTracking = async (userEmail: string) => {
  if (activeHeartbeatInterval) {
    clearInterval(activeHeartbeatInterval);
    activeHeartbeatInterval = null;
  }
  if (activeUnsubSession) {
    activeUnsubSession();
    activeUnsubSession = null;
  }

  if (!userEmail) return;
  try {
    const deviceId = getDeviceId();
    const cleanEmail = userEmail.toLowerCase().trim();
    const sessionDocId = `${cleanEmail.replace(/[^a-z0-9_-]/g, '_')}_${deviceId}`;
    const sessionRef = doc(db, 'user_device_sessions', sessionDocId);
    await updateDoc(sessionRef, {
      login_status: 'LOGGED_OUT',
      last_active: Date.now(),
      last_logout: Date.now()
    });
    localStorage.removeItem(`login_time_${sessionDocId}`);
  } catch (e) {}
};

// 4. Force Logout perangkat tertentu oleh Admin
export const forceLogoutDeviceSession = async (sessionDocId: string) => {
  try {
    const sessionRef = doc(db, 'user_device_sessions', sessionDocId);
    await updateDoc(sessionRef, {
      force_logout: true,
      login_status: 'LOGGED_OUT',
      last_active: Date.now()
    });
    return true;
  } catch (err) {
    console.error("Error force logout device:", err);
    throw err;
  }
};

// 5. Force Logout SEMUA perangkat milik user tertentu (misal: semua perangkat admin2)
export const forceLogoutAllUserDevices = async (userEmail: string) => {
  try {
    const cleanEmail = userEmail.toLowerCase().trim();
    const q = query(collection(db, 'user_device_sessions'), where('user_email', '==', cleanEmail));
    const snap = await getDocs(q);
    const updates = snap.docs.map(d =>
      updateDoc(d.ref, {
        force_logout: true,
        login_status: 'LOGGED_OUT',
        last_active: Date.now()
      })
    );
    await Promise.all(updates);
    return true;
  } catch (err) {
    console.error("Error force logout all user devices:", err);
    throw err;
  }
};

// 6. Hapus catatan sesi perangkat dari Firestore
export const deleteDeviceSession = async (sessionDocId: string) => {
  try {
    const sessionRef = doc(db, 'user_device_sessions', sessionDocId);
    await deleteDoc(sessionRef);
    return true;
  } catch (err) {
    console.error("Error deleting device session:", err);
    throw err;
  }
};

// 7. Subscribe real-time seluruh sesi perangkat aktif
export const subscribeDeviceSessions = (
  onUpdate: (sessions: UserDeviceSession[]) => void,
  onError?: (err: any) => void
) => {
  const colRef = collection(db, 'user_device_sessions');
  return onSnapshot(
    colRef,
    (snap) => {
      const list: UserDeviceSession[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserDeviceSession;
        list.push({ ...data, id: docSnap.id });
      });
      // Urutkan: Yang baru aktif di atas
      list.sort((a, b) => (b.last_active || 0) - (a.last_active || 0));
      onUpdate(list);
    },
    (err) => {
      console.warn("Error subscribing to device sessions:", err);
      if (onError) onError(err);
    }
  );
};

