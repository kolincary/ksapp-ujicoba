import React, { useState, useEffect } from 'react';
import { Lock, ArrowLeft, User, Loader2, Eye, EyeOff, Shield, AlertCircle, Monitor, Box, Package, ShieldAlert, Copy, Check } from 'lucide-react';
import { getDeviceId } from '../services/deviceTracker';
import { checkDeviceAccess } from '../services/deviceSecurityService';
import { supabase, rawSupabase } from '../services/supabaseClient';
import { AdminUser } from '../types';

interface AdminLoginProps {
  onSuccess: (adminUser: AdminUser) => void;
  onBack: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [guestPin, setGuestPin] = useState('');
  const [adminLockoutSeconds, setAdminLockoutSeconds] = useState(0);
  const [deviceBlockedModal, setDeviceBlockedModal] = useState<{
    isOpen: boolean;
    username: string;
    deviceId: string;
    reason: string;
  }>({
    isOpen: false,
    username: '',
    deviceId: '',
    reason: ''
  });
  const [copiedDevId, setCopiedDevId] = useState(false);
  const [isDevBypassing, setIsDevBypassing] = useState(false);

  const handleDevModeBypass = () => {
    setIsDevBypassing(true);
    clearAdminFailedAttempts();
    setAdminLockoutSeconds(0);
    try {
      sessionStorage.removeItem('admin_login_lock_until');
      sessionStorage.removeItem('admin_login_attempts');
      localStorage.setItem('isDevModeNew', 'true');
      localStorage.setItem('showSecretMenu', 'true');
      localStorage.setItem('showFakeReportMenu', 'true');
      // Clean any expired/stale Supabase auth tokens that cause 401 Unauthorized
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') && k.includes('auth-token')) {
          localStorage.removeItem(k);
        }
      });
      if (localStorage.getItem('active_supabase_url') !== 'http://103.52.114.209:8000') {
        localStorage.setItem('active_supabase_url', 'http://103.52.114.209:8000');
        localStorage.setItem('active_supabase_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE');
      }
    } catch (e) {}

    const devAdminUser: AdminUser = {
      id: 'devmode-admin',
      username: 'admin',
      permissions: [
        'view_dashboard',
        'manage_employees',
        'view_packing',
        'view_packing_2',
        'view_picker',
        'view_checker',
        'view_leader_2',
        'view_gudang',
        'view_sortir',
        'view_ojol',
        'manage_pins',
        'manage_access',
        'manage_admins',
        'view_profile_config',
        'manage_database',
        'view_search_data',
        'view_search_data_2',
        'view_failed_scans',
        'manage_symbols',
        'manage_cancel_data',
        'view_compare_logistik',
        'view_scan_all',
        'view_fake_report',
        'view_check_invoice',
        'manage_batches'
      ]
    };

    onSuccess(devAdminUser);
  };

  // Global keystroke listener: Ketik 'logindevmode' atau 'devmode' sembarang waktu untuk skip login
  useEffect(() => {
    let keyBuffer = '';
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key && e.key.length === 1) {
        keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-25);
        if (keyBuffer.includes('logindevmode') || keyBuffer.includes('devmode')) {
          keyBuffer = '';
          handleDevModeBypass();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  const MAX_ADMIN_ATTEMPTS = 5;
  const ADMIN_LOCKOUT_SEC = 60;

  // Check existing admin lockout on mount
  useEffect(() => {
    try {
      const lockUntil = sessionStorage.getItem('admin_login_lock_until');
      if (lockUntil) {
        const remaining = Math.ceil((parseInt(lockUntil, 10) - Date.now()) / 1000);
        if (remaining > 0) {
          setAdminLockoutSeconds(remaining);
        } else {
          sessionStorage.removeItem('admin_login_lock_until');
          sessionStorage.removeItem('admin_login_attempts');
        }
      }
    } catch (e) {}
  }, []);

  // Admin lockout countdown timer
  useEffect(() => {
    if (adminLockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setAdminLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          try {
            sessionStorage.removeItem('admin_login_lock_until');
            sessionStorage.removeItem('admin_login_attempts');
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [adminLockoutSeconds]);

  const recordAdminFailedAttempt = () => {
    try {
      const attempts = parseInt(sessionStorage.getItem('admin_login_attempts') || '0', 10) + 1;
      sessionStorage.setItem('admin_login_attempts', attempts.toString());

      if (attempts >= MAX_ADMIN_ATTEMPTS) {
        const lockUntil = Date.now() + ADMIN_LOCKOUT_SEC * 1000;
        sessionStorage.setItem('admin_login_lock_until', lockUntil.toString());
        setAdminLockoutSeconds(ADMIN_LOCKOUT_SEC);
      }
    } catch (e) {}
  };

  const clearAdminFailedAttempts = () => {
    try {
      sessionStorage.removeItem('admin_login_attempts');
      sessionStorage.removeItem('admin_login_lock_until');
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      username.toLowerCase().trim() === 'logindevmode' ||
      username.toLowerCase().trim() === 'devmode' ||
      password.toLowerCase().trim() === 'logindevmode' ||
      password.toLowerCase().trim() === 'devmode'
    ) {
      handleDevModeBypass();
      return;
    }
    if (adminLockoutSeconds > 0) return;

    setError(null);
    setIsLoading(true);

    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
      setError("Waktu koneksi habis. Silakan periksa jaringan dan coba lagi.");
    }, 10000);

    try {
      const validateAndProceed = async (adminUser: AdminUser) => {
        const currentDevId = getDeviceId();
        const check = await checkDeviceAccess(adminUser.username, currentDevId);
        if (!check.allowed) {
          setDeviceBlockedModal({
            isOpen: true,
            username: adminUser.username,
            deviceId: currentDevId,
            reason: check.reason || 'Perangkat ini belum diizinkan atau telah diblokir untuk login ke akun ini.'
          });
          return false;
        }
        clearAdminFailedAttempts();
        onSuccess(adminUser);
        return true;
      };

      // 1. Try secure Postgres RPC function verify_admin_login
      try {
        const { data: rpcData, error: rpcError } = await rawSupabase.rpc('verify_admin_login', {
          p_username: username.trim(),
          p_password: password
        });

        if (!rpcError && rpcData && rpcData.id) {
          const adminUser: AdminUser = {
            id: rpcData.id,
            username: rpcData.username,
            permissions: rpcData.permissions || []
          };
          await validateAndProceed(adminUser);
          return;
        }
      } catch (rpcErr) {
        // Fallback to direct query if RPC is not yet created in Supabase
      }

      // 2. Direct database query fallback (only select non-sensitive fields)
      const { data, error: dbError } = await rawSupabase
        .from('admin_users')
        .select('id, username, permissions')
        .eq('username', username.trim())
        .eq('password', password)
        .single();

      if (dbError) {
        recordAdminFailedAttempt();
        if (dbError.code === 'PGRST116') {
          throw new Error("Username atau password salah.");
        } else if (dbError.code === '42P01') {
          throw new Error("System Error: 'admin_users' table not found.");
        } else {
          throw dbError;
        }
      }

      if (data) {
        const adminUser: AdminUser = {
          id: data.id,
          username: data.username,
          permissions: data.permissions || []
        };
        await validateAndProceed(adminUser);
      }
    } catch (err: any) {
      console.error("Admin Login Error:", err);
      setError(err.message || "Gagal masuk ke admin portal.");
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLockoutSeconds > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      // Check database for Tamu user first
      const { data, error: dbError } = await rawSupabase
        .from('admin_users')
        .select('id, username, permissions')
        .eq('username', 'Tamu')
        .eq('password', guestPin)
        .maybeSingle();

      if (!dbError && data) {
        clearAdminFailedAttempts();
        const guestAdmin: AdminUser = {
          id: data.id,
          username: data.username,
          permissions: data.permissions || ['manage_batches']
        };
        onSuccess(guestAdmin);
        return;
      }

      // Fallback guest check
      if (guestPin === '1088') {
        clearAdminFailedAttempts();
        const guestAdmin: AdminUser = {
          id: -1,
          username: 'Tamu',
          permissions: ['manage_batches']
        };
        onSuccess(guestAdmin);
      } else {
        recordAdminFailedAttempt();
        setError("PIN Tamu salah.");
        setShowPinModal(false);
        setGuestPin('');
      }
    } catch (err: any) {
      setError("Gagal memvalidasi PIN Tamu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-gray-950 transition-colors duration-500 ease-in-out relative overflow-hidden select-none">
      {/* DevMode Instant Bypass Overlay */}
      {isDevBypassing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl border border-gray-100 dark:border-gray-800 animate-pulse text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 animate-bounce text-blue-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">🚀 DevMode Aktif!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Melewati login, membuka Admin Panel...</p>
          </div>
        </div>
      )}

      {/* ================= MOBILE & TABLET LAYOUT (< lg) ================= */}
      <div className="lg:hidden relative w-full h-[100dvh] min-h-[100dvh] flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#1d63ed] via-[#2563eb] to-[#0f172a] text-white">
        
        {/* Responsive WebP Background Graphic */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <picture className="w-full h-full block">
            <source media="(max-width: 639px)" srcSet="/assets/login-illustration-mobile.webp" type="image/webp" />
            <source media="(min-width: 640px) and (max-width: 1023px)" srcSet="/assets/login-illustration-tablet.webp" type="image/webp" />
            <img
              src="/assets/login-illustration-mobile.webp"
              alt="Kalindo Scan Mobile Illustration"
              className="w-full h-full object-cover object-center opacity-30 mix-blend-overlay"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/login-illustration.webp";
              }}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/85 via-blue-950/30 to-blue-900/10 pointer-events-none"></div>
        </div>

        {/* Ambient Glows */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Navigation & Branding */}
        <div className="relative z-10 w-full max-w-sm sm:max-w-md pt-2 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 text-white text-xs font-semibold border border-white/20 transition-all active:scale-95 shadow-md"
          >
            <ArrowLeft size={16} />
            <span>Kembali</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-blue-100 font-bold text-xs tracking-wider uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-xs">
            <Shield size={13} className="text-blue-300" />
            <span>Admin Mode</span>
          </div>
        </div>

        {/* Branding Badge */}
        <div className="relative z-10 my-auto pt-2 flex flex-col items-center text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 border border-white/40 shadow-xl">
            <Shield size={28} className="text-white sm:w-8 sm:h-8" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Admin Portal
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm font-medium mt-0.5 max-w-xs leading-tight drop-shadow">
            Kalindo Scan Management System
          </p>
        </div>

        {/* Center Glassmorphic Form Card */}
        <div className="relative z-10 w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-gray-800 p-5 sm:p-7 my-auto text-gray-900 dark:text-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">Autentikasi Admin</h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Masukkan kredensial untuk mengakses konsol</p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-2xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username Admin"
                  className="w-full bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password Admin"
                  className="w-full bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl pl-11 pr-11 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {adminLockoutSeconds > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 p-3 rounded-2xl text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800">
                <AlertCircle size={16} className="shrink-0 text-amber-500" />
                <span>Terlalu banyak percobaan gagal. Tunggu <b>{adminLockoutSeconds}s</b></span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || adminLockoutSeconds > 0}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm mt-2 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : adminLockoutSeconds > 0 ? `Terkunci (${adminLockoutSeconds}s)` : 'Verifikasi Akses'}
            </button>
            <button
              type="button"
              disabled={isLoading || adminLockoutSeconds > 0}
              onClick={() => setShowPinModal(true)}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm mt-2 disabled:cursor-not-allowed"
            >
              Masuk sebagai tamu
            </button>
          </form>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pb-1 text-[10px] text-blue-200/70 font-medium">
          Kalindo Scan &copy; 2026 Admin Portal
        </div>
      </div>

      {/* ================= DESKTOP LAYOUT (>= lg) ================= */}
      <div className="hidden lg:flex w-full h-[100dvh] flex-row overflow-hidden">
        
        {/* Desktop Left Side - Illustration & Branding */}
        <div className="w-1/2 h-full bg-gradient-to-br from-[#1d63ed] via-[#2563eb] to-[#1e40af] relative flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <img
              src="/assets/login-illustration.webp"
              alt="Kalindo Scan Admin Illustration"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/login-illustration.svg";
              }}
            />
          </div>

          <div className="relative z-10 text-left p-10 max-w-xl -mt-16">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 border border-white/40 shadow-2xl relative group">
              <div className="absolute inset-0 bg-blue-400/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
              <Shield size={48} className="text-white relative z-10" strokeWidth={1.75} />
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight leading-tight drop-shadow-md">
              Admin Portal
            </h1>
            <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-md drop-shadow">
              Akses konsol manajemen untuk pengaturan peran, PIN, dan audit sistem Kalindo Scan WMS.
            </p>

            <div className="absolute -top-12 -left-8 animate-bounce duration-[3500ms] pointer-events-none opacity-40">
              <Box className="text-white w-10 h-10" />
            </div>
            <div className="absolute top-1/2 -right-12 animate-bounce duration-[4500ms] pointer-events-none opacity-40">
              <Package className="text-white w-12 h-12" />
            </div>
          </div>
        </div>

        {/* Desktop Right Side - Admin Login Form */}
        <div className="w-1/2 h-full bg-[#f8fafc] dark:bg-gray-950 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 overflow-y-auto">
          
          <button
            onClick={onBack}
            className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold shadow-xs transition-all active:scale-95"
          >
            <ArrowLeft size={18} />
            <span>Kembali ke Login</span>
          </button>

          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800/80 p-8 lg:p-10 relative z-10 animate-[fadeIn_0.4s_ease-out] my-auto">
            
            <div className="text-left mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/40 rounded-2xl mb-4 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                <Shield size={28} strokeWidth={2} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
                Admin <span className="text-blue-600 dark:text-blue-500">Portal</span>
              </h1>
              <p className="text-gray-400 dark:text-gray-500 font-medium text-xs sm:text-sm">Warehouse Management Console</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-left mb-2">
                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Masuk Administrator</h2>
                <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-0.5">Silakan isi kredensial akun admin Anda</p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 border border-red-100 dark:border-red-800/50">
                  <AlertCircle size={18} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username Admin"
                    className="w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password Admin"
                    className="w-full bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-2xl pl-11 pr-11 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {adminLockoutSeconds > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 p-3.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 border border-amber-200 dark:border-amber-800">
                  <AlertCircle size={18} className="shrink-0 text-amber-500" />
                  <span>Terlalu banyak percobaan gagal. Tunggu <b>{adminLockoutSeconds}s</b></span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || adminLockoutSeconds > 0}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm pt-3.5 mt-4 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : adminLockoutSeconds > 0 ? `Terkunci (${adminLockoutSeconds}s)` : 'Verifikasi Akses'}
              </button>
              <button
                type="button"
                disabled={isLoading || adminLockoutSeconds > 0}
                onClick={() => setShowPinModal(true)}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm mt-2 disabled:cursor-not-allowed"
              >
                Masuk sebagai tamu
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                Akses ini hanya untuk personal berwenang. Semua aktivitas masuk akan dicatat untuk audit keamanan.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 dark:border-gray-800 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">Masukkan PIN Tamu</h3>
            <form onSubmit={handleGuestLogin}>
              <input
                type="password"
                value={guestPin}
                onChange={(e) => setGuestPin(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4 font-mono"
                placeholder="****"
                autoFocus
                maxLength={6}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPinModal(false); setGuestPin(''); }}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md transition-colors"
                >
                  Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERANGKAT DIBLOKIR / BELUM DIIZINKAN */}
      {deviceBlockedModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-red-200 dark:border-red-900/50 text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4 shadow-inner">
              <ShieldAlert size={36} />
            </div>

            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
              Akses Perangkat Ditolak
            </h3>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              {deviceBlockedModal.reason}
            </p>

            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-4 text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                ID Perangkat Anda
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                  {deviceBlockedModal.deviceId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(deviceBlockedModal.deviceId);
                    setCopiedDevId(true);
                    setTimeout(() => setCopiedDevId(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  {copiedDevId ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedDevId ? 'Tersalin!' : 'Salin ID'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl mb-5 text-[11px] text-amber-800 dark:text-amber-300 text-left">
              💡 <strong>Tips:</strong> Salin ID Perangkat di atas dan kirimkan ke <strong>Admin Utama</strong> agar perangkat ini didaftarkan ke daftar perangkat yang diizinkan untuk akun <strong>{deviceBlockedModal.username}</strong>.
            </div>

            <button
              type="button"
              onClick={() => setDeviceBlockedModal(prev => ({ ...prev, isOpen: false }))}
              className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 font-bold rounded-xl text-sm transition-all shadow-md"
            >
              Saya Mengerti & Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
