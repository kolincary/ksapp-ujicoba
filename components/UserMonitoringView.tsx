import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  Users,
  CheckCircle,
  Search,
  X,
  Copy,
  LogOut,
  Trash2,
  Check,
  UserX,
  Info,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Lock,
  Unlock,
  SlidersHorizontal,
  Pencil
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import {
  getDeviceId,
  forceLogoutDeviceSession,
  forceLogoutAllUserDevices,
  deleteDeviceSession,
  subscribeDeviceSessions,
  UserDeviceSession
} from '../services/deviceTracker';
import { DeviceFeatureModal } from './DeviceFeatureModal';
import { EditDeviceNameModal } from './EditDeviceNameModal';
import {
  DeviceCustomName,
  fetchDeviceCustomNames,
  subscribeDeviceCustomNames
} from '../services/deviceCustomNameService';
import {
  DeviceAccessRule,
  UserSecuritySetting,
  allowDevice,
  blockDevice,
  deleteDeviceRule,
  setUserWhitelistMode,
  subscribeAllDeviceRules,
  subscribeAllUserSecuritySettings,
  getDeviceRuleDocId
} from '../services/deviceSecurityService';

interface UserMonitoringViewProps {
  onShowToast?: (message: string) => void;
  isDarkMode?: boolean;
}

