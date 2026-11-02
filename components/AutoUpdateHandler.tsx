import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles, Database, Zap } from 'lucide-react';
import { supabase, initRemoteSupabaseConfigListener, extractProjectRef } from '../services/supabaseClient';

const VERSION_CHECK_INTERVAL = 15000; // 15 seconds
const STORAGE_KEY_VERSION = 'app_version';
const COUNTDOWN_SECONDS = 3;
const SUPABASE_SWAP_COUNTDOWN_SECONDS = 5;

export const AutoUpdateHandler: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState('');
  
  // Version Update State
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [newVersion, setNewVersion] = useState('');

  // Remote Supabase Hot-Swap State
  const [showSupabaseSwapNotification, setShowSupabaseSwapNotification] = useState(false);
  const [supabaseSwapCountdown, setSupabaseSwapCountdown] = useState(SUPABASE_SWAP_COUNTDOWN_SECONDS);
  const [newSupabaseInfo, setNewSupabaseInfo] = useState<{ url: string; key: string; projectRef: string; updated_by: string } | null>(null);

  // Soft Reload for Version Updates (preserves user session)
  const executeSoftReload = () => {
    console.log("🔄 SYSTEM REFRESH - Soft Reload");
    setMessage('Memuat Ulang Sistem...');

    // Clear browser cache but preserve localStorage (user sessions)
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }

    // Hard reload to fetch new assets and reconnect clients
    window.location.reload();
  };

  // Hard Reset for Manual Force Refresh (clears everything)
  const executeHardReset = async () => {
    console.log("⚠️ FORCE REFRESH SIGNAL RECEIVED ⚠️");
    setIsResetting(true);
    setMessage('Membersihkan Cache Sistem...');

    try {
      // 1. Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // 2. Clear Cache Storage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      // 3. Clear Storage (preserve theme only)
      const savedTheme = localStorage.getItem('theme');
      localStorage.clear();
      sessionStorage.clear();
      if (savedTheme) localStorage.setItem('theme', savedTheme);

      setMessage('Memuat Ulang Sistem...');

      // 4. Force Reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (e) {
      console.error("Reset failed", e);
      window.location.reload();
    }
  };

  // Check for version updates
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Fetch version.json with cache-busting
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;
        const storedVersion = localStorage.getItem(STORAGE_KEY_VERSION);

        if (storedVersion && serverVersion && storedVersion !== serverVersion) {
          console.log(`🚀 NEW VERSION DETECTED: ${storedVersion} → ${serverVersion}`);
          setNewVersion(serverVersion);
          setShowUpdateNotification(true);
          setCountdown(COUNTDOWN_SECONDS);
        } else if (!storedVersion) {
          localStorage.setItem(STORAGE_KEY_VERSION, serverVersion);
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for version update auto-reload
  useEffect(() => {
    if (!showUpdateNotification) return;

    if (countdown === 0) {
      localStorage.setItem(STORAGE_KEY_VERSION, newVersion);
      executeSoftReload();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showUpdateNotification, countdown, newVersion]);

  // 1. Listen for Firestore Remote Supabase Hot-Swap
  useEffect(() => {
    // Start listening to Firestore system_config/supabase_active
    const unsubscribe = initRemoteSupabaseConfigListener();

    // Listen to local custom event dispatched by supabaseClient
    const handleSupabaseConfigChange = (e: any) => {
      const detail = e.detail;
      if (!detail?.url || !detail?.key) return;

      console.log("⚡ LIVE SUPABASE HOT-SWAP DETECTED:", detail);
      setNewSupabaseInfo({
        url: detail.url,
        key: detail.key,
        projectRef: detail.projectRef || extractProjectRef(detail.url),
        updated_by: detail.updated_by || 'Admin'
      });
      setShowSupabaseSwapNotification(true);
      setSupabaseSwapCountdown(SUPABASE_SWAP_COUNTDOWN_SECONDS);
    };

    window.addEventListener('supabase_config_changed', handleSupabaseConfigChange);

    return () => {
      unsubscribe();
      window.removeEventListener('supabase_config_changed', handleSupabaseConfigChange);
    };
  }, []);

  // Countdown timer for Supabase Hot-Swap Auto-Reload
  useEffect(() => {
    if (!showSupabaseSwapNotification || !newSupabaseInfo) return;

    if (supabaseSwapCountdown === 0) {
      // Apply new credentials locally and soft reload
      localStorage.setItem('active_supabase_url', newSupabaseInfo.url);
      localStorage.setItem('active_supabase_key', newSupabaseInfo.key);
      localStorage.setItem('supabase_url', newSupabaseInfo.url);
      localStorage.setItem('supabase_key', newSupabaseInfo.key);
      executeSoftReload();
      return;
    }

    const timer = setTimeout(() => {
      setSupabaseSwapCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showSupabaseSwapNotification, supabaseSwapCountdown, newSupabaseInfo]);

  // Listen for Manual Force Refresh from Admin Panel via Supabase
  useEffect(() => {
    const channel = supabase
      .channel('global_refresh_channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: 'id=eq.1',
        },
        (payload) => {
          console.log("Force Refresh Signal Detected:", payload);
          if (payload.new && payload.new.last_force_refresh_at) {
            executeHardReset();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 1. Manual Force Reset UI
  if (isResetting) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
        <div className="bg-white dark:bg-gray-800 w-full max-w-xs sm:max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 dark:bg-red-950/50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-500/20">
            <RefreshCw size={32} className="text-red-600 dark:text-red-400 animate-spin" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white mb-1.5 uppercase tracking-tight">Pembaruan Sistem</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-5 font-medium">
            {message || "Memperbarui sistem ke versi terbaru..."}
          </p>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div className="bg-red-600 h-full rounded-full animate-[progress_1.5s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Real-Time Remote Supabase Hot-Swap Notification (High Priority Modal)
  if (showSupabaseSwapNotification && newSupabaseInfo) {
    const swapProgressPercent = ((SUPABASE_SWAP_COUNTDOWN_SECONDS - supabaseSwapCountdown) / SUPABASE_SWAP_COUNTDOWN_SECONDS) * 100;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
        <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-950 text-white w-full max-w-md rounded-3xl shadow-2xl border border-emerald-500/30 p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Glowing Accents */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-400/30 shadow-lg shadow-emerald-500/20">
            <Zap size={36} className="animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Database size={12} /> Server Database Dialihkan
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
            Koneksi Database Diperbarui!
          </h2>

          <p className="text-xs sm:text-sm text-gray-300 mb-6 leading-relaxed">
            Admin telah mengalihkan database ke instance Supabase baru (<span className="font-mono font-bold text-emerald-300">{newSupabaseInfo.projectRef}</span>). Sistem akan memuat ulang dalam:
          </p>

          <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 mb-6 drop-shadow">
            {supabaseSwapCountdown}s
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                localStorage.setItem('active_supabase_url', newSupabaseInfo.url);
                localStorage.setItem('active_supabase_key', newSupabaseInfo.key);
                localStorage.setItem('supabase_url', newSupabaseInfo.url);
                localStorage.setItem('supabase_key', newSupabaseInfo.key);
                executeSoftReload();
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} className="animate-spin" />
              Beralih Sekarang
            </button>
          </div>

          {/* Progress Bar Line */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-1000 ease-linear"
              style={{ width: `${swapProgressPercent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. Regular Version Auto-Update Notification Banner
  if (showUpdateNotification) {
    const progressPercent = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

    return (
      <div className="fixed top-3 sm:top-4 left-3 right-3 sm:left-auto sm:right-4 z-[9999] sm:w-96 max-w-full animate-[slideDown_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white rounded-2xl shadow-2xl border border-blue-400/30 backdrop-blur-xl p-3.5 sm:p-4 overflow-hidden relative group">
          
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 ring-1 ring-white/20">
                <Sparkles size={16} className="text-blue-200 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs sm:text-sm tracking-tight text-white">Update Tersedia!</h4>
                  <span className="text-[10px] font-mono font-bold bg-blue-500/40 border border-blue-300/30 px-1.5 py-0.2 rounded text-blue-100">
                    v{newVersion}
                  </span>
                </div>
                <p className="text-[11px] text-blue-100/90 leading-tight mt-0.5 truncate">
                  Memuat ulang otomatis dalam <strong className="font-mono text-white">{countdown}s</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowUpdateNotification(false)}
              className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Tutup pemberitahuan"
            >
              <X size={16} />
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.setItem(STORAGE_KEY_VERSION, newVersion);
                executeSoftReload();
              }}
              className="flex-1 py-2 px-3 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-700 rounded-xl font-extrabold text-xs shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={13} className="animate-spin text-blue-600" />
              <span>Update Sekarang</span>
            </button>
            <button
              onClick={() => setShowUpdateNotification(false)}
              className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Nanti
            </button>
          </div>

          {/* Progress Bar Line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div 
              className="h-full bg-gradient-to-r from-blue-300 to-cyan-300 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

        </div>
        <style>{`
          @keyframes slideDown { 
            from { transform: translateY(-80px); opacity: 0; } 
            to { transform: translateY(0); opacity: 1; } 
          }
        `}</style>
      </div>
    );
  }

  return null;
};