export const UserMonitoringView: React.FC<UserMonitoringViewProps> = ({
  onShowToast,
  isDarkMode
}) => {
  // Tab State
  const [monitoringTab, setMonitoringTab] = useState<'DEVICES' | 'ACCOUNTS'>('DEVICES');

  // Multi-Device Tracking State
  const [deviceSessions, setDeviceSessions] = useState<UserDeviceSession[]>([]);
  const [isLoadingDeviceSessions, setIsLoadingDeviceSessions] = useState(false);
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('');
  const deferredDeviceSearch = useDeferredValue(deviceSearchTerm);
  const [deviceFilterStatus, setDeviceFilterStatus] = useState<
    'ALL' | 'ONLINE' | 'OFFLINE' | 'ALLOWED' | 'BLOCKED'
  >('ALL');
  const [deviceFilterType, setDeviceFilterType] = useState<'ALL' | 'Desktop' | 'Mobile' | 'Tablet'>('ALL');
  const [devicePage, setDevicePage] = useState(1);
  const [devicePageSize, setDevicePageSize] = useState(12);
  const [isFilterPillsExpanded, setIsFilterPillsExpanded] = useState(false);

  // Security Rules & Whitelist Settings State
  const [deviceRules, setDeviceRules] = useState<DeviceAccessRule[]>([]);
  const [userSecuritySettings, setUserSecuritySettings] = useState<Record<string, UserSecuritySetting>>({});
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  const [isManageRulesModalOpen, setIsManageRulesModalOpen] = useState(false);
  const [featureModalAdmin, setFeatureModalAdmin] = useState<string | null>(null);
  const [customDeviceNames, setCustomDeviceNames] = useState<Record<string, DeviceCustomName>>({});
  const [editingCustomNameDevice, setEditingCustomNameDevice] = useState<{
    deviceId: string;
    currentName?: string;
    currentNote?: string;
  } | null>(null);

  // Subscribe ke custom nama perangkat di Supabase
  useEffect(() => {
    const unsub = subscribeDeviceCustomNames((names) => {
      setCustomDeviceNames(names);
    });
    return () => unsub();
  }, []);
  const [rulesSearchTerm, setRulesSearchTerm] = useState('');

  // Form State for Manual Device Registration
  const [manualUserEmail, setManualUserEmail] = useState('');
  const [manualDeviceId, setManualDeviceId] = useState('');
  const [manualDeviceLabel, setManualDeviceLabel] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualAction, setManualAction] = useState<'ALLOWED' | 'BLOCKED'>('ALLOWED');
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // User Accounts State (Supabase)
  const [userActivityData, setUserActivityData] = useState<any[]>([]);
  const [isLoadingUserActivity, setIsLoadingUserActivity] = useState(false);
  const [selectedUserMonitoring, setSelectedUserMonitoring] = useState<string[]>([]);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const deferredAccountSearch = useDeferredValue(accountSearchTerm);
  const [accountFilterStatus, setAccountFilterStatus] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [accountPage, setAccountPage] = useState(1);
  const [accountPageSize, setAccountPageSize] = useState(18);

  // Current Device ID (memoized)
  const myCurrentDeviceId = useMemo(() => getDeviceId(), []);

  const showToast = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  // --- MAP RULES FOR FAST O(1) LOOKUP ---
  const deviceRulesMap = useMemo(() => {
    const map = new Map<string, DeviceAccessRule>();
    for (let i = 0; i < deviceRules.length; i++) {
      const r = deviceRules[i];
      const key = `${r.user_email.toLowerCase().trim()}_${(r.device_id || '').trim()}`;
      map.set(key, r);
    }
    return map;
  }, [deviceRules]);

  // --- FETCH USER ACTIVITY FROM SUPABASE ---
  const fetchUserActivity = async () => {
    setIsLoadingUserActivity(true);
    try {
      const { data, error } = await supabase
        .from('user_activity')
        .select('*')
        .order('last_active', { ascending: false });
      if (error) throw error;
      setUserActivityData(data || []);
    } catch (err: any) {
      console.error('Error fetching user activity:', err);
    } finally {
      setIsLoadingUserActivity(false);
    }
  };

  // --- SUBSCRIBER WITH THROTTLE FOR FIRESTORE HEARTBEATS & SECURITY RULES ---
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDeviceSessions(true);

    let lastUpdateTime = 0;
    let pendingSessions: UserDeviceSession[] | null = null;
    let throttleTimer: any = null;

    const applyUpdate = (sessions: UserDeviceSession[]) => {
      if (!isMounted) return;
      setDeviceSessions(sessions);
      setIsLoadingDeviceSessions(false);
    };

    // 1. Subscribe Device Sessions
    const unsubDevices = subscribeDeviceSessions(
      (sessions) => {
        const now = Date.now();
        if (now - lastUpdateTime > 1200) {
          lastUpdateTime = now;
          applyUpdate(sessions);
        } else {
          pendingSessions = sessions;
          if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
              throttleTimer = null;
              if (pendingSessions && isMounted) {
                lastUpdateTime = Date.now();
                applyUpdate(pendingSessions);
                pendingSessions = null;
              }
            }, 1200);
          }
        }
      },
      (err) => {
        console.error('Device sessions subscription error:', err);
        if (isMounted) setIsLoadingDeviceSessions(false);
      }
    );

    // 2. Subscribe Device Access Rules (Whitelist & Blacklist)
    const unsubRules = subscribeAllDeviceRules(
      (rules) => {
        if (isMounted) setDeviceRules(rules);
      },
      (err) => console.warn('Error subscribing device access rules:', err)
    );

    // 3. Subscribe User Security Settings (Whitelist Mode)
    const unsubSettings = subscribeAllUserSecuritySettings(
      (settings) => {
        if (isMounted) setUserSecuritySettings(settings);
      },
      (err) => console.warn('Error subscribing user security settings:', err)
    );

    // 4. Initial fetch user activity & realtime subscription
    fetchUserActivity();

    let debounceTimer: any = null;
    const sub = supabase
      .channel('user_activity_realtime_um')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_activity' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (isMounted) fetchUserActivity();
        }, 1000);
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (throttleTimer) clearTimeout(throttleTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubDevices();
      unsubRules();
      unsubSettings();
      supabase.removeChannel(sub);
    };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setDevicePage(1);
  }, [deferredDeviceSearch, deviceFilterStatus, deviceFilterType, devicePageSize]);

  useEffect(() => {
    setAccountPage(1);
  }, [deferredAccountSearch, accountFilterStatus, accountPageSize]);

  // --- ACTIONS ---
  const handleKickDevice = async (session: UserDeviceSession) => {
    const confirmKick = confirm(
      `Logout paksa perangkat ${session.device_id} (${session.device_label}) milik ${session.user_email}?`
    );
    if (!confirmKick) return;

    try {
      await forceLogoutDeviceSession(session.id);
      showToast(`Perangkat ${session.device_id} berhasil di-logout paksa!`);
    } catch (err: any) {
      alert('Gagal logout perangkat: ' + err.message);
    }
  };

  const handleKickAllUserDevices = async (userEmail: string, count: number) => {
    const confirmKick = confirm(
      `Logout paksa SEMUA (${count}) perangkat yang terhubung dengan akun ${userEmail}?`
    );
    if (!confirmKick) return;

    try {
      await forceLogoutAllUserDevices(userEmail);
      showToast(`Semua perangkat untuk ${userEmail} berhasil di-logout!`);
    } catch (err: any) {
      alert('Gagal logout semua perangkat: ' + err.message);
    }
  };

  const handleDeleteDeviceRecord = async (sessionDocId: string, deviceId: string) => {
    const confirmDel = confirm(`Hapus catatan riwayat perangkat ${deviceId} dari database?`);
    if (!confirmDel) return;

    try {
      await deleteDeviceSession(sessionDocId);
      showToast(`Catatan perangkat ${deviceId} berhasil dihapus.`);
    } catch (err: any) {
      alert('Gagal menghapus catatan perangkat: ' + err.message);
    }
  };

  // --- SECURITY AUTHORIZATION ACTIONS ---
  const handleAllowDevice = async (userEmail: string, deviceId: string, deviceLabel?: string) => {
    try {
      await allowDevice(userEmail, deviceId, deviceLabel, 'Diizinkan via Admin Panel');
      showToast(`Perangkat ${deviceId} DIIZINKAN untuk ${userEmail}!`);
    } catch (err: any) {
      alert('Gagal mengizinkan perangkat: ' + err.message);
    }
  };

  const handleBlockDevice = async (userEmail: string, deviceId: string, deviceLabel?: string) => {
    if (deviceId === myCurrentDeviceId) {
      alert('Peringatan Keamanan: Anda tidak dapat memblokir perangkat yang sedang Anda gunakan saat ini!');
      return;
    }

    const confirmBlock = confirm(
      `BLOKIR PERANGKAT INI (${deviceId})?\n\nPerangkat ini akan langsung di-kick dan TIDAK AKAN BISA LOGIN LAGI ke akun ${userEmail} meskipun mengetahui password!`
    );
    if (!confirmBlock) return;

    try {
      await blockDevice(userEmail, deviceId, deviceLabel, 'Diblokir oleh Admin');
      showToast(`Perangkat ${deviceId} BERHASIL DIBLOKIR permanen dari ${userEmail}!`);
    } catch (err: any) {
      alert('Gagal memblokir perangkat: ' + err.message);
    }
  };

  const handleDeleteRule = async (userEmail: string, deviceId: string) => {
    if (!confirm(`Hapus aturan status akses untuk perangkat ${deviceId}?`)) return;

    try {
      await deleteDeviceRule(userEmail, deviceId);
      showToast(`Aturan perangkat ${deviceId} dihapus (kembali ke normal).`);
    } catch (err: any) {
      alert('Gagal menghapus aturan: ' + err.message);
    }
  };

  const handleToggleWhitelistMode = async (userEmail: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus
      ? `AKTIFKAN MODE WHITELIST KETAT untuk akun ${userEmail}?\n\nSetelah aktif, HANYA perangkat yang telah disetujui (DIIZINKAN) yang boleh login. Perangkat lain otomatis DITOLAK!`
      : `NONAKTIFKAN MODE WHITELIST untuk akun ${userEmail}?\n\nSemua perangkat akan boleh login kembali, kecuali perangkat yang diblokir spesifik.`;

    if (!confirm(confirmMsg)) return;

    try {
      await setUserWhitelistMode(userEmail, newStatus);
      showToast(
        newStatus
          ? `🛡️ Mode Whitelist KETAT diaktifkan untuk ${userEmail}!`
          : `Mode Whitelist dinonaktifkan untuk ${userEmail}.`
      );
    } catch (err: any) {
      alert('Gagal mengubah mode whitelist: ' + err.message);
    }
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserEmail.trim() || !manualDeviceId.trim()) {
      alert('Username / Email dan ID Perangkat wajib diisi!');
      return;
    }

    setIsSubmittingRule(true);
    try {
      if (manualAction === 'ALLOWED') {
        await allowDevice(
          manualUserEmail.trim(),
          manualDeviceId.trim(),
          manualDeviceLabel.trim() || undefined,
          manualNote.trim() || 'Didaftarkan manual oleh admin'
        );
        showToast(`ID Perangkat ${manualDeviceId.trim()} berhasil DIIZINKAN untuk ${manualUserEmail.trim()}!`);
      } else {
        if (manualDeviceId.trim() === myCurrentDeviceId) {
          alert('Peringatan: Anda tidak dapat memblokir ID perangkat yang sedang Anda pakai saat ini!');
          setIsSubmittingRule(false);
          return;
        }
        await blockDevice(
          manualUserEmail.trim(),
          manualDeviceId.trim(),
          manualDeviceLabel.trim() || undefined,
          manualNote.trim() || 'Diblokir manual oleh admin'
        );
        showToast(`ID Perangkat ${manualDeviceId.trim()} berhasil DIBLOKIR untuk ${manualUserEmail.trim()}!`);
      }

      setIsAddDeviceModalOpen(false);
      setManualDeviceId('');
      setManualDeviceLabel('');
      setManualNote('');
    } catch (err: any) {
      alert('Gagal menyimpan aturan: ' + err.message);
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleForceLogoutUser = async (email: string) => {
    if (!confirm(`Force logout user ${email}?`)) return;
    try {
      const { error } = await supabase
        .from('user_activity')
        .update({ force_logout: true, login_status: 'LOGGED_OUT' })
        .eq('user_email', email);
      if (error) throw error;
      showToast(`User ${email} has been forced to logout.`);
      fetchUserActivity();
    } catch (err: any) {
      alert('Failed to force logout: ' + err.message);
    }
  };

  const handleBulkForceLogout = async () => {
    const targetEmails =
      selectedUserMonitoring.length > 0
        ? selectedUserMonitoring
        : userActivityData.filter((u) => u.login_status === 'LOGGED_IN').map((u) => u.user_email);

    if (targetEmails.length === 0) {
      alert('Tidak ada user aktif atau terpilih.');
      return;
    }

    const isBulkSelected = selectedUserMonitoring.length > 0;
    const confirmMsg = isBulkSelected
      ? `Logout paksa ${targetEmails.length} user yang Anda pilih?`
      : `Logout paksa SEMUA ${targetEmails.length} user yang sedang online?`;

    if (!confirm(confirmMsg)) return;

    setIsLoadingUserActivity(true);
    try {
      const { error } = await supabase
        .from('user_activity')
        .update({ force_logout: true, login_status: 'LOGGED_OUT' })
        .in('user_email', targetEmails);

      if (error) throw error;
      showToast(`${targetEmails.length} user berhasil di-logout massal.`);
      setSelectedUserMonitoring([]);
      fetchUserActivity();
    } catch (err: any) {
      console.error('Error bulk logout:', err);
      alert('Gagal logout massal: ' + err.message);
    } finally {
      setIsLoadingUserActivity(false);
    }
  };

  const toggleMonitoringSelection = (email: string) => {
    setSelectedUserMonitoring((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const toggleAllMonitoringSelection = () => {
    if (selectedUserMonitoring.length === userActivityData.length) {
      setSelectedUserMonitoring([]);
    } else {
      setSelectedUserMonitoring(userActivityData.map((u) => u.user_email));
    }
  };

  // --- HIGH PERFORMANCE MEMOIZED CALCULATIONS (O(N) single-pass) ---
  const {
    totalDevices,
    onlineDevices,
    pcDevices,
    mobileDevices,
    uniqueUserList,
    userStatsMap,
    allowedDevicesCount,
    blockedDevicesCount
  } = useMemo(() => {
    let online = 0;
    let pc = 0;
    let mobile = 0;
    let allowedCount = 0;
    let blockedCount = 0;
    const userMap = new Map<string, { total: number; online: number }>();
    const now = Date.now();

    for (let i = 0; i < deviceSessions.length; i++) {
      const s = deviceSessions[i];
      const isOnline = (now - (s.last_active || 0)) < 60000 && s.login_status === 'LOGGED_IN';
      if (isOnline) online++;
      if (s.device_type === 'Desktop') pc++;
      else if (s.device_type === 'Mobile' || s.device_type === 'Tablet') mobile++;

      const email = (s.user_email || 'unknown').trim();
      let stat = userMap.get(email);
      if (!stat) {
        stat = { total: 0, online: 0 };
        userMap.set(email, stat);
      }
      stat.total++;
      if (isOnline) stat.online++;

      // Check rule
      const ruleKey = `${email.toLowerCase()}_${(s.device_id || '').trim()}`;
      const rule = deviceRulesMap.get(ruleKey);
      if (rule?.status === 'ALLOWED') allowedCount++;
      else if (rule?.status === 'BLOCKED') blockedCount++;
    }

    // Sort unique users: Online users first, then by total device count desc
    const sortedUsers = Array.from(userMap.keys()).sort((a, b) => {
      const statA = userMap.get(a)!;
      const statB = userMap.get(b)!;
      if (statB.online !== statA.online) return statB.online - statA.online;
      return statB.total - statA.total;
    });

    return {
      totalDevices: deviceSessions.length,
      onlineDevices: online,
      pcDevices: pc,
      mobileDevices: mobile,
      uniqueUserList: sortedUsers,
      userStatsMap: userMap,
      allowedDevicesCount: allowedCount,
      blockedDevicesCount: blockedCount
    };
  }, [deviceSessions, deviceRulesMap]);

  // Memoized Quick Filter Pills (Top 14 or All if expanded)
  const visibleQuickFilterUsers = useMemo(() => {
    if (isFilterPillsExpanded || uniqueUserList.length <= 14) {
      return uniqueUserList;
    }
    const topPills = uniqueUserList.slice(0, 14);
    const currentSelected = deferredDeviceSearch.trim().toLowerCase();
    if (
      currentSelected &&
      !topPills.some((u) => u.toLowerCase() === currentSelected) &&
      uniqueUserList.some((u) => u.toLowerCase() === currentSelected)
    ) {
      const matched = uniqueUserList.find((u) => u.toLowerCase() === currentSelected);
      if (matched) topPills.push(matched);
    }
    return topPills;
  }, [uniqueUserList, isFilterPillsExpanded, deferredDeviceSearch]);

  // Memoized Device Sessions Filter & Grouping (Single-Pass with Security Rules Filter)
  const filteredUserGroups = useMemo(() => {
    const term = deferredDeviceSearch.trim().toLowerCase();
    const now = Date.now();

    const groups: Record<
      string,
      {
        user_email: string;
        employee_name: string;
        role: string;
        devices: UserDeviceSession[];
        onlineCount: number;
      }
    > = {};

    for (let i = 0; i < deviceSessions.length; i++) {
      const s = deviceSessions[i];
      const emailKey = (s.user_email || 'unknown').trim().toLowerCase();
      const devId = (s.device_id || '').trim();
      const rule = deviceRulesMap.get(`${emailKey}_${devId}`);

      // Search match
      if (term) {
        const customItem = customDeviceNames[devId];
        const customNameLower = customItem?.custom_name?.toLowerCase() || '';
        const customNoteLower = customItem?.note?.toLowerCase() || '';

        const matches =
          (s.user_email && s.user_email.toLowerCase().includes(term)) ||
          (s.employee_name && s.employee_name.toLowerCase().includes(term)) ||
          (s.device_id && s.device_id.toLowerCase().includes(term)) ||
          (s.device_label && s.device_label.toLowerCase().includes(term)) ||
          (customNameLower && customNameLower.includes(term)) ||
          (customNoteLower && customNoteLower.includes(term)) ||
          (s.os && s.os.toLowerCase().includes(term)) ||
          (s.browser && s.browser.toLowerCase().includes(term)) ||
          (rule?.note && rule.note.toLowerCase().includes(term));
        if (!matches) continue;
      }

      // Status match (Online/Offline/Security Status)
      const isOnline = (now - (s.last_active || 0)) < 60000 && s.login_status === 'LOGGED_IN';
      if (deviceFilterStatus === 'ONLINE' && !isOnline) continue;
      if (deviceFilterStatus === 'OFFLINE' && isOnline) continue;
      if (deviceFilterStatus === 'ALLOWED' && rule?.status !== 'ALLOWED') continue;
      if (deviceFilterStatus === 'BLOCKED' && rule?.status !== 'BLOCKED') continue;

      // Type match
      if (deviceFilterType !== 'ALL' && s.device_type !== deviceFilterType) continue;

      if (!groups[emailKey]) {
        groups[emailKey] = {
          user_email: s.user_email || emailKey,
          employee_name: s.employee_name || emailKey,
          role: s.role || 'STAFF',
          devices: [],
          onlineCount: 0
        };
      }
      groups[emailKey].devices.push(s);
      if (isOnline) groups[emailKey].onlineCount += 1;
    }

    // Sort groups: Online devices first, then total count
    return Object.values(groups).sort((a, b) => {
      if (b.onlineCount !== a.onlineCount) return b.onlineCount - a.onlineCount;
      return b.devices.length - a.devices.length;
    });
  }, [deviceSessions, deferredDeviceSearch, deviceFilterStatus, deviceFilterType, deviceRulesMap]);

  // Paginated User Groups
  const paginatedUserGroups = useMemo(() => {
    if (devicePageSize >= 999) return filteredUserGroups;
    const start = (devicePage - 1) * devicePageSize;
    return filteredUserGroups.slice(start, start + devicePageSize);
  }, [filteredUserGroups, devicePage, devicePageSize]);

  const totalDevicePages = Math.max(1, Math.ceil(filteredUserGroups.length / devicePageSize));

  // Filtered Rules List for Rules Management Modal
  const filteredRulesList = useMemo(() => {
    if (!rulesSearchTerm.trim()) return deviceRules;
    const q = rulesSearchTerm.toLowerCase().trim();
    return deviceRules.filter(
      (r) =>
        r.user_email.toLowerCase().includes(q) ||
        r.device_id.toLowerCase().includes(q) ||
        (r.device_label && r.device_label.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q))
    );
  }, [deviceRules, rulesSearchTerm]);

  // --- ACCOUNTS TAB MEMOIZED STATS & PAGINATION ---
  const { totalAccounts, onlineAccounts, offlineAccounts } = useMemo(() => {
    const total = userActivityData.length;
    let online = 0;
    const now = Date.now();
    for (let i = 0; i < userActivityData.length; i++) {
      const u = userActivityData[i];
      const lastActiveDate = new Date(u.last_active);
      if (now - lastActiveDate.getTime() < 60000 && u.login_status === 'LOGGED_IN') {
        online++;
      }
    }
    return {
      totalAccounts: total,
      onlineAccounts: online,
      offlineAccounts: total - online
    };
  }, [userActivityData]);

  const filteredAccounts = useMemo(() => {
    const term = deferredAccountSearch.trim().toLowerCase();
    const now = Date.now();

    return userActivityData.filter((user) => {
      if (term) {
        const matches =
          (user.user_email && user.user_email.toLowerCase().includes(term)) ||
          (user.employee_name && user.employee_name.toLowerCase().includes(term)) ||
          (user.role && user.role.toLowerCase().includes(term));
        if (!matches) return false;
      }

      const lastActiveDate = new Date(user.last_active);
      const isOnline = now - lastActiveDate.getTime() < 60000 && user.login_status === 'LOGGED_IN';

      if (accountFilterStatus === 'ONLINE' && !isOnline) return false;
      if (accountFilterStatus === 'OFFLINE' && isOnline) return false;

      return true;
    });
  }, [userActivityData, deferredAccountSearch, accountFilterStatus]);

  const paginatedAccounts = useMemo(() => {
    if (accountPageSize >= 999) return filteredAccounts;
    const start = (accountPage - 1) * accountPageSize;
    return filteredAccounts.slice(start, start + accountPageSize);
  }, [filteredAccounts, accountPage, accountPageSize]);

  const totalAccountPages = Math.max(1, Math.ceil(filteredAccounts.length / accountPageSize));

  return (
    <div className="w-full h-full min-h-full flex flex-col bg-white dark:bg-gray-800 overflow-y-auto">
      {/* HEADER */}
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-blue-50/70 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
            <Smartphone size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Monitoring User & Sesi Perangkat
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center gap-1">
                <ShieldCheck size={12} />
                Device Security Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Pantau perangkat terhubung, atur izin whitelist perangkat resmi, dan blokir perangkat liar per akun user.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {monitoringTab === 'ACCOUNTS' ? (
            <>
              {selectedUserMonitoring.length > 0 && (
                <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800">
                  {selectedUserMonitoring.length} Terpilih
                </span>
              )}
              <button
                onClick={toggleAllMonitoringSelection}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 transition-colors text-xs sm:text-sm font-bold"
              >
                {selectedUserMonitoring.length === userActivityData.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
              <button
                onClick={handleBulkForceLogout}
                disabled={
                  isLoadingUserActivity ||
                  (selectedUserMonitoring.length === 0 &&
                    userActivityData.filter((u) => u.login_status === 'LOGGED_IN').length === 0)
                }
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 bg-red-600 text-white border border-red-700 rounded-xl hover:bg-red-700 transition-colors shadow-sm text-xs sm:text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={16} />{' '}
                {selectedUserMonitoring.length > 0 ? 'Logout Terpilih' : 'Logout Semua User'}
              </button>
              <button
                onClick={fetchUserActivity}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 bg-white dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm text-xs sm:text-sm font-bold"
              >
                {isLoadingUserActivity ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}{' '}
                Refresh
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setManualUserEmail(deviceSearchTerm || 'admin2');
                  setManualAction('ALLOWED');
                  setIsAddDeviceModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Plus size={16} />
                <span>+ Daftarkan ID Perangkat</span>
              </button>

              <button
                onClick={() => setIsManageRulesModalOpen(true)}
                className="px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title="Kelola seluruh aturan Whitelist & Blacklist"
              >
                <SlidersHorizontal size={15} />
                <span>Aturan Keamanan ({deviceRules.length})</span>
              </button>

              <span className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {onlineDevices} Online
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="px-4 sm:px-6 py-2.5 bg-gray-100/80 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonitoringTab('DEVICES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              monitoringTab === 'DEVICES'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Laptop size={16} />
            <span>Sesi Perangkat Terhubung</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                monitoringTab === 'DEVICES'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}
            >
              {totalDevices}
            </span>
          </button>
          <button
            onClick={() => setMonitoringTab('ACCOUNTS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              monitoringTab === 'ACCOUNTS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Users size={16} />
            <span>Akun User (Activity)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                monitoringTab === 'ACCOUNTS'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {totalAccounts}
            </span>
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/20">
        {monitoringTab === 'DEVICES' ? (
          <div className="space-y-5">
            {/* HERO: CURRENT DEVICE BANNER */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg border border-blue-700/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                  <Laptop size={24} className="text-blue-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                      Perangkat Anda Saat Ini
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Perangkat Ini
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-base sm:text-lg text-white bg-black/30 px-2.5 py-0.5 rounded-lg border border-white/10">
                      {myCurrentDeviceId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(myCurrentDeviceId);
                        showToast('ID Device berhasil disalin!');
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white transition-colors"
                      title="Salin ID Device"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs text-blue-200/90 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                <p className="font-medium">Device ID tersimpan secara persisten di browser ini.</p>
                <p className="text-[11px] text-blue-300/70 mt-0.5">
                  Proteksi Keamanan: Perangkat Anda otomatis terlindungi dari aksi pemblokiran diri sendiri.
                </p>
              </div>
            </div>

            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Total Sesi Perangkat
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                    {totalDevices}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Semua hardware terdata</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Smartphone size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Perangkat Online
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {onlineDevices}
                  </h4>
                  <p className="text-[11px] text-emerald-500/80 mt-0.5">Aktif dalam 60 dtk</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-indigo-200 dark:border-indigo-800/40 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Perangkat Diizinkan
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {allowedDevicesCount}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Whitelist resmi</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800/40 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldAlert size={14} className="text-red-500" />
                    Perangkat Diblokir
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
                    {blockedDevicesCount}
                  </h4>
                  <p className="text-[11px] text-red-500/80 mt-0.5">Blacklist permanen</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
              </div>
            </div>

            {/* FILTER & SEARCH CONTROLS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={deviceSearchTerm}
                  onChange={(e) => setDeviceSearchTerm(e.target.value)}
                  placeholder="Cari user (cth: admin2), email, ID Device, label..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
                {deviceSearchTerm && (
                  <button
                    onClick={() => setDeviceSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Status (Online + Security) */}
                <select
                  value={deviceFilterStatus}
                  onChange={(e) => setDeviceFilterStatus(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ONLINE">🟢 Hanya Online</option>
                  <option value="OFFLINE">⚪ Offline / Logout</option>
                  <option value="ALLOWED">🛡️ Hanya Diizinkan (Whitelist)</option>
                  <option value="BLOCKED">⛔ Hanya Diblokir (Blacklist)</option>
                </select>

                {/* Filter Device Type */}
                <select
                  value={deviceFilterType}
                  onChange={(e) => setDeviceFilterType(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Perangkat</option>
                  <option value="Desktop">💻 PC / Laptop</option>
                  <option value="Mobile">📱 HP / Smartphone</option>
                  <option value="Tablet">📟 Tablet</option>
                </select>

                {(deviceSearchTerm || deviceFilterStatus !== 'ALL' || deviceFilterType !== 'ALL') && (
                  <button
                    onClick={() => {
                      setDeviceSearchTerm('');
                      setDeviceFilterStatus('ALL');
                      setDeviceFilterType('ALL');
                    }}
                    className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {/* OPTIMIZED QUICK USER FILTER SHORTCUTS */}
            {uniqueUserList.length > 1 && (
              <div className="bg-white/80 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Filter size={13} className="text-blue-500" />
                    <span>Filter Cepat User ({uniqueUserList.length} Akun)</span>
                  </div>
                  {uniqueUserList.length > 14 && (
                    <button
                      onClick={() => setIsFilterPillsExpanded((prev) => !prev)}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {isFilterPillsExpanded ? (
                        <>
                          <ChevronUp size={14} /> Sembunyikan
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> Lihat Semua ({uniqueUserList.length})
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {deviceSearchTerm && (
                    <button
                      onClick={() => setDeviceSearchTerm('')}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 transition-all flex items-center gap-1"
                    >
                      <X size={12} /> Semua User
                    </button>
                  )}

                  {visibleQuickFilterUsers.map((email) => {
                    const isSelected = deferredDeviceSearch.toLowerCase() === email.toLowerCase();
                    const stats = userStatsMap.get(email) || { total: 0, online: 0 };
                    const hasOnline = stats.online > 0;
                    const isWhitelistOn = !!userSecuritySettings[email.toLowerCase()]?.whitelist_enabled;

                    return (
                      <button
                        key={email}
                        onClick={() => setDeviceSearchTerm(isSelected ? '' : email)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                            : 'bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
                        }`}
                      >
                        <span className="truncate max-w-[160px] sm:max-w-none">{email}</span>
                        {isWhitelistOn && (
                          <span
                            className="text-[9px] px-1 py-0.1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-sm font-black"
                            title="Whitelist Ketat Aktif"
                          >
                            🛡️ WL
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                            hasOnline
                              ? 'bg-emerald-500 text-white'
                              : isSelected
                              ? 'bg-blue-800 text-blue-100'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {stats.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RESULTS COUNT & PAGINATION BAR TOP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 px-1">
              <div>
                Menampilkan{' '}
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {filteredUserGroups.length === 0
                    ? 0
                    : `${(devicePage - 1) * devicePageSize + 1} - ${Math.min(
                        devicePage * devicePageSize,
                        filteredUserGroups.length
                      )}`}
                </span>{' '}
                dari{' '}
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {filteredUserGroups.length}
                </span>{' '}
                grup user (
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {filteredUserGroups.reduce((acc, g) => acc + g.devices.length, 0)}
                </span>{' '}
                perangkat terfilter)
              </div>

              {filteredUserGroups.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>Per halaman:</span>
                    <select
                      value={devicePageSize}
                      onChange={(e) => setDevicePageSize(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold focus:outline-none"
                    >
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                      <option value={999}>Semua</option>
                    </select>
                  </div>

                  {totalDevicePages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDevicePage((p) => Math.max(1, p - 1))}
                        disabled={devicePage <= 1}
                        className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-bold px-2 text-gray-800 dark:text-gray-200">
                        {devicePage} / {totalDevicePages}
                      </span>
                      <button
                        onClick={() => setDevicePage((p) => Math.min(totalDevicePages, p + 1))}
                        disabled={devicePage >= totalDevicePages}
                        className="p-1 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Halaman Berikutnya"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* USER-GROUPED DEVICE SESSIONS LIST */}
            {filteredUserGroups.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400 shadow-sm">
                <Smartphone size={48} className="mx-auto mb-3 opacity-30 text-blue-500" />
                <h5 className="font-bold text-gray-700 dark:text-gray-200 text-base">
                  Tidak ada perangkat ditemukan
                </h5>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  {deviceSearchTerm || deviceFilterStatus !== 'ALL' || deviceFilterType !== 'ALL'
                    ? 'Tidak ada perangkat yang sesuai dengan kata kunci atau filter yang dipilih.'
                    : 'Belum ada sesi perangkat terdeteksi. Sesi perangkat akan otomatis muncul saat user atau admin login.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {paginatedUserGroups.map((group) => {
                  const hasOnline = group.onlineCount > 0;
                  const cleanEmailKey = group.user_email.toLowerCase().trim();
                  const userSetting = userSecuritySettings[cleanEmailKey];
                  const isWhitelistOn = !!userSetting?.whitelist_enabled;

                  return (
                    <div
                      key={group.user_email}
                      className={`bg-white dark:bg-gray-800 rounded-3xl border ${
                        isWhitelistOn
                          ? 'border-emerald-300 dark:border-emerald-800/80 shadow-md ring-1 ring-emerald-500/20'
                          : 'border-gray-200 dark:border-gray-700 shadow-sm'
                      } overflow-hidden`}
                    >
                      {/* USER GROUP HEADER */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800 dark:to-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0 ${
                              hasOnline
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 ring-4 ring-emerald-500/20'
                                : 'bg-gray-400 dark:bg-gray-600'
                            }`}
                          >
                            {group.employee_name?.charAt(0).toUpperCase() ||
                              group.user_email?.charAt(0).toUpperCase() ||
                              'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white">
                                {group.employee_name || group.user_email}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                {group.role}
                              </span>
                              {group.user_email.startsWith('admin') && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                  ADMIN ACCOUNT
                                </span>
                              )}
                              {isWhitelistOn ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-xs">
                                  <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                                  Whitelist Ketat Aktif
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 flex items-center gap-1">
                                  <Unlock size={12} />
                                  Mode Bebas
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {group.user_email}
                              </span>
                              <span>•</span>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {group.devices.length} Perangkat Terhubung
                              </span>
                              <span>•</span>
                              <span
                                className={`font-bold ${
                                  hasOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                                }`}
                              >
                                {hasOnline ? `${group.onlineCount} Online Sekarang` : 'Semua Offline'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CONTROLS IN HEADER: WHITELIST TOGGLE + ADD MANUAL + KICK ALL */}
                        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                          {/* Whitelist Toggle */}
                          <button
                            onClick={() => handleToggleWhitelistMode(group.user_email, isWhitelistOn)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                              isWhitelistOn
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200'
                            }`}
                            title={
                              isWhitelistOn
                                ? 'Whitelist AKTIF: Hanya perangkat diizinkan yang boleh login'
                                : 'Whitelist OFF: Bebas login kecuali yang diblokir'
                            }
                          >
                            {isWhitelistOn ? (
                              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Shield size={14} />
                            )}
                            <span>Whitelist: {isWhitelistOn ? 'ON (Ketat)' : 'OFF'}</span>
                          </button>

                          {/* Add ID Manual */}
                          <button
                            onClick={() => {
                              setManualUserEmail(group.user_email);
                              setManualAction('ALLOWED');
                              setIsAddDeviceModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                            title={`Daftarkan ID Perangkat baru untuk ${group.user_email}`}
                          >
                            <Plus size={14} />
                            <span>+ ID Perangkat</span>
                          </button>

                          {/* Kick All */}
                          <button
                            onClick={() =>
                              handleKickAllUserDevices(group.user_email, group.devices.length)
                            }
                            disabled={!hasOnline}
                            className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white border border-red-200 dark:border-red-800 transition-all font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                            title={`Logout semua perangkat milik ${group.user_email}`}
                          >
                            <LogOut size={13} />
                            Logout Semua ({group.devices.length})
                          </button>
                        </div>
                      </div>

                      {/* DEVICE CARDS SUB-GRID */}
                      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-gray-50/50 dark:bg-gray-900/30">
                        {group.devices.map((device) => {
                          const isCurrentDev = device.device_id === myCurrentDeviceId;
                          const isOnline =
                            Date.now() - (device.last_active || 0) < 60000 &&
                            device.login_status === 'LOGGED_IN';
                          const isLoggedOut = device.login_status === 'LOGGED_OUT';
                          const secondsAgo = Math.max(
                            0,
                            Math.round((Date.now() - (device.last_active || 0)) / 1000)
                          );

                          // Lookup security rule
                          const ruleKey = `${group.user_email.toLowerCase().trim()}_${(
                            device.device_id || ''
                          ).trim()}`;
                          const rule = deviceRulesMap.get(ruleKey);
                          const isAllowed = rule?.status === 'ALLOWED';
                          const isBlocked = rule?.status === 'BLOCKED';

                          return (
                            <div
                              key={device.id}
                              className={`bg-white dark:bg-gray-800 rounded-2xl border ${
                                isBlocked
                                  ? 'border-red-500/80 ring-2 ring-red-500/20 shadow-md bg-red-50/10'
                                  : isAllowed
                                  ? 'border-emerald-500/70 ring-1 ring-emerald-500/20 shadow-sm'
                                  : isCurrentDev
                                  ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                                  : 'border-gray-200 dark:border-gray-700'
                              } shadow-sm p-4 flex flex-col justify-between transition-all hover:shadow-md relative overflow-hidden`}
                            >
                              {isCurrentDev && (
                                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl shadow-sm">
                                  Perangkat Ini
                                </div>
                              )}

                              {/* Top Row: Icon + ID + Status */}
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        device.device_type === 'Mobile'
                                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                          : device.device_type === 'Tablet'
                                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                      }`}
                                    >
                                      {device.device_type === 'Mobile' ? (
                                        <Smartphone size={20} />
                                      ) : device.device_type === 'Tablet' ? (
                                        <Tablet size={20} />
                                      ) : (
                                        <Laptop size={20} />
                                      )}
                                    </div>
                                    <div>
                                      {customDeviceNames[(device.device_id || '').trim()]?.custom_name ? (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-black text-xs sm:text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                            {customDeviceNames[(device.device_id || '').trim()].custom_name}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingCustomNameDevice({
                                                deviceId: device.device_id,
                                                currentName: customDeviceNames[(device.device_id || '').trim()].custom_name,
                                                currentNote: customDeviceNames[(device.device_id || '').trim()].note
                                              })
                                            }
                                            className="p-1 rounded-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                            title="Ubah Nama Perangkat (Supabase)"
                                          >
                                            <Pencil size={11} />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                            ID Perangkat
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingCustomNameDevice({
                                                deviceId: device.device_id,
                                                currentName: '',
                                                currentNote: ''
                                              })
                                            }
                                            className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                            title="Beri nama custom perangkat ini (simpan ke Supabase)"
                                          >
                                            <Pencil size={10} /> + Nama
                                          </button>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="font-mono font-bold text-xs text-gray-600 dark:text-gray-300">
                                          {device.device_id}
                                        </span>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard?.writeText(device.device_id);
                                            showToast(`ID ${device.device_id} disalin!`);
                                          }}
                                          className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
                                          title="Salin ID"
                                        >
                                          <Copy size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right flex flex-col items-end gap-1">
                                    {/* Security Status Badge */}
                                    {isBlocked ? (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-300 dark:border-red-800 flex items-center gap-1">
                                        <ShieldAlert size={11} /> Diblokir
                                      </span>
                                    ) : isAllowed ? (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                                        <ShieldCheck size={11} /> Diizinkan
                                      </span>
                                    ) : isWhitelistOn ? (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                                        <AlertTriangle size={11} /> Belum Izin
                                      </span>
                                    ) : null}

                                    {/* Online/Offline Badge */}
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                                        isOnline
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                          : isLoggedOut
                                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                                        }`}
                                      ></span>
                                      {isOnline ? 'Online' : isLoggedOut ? 'Logged Out' : 'Offline'}
                                    </span>
                                  </div>
                                </div>

                                {/* Info Details */}
                                <div className="space-y-2 py-2 border-t border-b border-gray-100 dark:border-gray-700/60 my-2 text-xs">
                                  <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                                      Hardware & Browser
                                    </p>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                                      {device.device_label || `${device.os} • ${device.browser}`}
                                    </p>
                                    {rule?.note && (
                                      <p className="text-[11px] text-blue-600 dark:text-blue-400 italic mt-0.5">
                                        Catatan: {rule.note}
                                      </p>
                                    )}
                                    {customDeviceNames[(device.device_id || '').trim()]?.note && (
                                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                                        📍 Lokasi/Label: {customDeviceNames[(device.device_id || '').trim()].note}
                                      </p>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                      <span className="text-gray-400 block text-[10px] uppercase font-bold">
                                        Layar
                                      </span>
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {device.screen_res || '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400 block text-[10px] uppercase font-bold">
                                        Terakhir Aktif
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          isOnline
                                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                            : 'text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        {isOnline
                                          ? `${secondsAgo} dtk lalu`
                                          : device.last_active
                                          ? new Date(device.last_active).toLocaleTimeString('id-ID')
                                          : '-'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-[10px] text-gray-400 flex justify-between items-center pt-1">
                                    <span>Waktu Login:</span>
                                    <span className="text-gray-600 dark:text-gray-400 font-mono">
                                      {device.login_time
                                        ? new Date(device.login_time).toLocaleString('id-ID')
                                        : '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="space-y-2 pt-2">
                                {/* Security Authorization Action Buttons */}
                                <div className="grid grid-cols-2 gap-2">
                                  {isAllowed ? (
                                    <button
                                      onClick={() => handleDeleteRule(group.user_email, device.device_id)}
                                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                      title="Batalkan status izin (kembalikan ke normal)"
                                    >
                                      <Shield size={12} />
                                      <span>Batal Izin</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleAllowDevice(
                                          group.user_email,
                                          device.device_id,
                                          device.device_label
                                        )
                                      }
                                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95"
                                      title="Izinkan perangkat ini login resmi ke akun ini"
                                    >
                                      <ShieldCheck size={12} />
                                      <span>Izinkan (WL)</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCustomNameDevice({
                                        deviceId: device.device_id,
                                        currentName: customDeviceNames[(device.device_id || '').trim()]?.custom_name || '',
                                        currentNote: customDeviceNames[(device.device_id || '').trim()]?.note || ''
                                      })
                                    }
                                    className="py-1.5 px-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                                    title="Beri / Ubah Nama Custom Perangkat ini (Supabase)"
                                  >
                                    <Pencil size={12} />
                                    <span>Nama</span>
                                  </button>

                                  <button
                                    onClick={() => setFeatureModalAdmin(group.user_email)}
                                    className="py-1.5 px-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                                    title="Kelola hak akses fitur khusus (tombol salin, dsb) untuk akun ini"
                                  >
                                    <SlidersHorizontal size={12} />
                                    <span>Fitur</span>
                                  </button>

                                  {isBlocked ? (
                                    <button
                                      onClick={() => handleDeleteRule(group.user_email, device.device_id)}
                                      className="py-1.5 px-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                      title="Buka blokir perangkat ini"
                                    >
                                      <Shield size={12} />
                                      <span>Buka Blokir</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleBlockDevice(
                                          group.user_email,
                                          device.device_id,
                                          device.device_label
                                        )
                                      }
                                      disabled={isCurrentDev}
                                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                        isCurrentDev
                                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed opacity-50'
                                          : 'bg-red-50 hover:bg-red-600 hover:text-white dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 active:scale-95'
                                      }`}
                                      title={
                                        isCurrentDev
                                          ? 'Anda tidak dapat memblokir perangkat sendiri yang sedang aktif'
                                          : 'Blokir permanen perangkat ini'
                                      }
                                    >
                                      <ShieldAlert size={12} />
                                      <span>Blokir</span>
                                    </button>
                                  )}
                                </div>

                                {/* Kick & Trash Row */}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleKickDevice(device)}
                                    disabled={isLoggedOut}
                                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                      isLoggedOut
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-gray-100 hover:bg-red-600 hover:text-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 dark:hover:bg-red-600 dark:hover:text-white active:scale-95'
                                    }`}
                                    title="Putus sesi dan logout paksa perangkat ini"
                                  >
                                    <LogOut size={12} />
                                    Logout Sesi
                                  </button>
                                  {!isOnline && (
                                    <button
                                      onClick={() =>
                                        handleDeleteDeviceRecord(device.id, device.device_id)
                                      }
                                      className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                      title="Hapus riwayat sesi perangkat ini dari database"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BOTTOM PAGINATION CONTROLS */}
            {totalDevicePages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-6">
                <span className="text-xs text-gray-500">
                  Halaman <span className="font-bold text-gray-900 dark:text-white">{devicePage}</span> dari{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{totalDevicePages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDevicePage(1)}
                    disabled={devicePage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Pertama
                  </button>
                  <button
                    onClick={() => setDevicePage((p) => Math.max(1, p - 1))}
                    disabled={devicePage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => setDevicePage((p) => Math.min(totalDevicePages, p + 1))}
                    disabled={devicePage >= totalDevicePages}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => setDevicePage(totalDevicePages)}
                    disabled={devicePage >= totalDevicePages}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Terakhir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ACCOUNTS TAB (USER ACTIVITY VIEW) */
          <div className="space-y-5">
            {/* SUMMARY STATS CARDS FOR USER MONITORING */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Total User
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                    {totalAccounts.toLocaleString()}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Terdaftar di sistem</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-4 sm:p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    User Aktif (Online)
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {onlineAccounts.toLocaleString()}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Sedang beraktivitas</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    User Offline
                  </p>
                  <h4 className="text-2xl sm:text-3xl font-black text-gray-700 dark:text-gray-300">
                    {offlineAccounts.toLocaleString()}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">Tidak aktif / Logged out</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                  <UserX size={24} />
                </div>
              </div>
            </div>

            {/* ACCOUNT FILTER CONTROLS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={accountSearchTerm}
                  onChange={(e) => setAccountSearchTerm(e.target.value)}
                  placeholder="Cari user berdasarkan email, nama, atau role..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
                {accountSearchTerm && (
                  <button
                    onClick={() => setAccountSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={accountFilterStatus}
                  onChange={(e) => setAccountFilterStatus(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Status Akun</option>
                  <option value="ONLINE">🟢 Hanya User Online</option>
                  <option value="OFFLINE">⚪ User Offline / Logged Out</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span>Per hal:</span>
                  <select
                    value={accountPageSize}
                    onChange={(e) => setAccountPageSize(Number(e.target.value))}
                    className="px-2 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-bold focus:outline-none"
                  >
                    <option value={18}>18</option>
                    <option value={36}>36</option>
                    <option value={999}>Semua</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ACCOUNTS GRID */}
            {filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-8">
                <Info size={48} className="mb-4 opacity-50" />
                <p className="font-bold text-sm">Tidak ada user ditemukan.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Coba sesuaikan kata kunci pencarian atau status filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {paginatedAccounts.map((user) => {
                  const lastActiveDate = new Date(user.last_active);
                  const isActive =
                    Date.now() - lastActiveDate.getTime() < 60000 && user.login_status === 'LOGGED_IN';
                  const isLoggedOut = user.login_status === 'LOGGED_OUT';

                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleMonitoringSelection(user.user_email)}
                      className={`bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border ${
                        selectedUserMonitoring.includes(user.user_email)
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-700'
                      } shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md cursor-pointer`}
                    >
                      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              selectedUserMonitoring.includes(user.user_email)
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {selectedUserMonitoring.includes(user.user_email) && <Check size={14} />}
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0 ${
                                isActive
                                  ? 'bg-green-500 shadow-md shadow-green-500/30'
                                  : 'bg-gray-400 dark:bg-gray-700'
                              }`}
                            >
                              {user.employee_name?.charAt(0) || user.user_email?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <h4
                                className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate"
                                title={user.employee_name}
                              >
                                {user.employee_name || 'Anonymous'}
                              </h4>
                              <p className="text-xs text-gray-400 truncate" title={user.user_email}>
                                {user.user_email}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1">
                          <div
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                              }`}
                            ></div>
                            {isActive ? 'Aktif Sekarang' : 'Tidak Aktif'}
                          </div>
                          <div
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isLoggedOut
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                          >
                            {isLoggedOut ? 'Sudah Logout' : 'Masih Login'}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 flex-1">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Role Terakhir
                            </p>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">
                              {user.role || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Aktivitas Terakhir
                            </p>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                              {new Date(user.last_active).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400 font-medium">Login Timestamp</span>
                            <span className="text-gray-600 dark:text-gray-300 font-bold">
                              {user.last_login
                                ? new Date(user.last_login).toLocaleString('id-ID')
                                : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400 font-medium">Logout Timestamp</span>
                            <span className="text-gray-600 dark:text-gray-300 font-bold">
                              {user.last_logout
                                ? new Date(user.last_logout).toLocaleString('id-ID')
                                : user.login_status === 'LOGGED_IN'
                                ? 'Sedang Online'
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleForceLogoutUser(user.user_email);
                          }}
                          disabled={isLoggedOut}
                          className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            isLoggedOut
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white shadow-sm active:scale-95'
                          }`}
                        >
                          <LogOut size={14} />
                          Force Logout User
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ACCOUNTS BOTTOM PAGINATION */}
            {totalAccountPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-6">
                <span className="text-xs text-gray-500">
                  Halaman <span className="font-bold text-gray-900 dark:text-white">{accountPage}</span> dari{' '}
                  <span className="font-bold text-gray-900 dark:text-white">{totalAccountPages}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                    disabled={accountPage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => setAccountPage((p) => Math.min(totalAccountPages, p + 1))}
                    disabled={accountPage >= totalAccountPages}
                    className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: DAFTARKAN / BLOKIR ID PERANGKAT MANUAL                           */}
      {/* ========================================================================= */}
      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-gray-200 dark:border-gray-700 relative">
            <button
              onClick={() => setIsAddDeviceModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Daftarkan ID Perangkat
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tambahkan ID perangkat ke Whitelist atau Blacklist akun
                </p>
              </div>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Akun Target (Username / Email) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualUserEmail}
                  onChange={(e) => setManualUserEmail(e.target.value)}
                  placeholder="Misal: admin2, packing@kalindo.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  ID Perangkat (Device ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualDeviceId}
                  onChange={(e) => setManualDeviceId(e.target.value)}
                  placeholder="Contoh: DEV-MOB-AND-8X2A atau DEV-PC-WIN-GW5M"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Bisa didapatkan dari tombol "Salin ID" di layar login perangkat staf.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Label Perangkat / Pemegang (Opsional)
                </label>
                <input
                  type="text"
                  value={manualDeviceLabel}
                  onChange={(e) => setManualDeviceLabel(e.target.value)}
                  placeholder="Contoh: HP Packing Meja 2 (Budi), Laptop Kantor 1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Tindakan Status Akses <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualAction('ALLOWED')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      manualAction === 'ALLOWED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <ShieldCheck size={16} />
                    <span>Izinkan (Whitelist)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualAction('BLOCKED')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      manualAction === 'BLOCKED'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <ShieldAlert size={16} />
                    <span>Blokir (Blacklist)</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddDeviceModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs sm:text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className={`flex-1 py-2.5 px-4 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    manualAction === 'ALLOWED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {isSubmittingRule ? <Loader2 size={16} className="animate-spin" /> : <SaveIcon />}
                  <span>{manualAction === 'ALLOWED' ? 'Izinkan Perangkat' : 'Blokir Perangkat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KELOLA SEMUA ATURAN KEAMANAN (WHITELIST & BLACKLIST)             */}
      {/* ========================================================================= */}
      {isManageRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col relative">
            <button
              onClick={() => setIsManageRulesModalOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <SlidersHorizontal size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Kelola Aturan Akses Perangkat
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Daftar seluruh perangkat yang telah diizinkan (Whitelist) atau diblokir (Blacklist)
                </p>
              </div>
            </div>

            {/* Search filter inside modal */}
            <div className="mb-4 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={rulesSearchTerm}
                  onChange={(e) => setRulesSearchTerm(e.target.value)}
                  placeholder="Cari user, ID perangkat, atau catatan..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {rulesSearchTerm && (
                  <button
                    onClick={() => setRulesSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Rules list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
              {filteredRulesList.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                  <Shield size={36} className="mx-auto mb-2 opacity-30 text-indigo-400" />
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Belum ada aturan perangkat
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Klik tombol "Izinkan" atau "Blokir" pada kartu perangkat, atau gunakan tombol "+ Daftarkan ID".
                  </p>
                </div>
              ) : (
                filteredRulesList.map((rule) => {
                  const isAllowed = rule.status === 'ALLOWED';
                  return (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isAllowed
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                          }`}
                        >
                          {isAllowed ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                              {rule.user_email}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isAllowed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              }`}
                            >
                              {isAllowed ? 'DIIZINKAN' : 'DIBLOKIR'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                              {rule.device_id}
                            </span>
                            {rule.device_label && (
                              <span className="text-[11px] text-gray-500 truncate">
                                • {rule.device_label}
                              </span>
                            )}
                          </div>
                          {rule.note && (
                            <p className="text-[10px] text-gray-400 italic mt-0.5">{rule.note}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isAllowed ? (
                          <button
                            onClick={() =>
                              handleBlockDevice(rule.user_email, rule.device_id, rule.device_label)
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold transition-all"
                            title="Ubah menjadi blokir"
                          >
                            Blokir
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleAllowDevice(rule.user_email, rule.device_id, rule.device_label)
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white text-xs font-bold transition-all"
                            title="Ubah menjadi diizinkan"
                          >
                            Izinkan
                          </button>
                        )}
                        <button
                          onClick={() => setFeatureModalAdmin(rule.user_email)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Atur Hak Akses Fitur Khusus untuk Akun Ini"
                        >
                          <SlidersHorizontal size={12} />
                          <span>Fitur</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.user_email, rule.device_id)}
                          className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          title="Hapus aturan ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                Total {filteredRulesList.length} aturan terdaftar
              </span>
              <button
                type="button"
                onClick={() => setIsManageRulesModalOpen(false)}
                className="py-2 px-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl text-xs sm:text-sm hover:bg-gray-800 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FITUR KHUSUS BERBASIS PERANGKAT */}
      {featureModalAdmin && (
        <DeviceFeatureModal
          isOpen={!!featureModalAdmin}
          onClose={() => setFeatureModalAdmin(null)}
          adminUsername={featureModalAdmin}
          deviceRules={deviceRules}
          onToast={(msg) => onShowToast?.(msg)}
        />
      )}

      {/* MODAL UBAH NAMA CUSTOM PERANGKAT (SUPABASE) */}
      {editingCustomNameDevice && (
        <EditDeviceNameModal
          isOpen={!!editingCustomNameDevice}
          onClose={() => setEditingCustomNameDevice(null)}
          deviceId={editingCustomNameDevice.deviceId}
          initialName={editingCustomNameDevice.currentName}
          initialNote={editingCustomNameDevice.currentNote}
          onSaved={(devId, newName, newNote) => {
            setCustomDeviceNames(prev => ({
              ...prev,
              [devId]: {
                device_id: devId,
                custom_name: newName,
                note: newNote || '',
                updated_at: new Date().toISOString()
              }
            }));
            onShowToast?.(`Nama perangkat ${devId} disimpan sebagai "${newName}"`);
          }}
          onDeleted={(devId) => {
            setCustomDeviceNames(prev => {
              const copy = { ...prev };
              delete copy[devId];
              return copy;
            });
            onShowToast?.(`Nama custom perangkat ${devId} dihapus.`);
          }}
        />
      )}
    </div>
  );
};

const SaveIcon = () => <Check size={16} />;
