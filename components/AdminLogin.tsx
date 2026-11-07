import React, { useState, useEffect } from 'react';
import {
  Lock,
  ArrowLeft,
  User,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  AlertCircle,
  Box,
  Package,
  Shuffle,
  ShieldAlert,
  Copy,
  Check,
  Sun,
  Moon,
  KeyRound,
  ScanLine
} from 'lucide-react';
import { getDeviceId } from '../services/deviceTracker';
import { checkDeviceAccess } from '../services/deviceSecurityService';
import { supabase } from '../services/supabaseClient';
import { AdminUser } from '../types';
import { getActiveLoginTheme, LoginThemeVariant } from '../services/themeSyncService';

interface AdminLoginProps {
  onSuccess: (adminUser: AdminUser) => void;
  onBack: () => void;
}

/* =========================================================================
   TEMA 2 ASSETS (VECTOR ILLUSTRATION & BRAND)
   ========================================================================= */

function IllustrationTema2({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 400"
      className={className}
      role="img"
      aria-label="Kotak paket terbuka dengan label barcode yang dipindai pemindai genggam"
    >
      <defs>
        <pattern id="admin_bc" width="9" height="1" patternUnits="userSpaceOnUse">
          <rect width="2" height="1" fill="#16191D" />
          <rect x="3" width="1" height="1" fill="#16191D" />
          <rect x="5" width="1" height="1" fill="#16191D" />
        </pattern>
      </defs>
      <path
        d="M10 110 C110 30 210 150 300 70 S450 50 510 14"
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
        strokeWidth="2"
        strokeDasharray="6 9"
      />
      <ellipse cx="260" cy="388" rx="160" ry="14" fill="#000" opacity=".28" />

      {/* Clipboard */}
      <g transform="translate(374 196) rotate(8)">
        <rect width="104" height="140" rx="9" fill="#EDE8DB" />
        <rect x="32" y="-8" width="40" height="18" rx="5" fill="#3A4A66" />
        {[40, 68, 96].map((y) => (
          <g key={y}>
            <path
              d={`M14 ${y} l5 5 9-10`}
              stroke="#2E7D5B"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <rect x="38" y={y - 4} width="52" height="5" rx="2.5" fill="#B9B2A0" />
          </g>
        ))}
      </g>

      {/* Kotak Paket Karton */}
      <polygon points="185,238 260,200 250,158 168,196" fill="#D8B488" />
      <polygon points="260,200 335,238 352,198 270,158" fill="#C9A173" />
      <polygon points="260,200 335,238 260,276 185,238" fill="#6F5233" />
      <polygon points="185,238 260,276 260,386 185,348" fill="#B58A5B" />
      <polygon points="260,276 335,238 335,348 260,386" fill="#9C7449" />
      <polygon points="185,238 260,276 238,302 162,264" fill="#C79B69" />
      <polygon points="260,276 335,238 358,264 282,302" fill="#B38956" />

      {/* Label Barcode dengan Animasi Sinar Scan */}
      <g transform="matrix(1 -0.507 0 1 260 276)">
        <rect x="9" y="46" width="57" height="48" rx="3" fill="#fff" />
        <rect x="14" y="54" width="47" height="22" fill="url(#admin_bc)" />
        <rect x="14" y="82" width="47" height="3" rx="1.5" fill="#B9B2A0" />
        <rect className="ks-sweep" x="6" y="52" width="63" height="3" rx="1.5" fill="#F2B705" />
      </g>

      {/* Pemindai Genggam (Barcode Scanner) */}
      <polygon points="350,116 268,322 328,336" fill="#F2B705" opacity=".16" />
      <g transform="translate(332 96) rotate(-24)">
        <rect width="84" height="34" rx="10" fill="#1F2A3D" />
        <rect x="8" y="8" width="16" height="18" rx="4" fill="#F2B705" />
        <rect x="44" y="26" width="26" height="70" rx="10" fill="#2A3A55" />
      </g>
    </svg>
  );
}

function BrandTema2() {
  return (
    <aside className="hidden overflow-hidden bg-[#0E1B2E] px-8 pt-10 pb-8 text-[#ECEEF0] lg:flex lg:flex-col lg:justify-between lg:sticky lg:top-0 lg:h-[100dvh] xl:px-14 xl:pt-14 xl:pb-12 select-none">
      <div className="max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight xl:text-5xl">Kalindo Scan</h1>
        <p className="mt-3 text-base leading-relaxed text-[#8FA0B8] xl:text-lg xl:mt-4">
          Scan, sortir, dan packing yang efisien untuk gudang modern.
        </p>
      </div>
      <IllustrationTema2 className="mx-auto block w-full max-w-[34rem] max-h-[44vh] shrink-0" />
    </aside>
  );
}

/* =========================================================================
   MAIN COMPONENT: ADMIN LOGIN
   ========================================================================= */

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onBack }) => {
  // Theme Detection: Tema 1 (Klasik Biru) vs Tema 2 (Dark Navy & Vector)
  const [activeTheme] = useState<LoginThemeVariant>(() => getActiveLoginTheme());

  const [dark, setDark] = useState<boolean>(() => {
    return (
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark'
    );
  });

  const handleToggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

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
      setAdminLockoutSeconds((prev) => {
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
    if (adminLockoutSeconds > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const validateAndProceed = async (adminUser: AdminUser) => {
        const currentDevId = getDeviceId();
        const check = await checkDeviceAccess(adminUser.username, currentDevId);
        if (!check.allowed) {
          setDeviceBlockedModal({
            isOpen: true,
            username: adminUser.username,
            deviceId: currentDevId,
            reason:
              check.reason ||
              'Perangkat ini belum diizinkan atau telah diblokir untuk login ke akun ini.'
          });
          return false;
        }
        clearAdminFailedAttempts();
        onSuccess(adminUser);
        return true;
      };

      // 1. Try secure Postgres RPC function verify_admin_login
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('verify_admin_login', {
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

      // 2. Direct database query fallback
      const { data, error: dbError } = await supabase
        .from('admin_users')
        .select('id, username, permissions')
        .eq('username', username.trim())
        .eq('password', password)
        .single();

      if (dbError) {
        recordAdminFailedAttempt();
        if (dbError.code === 'PGRST116') {
          throw new Error('Username atau password salah.');
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
      console.error('Admin Login Error:', err);
      setError(err.message || 'Gagal masuk ke admin portal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLockoutSeconds > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const { data, error: dbError } = await supabase
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
        setError('PIN Tamu salah.');
        setShowPinModal(false);
        setGuestPin('');
      }
    } catch (err: any) {
      setError('Gagal memvalidasi PIN Tamu.');
    } finally {
      setIsLoading(false);
    }
  };

  /* =========================================================================
     MODAL DIALOGS (SHARED)
     ========================================================================= */
  const renderModals = () => (
    <>
      {/* MODAL PIN TAMU */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 dark:border-gray-800 animate-[fadeIn_0.2s_ease-out]">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 text-center">
              Masukkan PIN Tamu
            </h3>
            <form onSubmit={handleGuestLogin}>
              <input
                type="password"
                value={guestPin}
                onChange={(e) => setGuestPin(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-center text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/50 mb-4 font-mono text-gray-900 dark:text-white"
                placeholder="****"
                autoFocus
                maxLength={6}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setGuestPin('');
                  }}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs shadow-md transition-colors cursor-pointer"
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
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4 shadow-inner">
              <ShieldAlert size={32} />
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Akses Perangkat Ditolak
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              {deviceBlockedModal.reason}
            </p>

            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-3.5 border border-gray-200 dark:border-gray-700 mb-4 text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                ID Perangkat Anda
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                  {deviceBlockedModal.deviceId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(deviceBlockedModal.deviceId);
                    setCopiedDevId(true);
                    setTimeout(() => setCopiedDevId(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  {copiedDevId ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedDevId ? 'Tersalin!' : 'Salin ID'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl mb-4 text-[11px] text-amber-800 dark:text-amber-300 text-left">
              💡 <strong>Tips:</strong> Salin ID Perangkat di atas dan kirimkan ke <strong>Admin Utama</strong> agar perangkat ini didaftarkan ke daftar perangkat yang diizinkan untuk akun <strong>{deviceBlockedModal.username}</strong>.
            </div>

            <button
              type="button"
              onClick={() => setDeviceBlockedModal((prev) => ({ ...prev, isOpen: false }))}
              className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              Saya Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );

  /* =========================================================================
     VIEW: TEMA 2 (DARK NAVY & MODERN MINIMALIST CARD - MATCHING SCREENSHOT)
     ========================================================================= */
  if (activeTheme === 'tema_2') {
    return (
      <div
        className="ks-root min-h-[100dvh] h-[100dvh] w-full lg:grid lg:grid-cols-2 select-none overflow-x-hidden overflow-y-auto lg:overflow-hidden"
        data-theme={dark ? 'dark' : 'light'}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');

          @media (min-width: 1024px) {
            :root, html {
              font-size: clamp(13px, min(2.2vh, 1.2vw), 18px);
            }
          }

          .ks-root {
            --page: #F3F4F2;
            --surface: #ffffff;
            --text: #16191D;
            --muted: #5B636B;
            --line: #D5D9DC;
            --hover: #F3F4F2;
            --ring: #B8860B;
            font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            background: var(--page);
            color: var(--text);
          }
          .ks-root[data-theme='dark'] {
            --page: #0F1114;
            --surface: #181B1F;
            --text: #ECEEF0;
            --muted: #9AA3AB;
            --line: #2B3036;
            --hover: #22262B;
            --ring: #F2B705;
          }
          .ks-surface { background: var(--surface); }
          .ks-muted { color: var(--muted); }
          .ks-border { border-color: var(--line); }
          .ks-field { background: var(--surface); border-color: var(--line); color: var(--text); }
          .ks-btn:hover { background: var(--hover); }
          .ks-focus:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

          @keyframes ks-sweep {
            to { transform: translateY(26px); }
          }
          .ks-sweep {
            animation: ks-sweep 2.2s ease-in-out infinite alternate;
          }

          @media (prefers-reduced-motion: reduce) {
            .ks-sweep { animation: none; }
          }
        `}</style>

        {/* Kolom Kiri: Brand & Ilustrasi (Desktop) */}
        <BrandTema2 />

        {/* Kolom Kanan: Card Login Admin */}
        <main className="relative flex min-h-[100dvh] lg:h-[100dvh] w-full flex-col items-center justify-between gap-4 overflow-y-auto bg-[#0E1B2E] px-4 py-4 sm:px-6 lg:px-8 lg:py-6 lg:bg-transparent [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Mobile Watermark Background */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 lg:hidden">
            <IllustrationTema2 className="absolute bottom-0 left-1/2 block w-[135%] max-w-none -translate-x-1/2 opacity-40 sm:w-[88%]" />
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#0E1B2E] to-transparent" />
          </div>

          {/* Mobile Header Branding */}
          <header className="relative flex flex-col items-center text-center text-white lg:hidden pt-2">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#F2B705] text-[#16191D] shadow-sm">
              <ScanLine size={26} strokeWidth={2.4} />
            </div>
            <div className="mt-2.5 text-2xl font-semibold tracking-tight">Admin Portal</div>
            <p className="mt-0.5 text-xs text-[#8FA0B8]">Warehouse Management Console</p>
          </header>

          {/* Card Form Admin Login */}
          <div className="relative w-full max-w-[27rem] xl:max-w-[28rem] my-auto py-2">
            <section className="ks-surface ks-border relative rounded-3xl border p-5 pt-6 sm:p-7 sm:pt-7 shadow-[0_24px_60px_-28px_rgba(14,27,46,0.4)] transition-colors duration-200">
              {/* Header Bar Inside Card: Tombol Kembali & Toggle Mode */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Kembali ke login utama"
                  className="ks-focus ks-border ks-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold text-inherit transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Kembali ke halaman login utama"
                >
                  <ArrowLeft size={13} />
                  <span>Kembali</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleTheme}
                  aria-label={dark ? 'Mode terang' : 'Mode gelap'}
                  className="ks-focus ks-border ks-btn grid h-8 w-8 place-items-center rounded-lg border text-inherit transition-colors cursor-pointer"
                >
                  {dark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              </div>

              {/* Desktop Brand Header di Dalam Card (Sama Persis dengan Screenshot) */}
              <div className="text-left">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F2B705] text-[#16191D] shadow-sm">
                  <ScanLine size={22} strokeWidth={2.4} />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">Admin Portal</div>
                <p className="ks-muted mt-0.5 text-xs">Warehouse Management Console</p>
              </div>

              <div className="mt-3 text-left">
                <h2 className="text-sm sm:text-base font-semibold">Selamat datang</h2>
                <p className="ks-muted mt-0.5 text-xs">
                  Silakan isi kredensial akun admin untuk masuk.
                </p>
              </div>

              {/* Error Message Box */}
              {error && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-600/30 bg-red-600/10 px-3.5 py-2.5 text-xs sm:text-sm text-red-600 animate-[fadeIn_0.2s_ease-out]"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* Form Input Kredensial */}
              <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 ks-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username Admin"
                    className="ks-focus ks-field w-full h-10 sm:h-10.5 rounded-xl sm:rounded-2xl border pl-9 pr-4 text-xs sm:text-sm focus:outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 ks-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password Admin"
                    className="ks-focus ks-field w-full h-10 sm:h-10.5 rounded-xl sm:rounded-2xl border pl-9 pr-9 text-xs sm:text-sm focus:outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 ks-muted hover:text-inherit transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {adminLockoutSeconds > 0 && (
                  <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-amber-500/30">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>
                      Terlalu banyak percobaan gagal. Tunggu <b>{adminLockoutSeconds}s</b>
                    </span>
                  </div>
                )}

                {/* Tombol Utama: Verifikasi Akses (Pill shape tema 2) */}
                <button
                  type="submit"
                  disabled={isLoading || adminLockoutSeconds > 0}
                  aria-busy={isLoading}
                  className="ks-focus relative mt-3 flex h-11 sm:h-12 w-full items-center justify-center rounded-full border border-[#2B3A55] bg-[#0E1B2E] font-medium text-white transition-all hover:bg-[#17294A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 shadow-sm cursor-pointer"
                >
                  <span className="absolute left-1.5 grid h-8 w-8 place-items-center rounded-full bg-white text-[#0E1B2E] shadow-xs">
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin text-[#0E1B2E]" />
                    ) : (
                      <ShieldCheck size={16} className="text-[#0E1B2E]" />
                    )}
                  </span>
                  <span className="text-xs sm:text-sm font-medium tracking-wide">
                    {isLoading
                      ? 'Memverifikasi kredensial…'
                      : adminLockoutSeconds > 0
                      ? `Terkunci (${adminLockoutSeconds}s)`
                      : 'Verifikasi Akses Admin'}
                  </span>
                </button>

                {/* Divider Sistem Aman */}
                <div className="my-3 flex items-center gap-3">
                  <span className="ks-border flex-1 border-t" />
                  <span className="ks-muted text-[10px] sm:text-xs tracking-wider uppercase font-medium">
                    SISTEM AMAN
                  </span>
                  <span className="ks-border flex-1 border-t" />
                </div>

                {/* Tombol Sekunder: Masuk Sebagai Tamu */}
                <button
                  type="button"
                  disabled={isLoading || adminLockoutSeconds > 0}
                  onClick={() => setShowPinModal(true)}
                  className="ks-focus ks-border ks-btn flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs sm:text-sm font-medium transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound size={15} />
                  <span>Masuk sebagai tamu</span>
                </button>
              </form>

              {/* Disclaimer Kebijakan */}
              <p className="ks-muted mt-4 text-center text-[10px] sm:text-[11px] leading-relaxed">
                Dengan masuk, Anda menyetujui Protokol Keselamatan Gudang dan Kebijakan Privasi Data internal.
              </p>

              {/* Card Footer Status */}
              <div className="ks-border ks-muted mt-3.5 flex items-center justify-between border-t pt-3 text-[10px] sm:text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sistem normal
                </span>
                <span className="font-mono tracking-wider">ID - JKT - 01</span>
              </div>
            </section>
          </div>

          {/* Mobile Footer */}
          <p className="relative text-[11px] text-[#8FA0B8] lg:hidden">
            Kalindo Scan &copy; {new Date().getFullYear()} Admin Portal
          </p>
        </main>

        {renderModals()}
      </div>
    );
  }

  /* =========================================================================
     VIEW: TEMA 1 (DESAIN LAMA - BIRU KALINDO KLASIK)
     ========================================================================= */
  return (
    <div className="h-full min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-gray-950 transition-colors duration-500 ease-in-out relative overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none">
      {/* ================= MOBILE & TABLET LAYOUT (< lg) ================= */}
      <div className="lg:hidden relative w-full min-h-[100dvh] flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#1d63ed] via-[#2563eb] to-[#0f172a] text-white">
        {/* Responsive WebP Background Graphic */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <picture className="w-full h-full block">
            <source
              media="(max-width: 639px)"
              srcSet="/assets/login-illustration-mobile.webp"
              type="image/webp"
            />
            <source
              media="(min-width: 640px) and (max-width: 1023px)"
              srcSet="/assets/login-illustration-tablet.webp"
              type="image/webp"
            />
            <img
              src="/assets/login-illustration-mobile.webp"
              alt="Kalindo Scan Mobile Illustration"
              className="w-full h-full object-cover object-center opacity-30 mix-blend-overlay"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/login-illustration.webp';
              }}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/85 via-blue-950/30 to-blue-900/10 pointer-events-none"></div>
        </div>

        {/* Ambient Glows */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Navigation & Branding */}
        <div className="relative z-10 w-full max-w-[24rem] sm:max-w-[26rem] pt-2 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md hover:bg-white/25 text-white text-xs font-semibold border border-white/20 transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Kembali</span>
          </button>

          <div className="flex items-center gap-1.5 text-blue-100 font-bold text-xs tracking-wider uppercase bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-xs">
            <Shield size={12} className="text-blue-300" />
            <span>Admin Mode</span>
          </div>
        </div>

        {/* Branding Badge Mobile */}
        <div className="relative z-10 pt-2 flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-1.5 border border-white/40 shadow-xl">
            <Shield size={24} className="text-white" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Admin <span className="text-blue-200">Portal</span>
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm font-medium mt-0.5 max-w-xs leading-tight drop-shadow">
            Warehouse Management Console
          </p>
        </div>

        {/* Center Glassmorphic Form Card Mobile */}
        <div className="relative z-10 w-full max-w-[24rem] sm:max-w-[26rem] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-gray-800 p-5 sm:p-6 my-auto text-gray-900 dark:text-white">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-center mb-1">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Masuk Administrator
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                Silakan isi kredensial akun admin Anda
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username Admin"
                  className="w-full h-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password Admin"
                  className="w-full h-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-9 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {adminLockoutSeconds > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800">
                <AlertCircle size={15} className="shrink-0 text-amber-500" />
                <span>
                  Terlalu banyak percobaan gagal. Tunggu <b>{adminLockoutSeconds}s</b>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || adminLockoutSeconds > 0}
              className="w-full h-10 sm:h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm mt-3 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : adminLockoutSeconds > 0 ? (
                `Terkunci (${adminLockoutSeconds}s)`
              ) : (
                'Verifikasi Akses'
              )}
            </button>
            <button
              type="button"
              disabled={isLoading || adminLockoutSeconds > 0}
              onClick={() => setShowPinModal(true)}
              className="w-full h-9 sm:h-10 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              Masuk sebagai tamu
            </button>
          </form>

          <div className="mt-3 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
              Akses ini hanya untuk personal berwenang. Semua aktivitas masuk akan dicatat.
            </p>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pb-1 text-[10px] text-blue-200/70 font-medium">
          Kalindo Scan &copy; {new Date().getFullYear()} Admin Portal
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
                (e.target as HTMLImageElement).src = '/assets/login-illustration.svg';
              }}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/60 via-transparent to-blue-900/20 pointer-events-none"></div>

          {/* Branding Overlay Desktop */}
          <div className="relative z-10 text-left p-6 lg:p-8 xl:p-12 max-w-lg my-auto -translate-y-4 xl:translate-y-0">
            <div className="w-12 h-12 lg:w-14 lg:h-14 xl:w-18 xl:h-18 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2.5 xl:mb-4 border border-white/40 shadow-xl relative group">
              <div className="absolute inset-0 bg-blue-400/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity"></div>
              <Shield
                size={26}
                className="text-white relative z-10 lg:w-7 lg:h-7 xl:w-9 xl:h-9"
                strokeWidth={1.75}
              />
            </div>

            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white mb-1.5 xl:mb-2 tracking-tight leading-tight drop-shadow-md">
              Admin <span className="text-blue-200">Portal</span>
            </h1>
            <p className="text-blue-100/90 text-xs lg:text-sm xl:text-base font-medium leading-relaxed max-w-xs sm:max-w-sm xl:max-w-md drop-shadow">
              Akses konsol manajemen untuk pengaturan peran, PIN, dan audit sistem Kalindo Scan.
            </p>

            <div className="absolute -top-8 -left-6 animate-bounce duration-[3500ms] pointer-events-none opacity-40">
              <Box className="text-white w-8 h-8 lg:w-9 lg:h-9" />
            </div>
            <div className="absolute top-1/2 -right-8 animate-bounce duration-[4500ms] pointer-events-none opacity-40">
              <Package className="text-white w-9 h-9 lg:w-10 lg:h-10" />
            </div>
            <div className="absolute bottom-1 right-8 animate-pulse pointer-events-none opacity-30">
              <Shuffle className="text-white w-6 h-6 lg:w-7 lg:h-7" />
            </div>
          </div>
        </div>

        {/* Desktop Right Side - Admin Login Form */}
        <div className="w-1/2 h-full bg-[#f8fafc] dark:bg-gray-950 flex flex-col items-center justify-center p-3 sm:p-4 lg:p-4 xl:p-8 relative z-10 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Form Card Floating & Centered */}
          <div className="w-full max-w-[25rem] xl:max-w-[27rem] my-auto py-1 sm:py-2">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-[0_20px_50px_-20px_rgba(29,99,237,0.18)] border border-gray-100 dark:border-gray-800 p-5 sm:p-6 lg:p-5 xl:p-7 relative z-10 animate-[fadeIn_0.3s_ease-out] transition-colors duration-200">
              {/* Header inside Card with Shield and Back Button */}
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 shadow-xs">
                  <Shield size={20} strokeWidth={2} />
                </div>

                {/* Back to Login Button */}
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title="Kembali ke halaman login utama"
                >
                  <ArrowLeft size={13} />
                  <span>Kembali</span>
                </button>
              </div>

              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-0.5">
                  Admin <span className="text-blue-600 dark:text-blue-500">Portal</span>
                </h1>
                <p className="text-gray-400 dark:text-gray-500 font-medium text-xs">
                  Warehouse Management Console
                </p>
              </div>

              <div className="text-left mt-2 sm:mt-2.5">
                <h2 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                  Masuk Administrator
                </h2>
                <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-0.5">
                  Silakan isi kredensial akun admin Anda
                </p>
              </div>

              {error && (
                <div className="mt-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-2 rounded-xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                  <AlertCircle size={14} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-2 sm:mt-2.5 space-y-2">
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username Admin"
                    className="w-full h-9 sm:h-9.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl pl-9 pr-4 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password Admin"
                    className="w-full h-9 sm:h-9.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl pl-9 pr-9 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {adminLockoutSeconds > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 p-2 rounded-xl text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800">
                    <AlertCircle size={14} className="shrink-0 text-amber-500" />
                    <span>
                      Terlalu banyak percobaan gagal. Tunggu <b>{adminLockoutSeconds}s</b>
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || adminLockoutSeconds > 0}
                  className="w-full h-9.5 sm:h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-medium rounded-full shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm mt-2.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : adminLockoutSeconds > 0 ? (
                    `Terkunci (${adminLockoutSeconds}s)`
                  ) : (
                    'Verifikasi Akses'
                  )}
                </button>

                <button
                  type="button"
                  disabled={isLoading || adminLockoutSeconds > 0}
                  onClick={() => setShowPinModal(true)}
                  className="w-full h-8.5 sm:h-9 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  Masuk sebagai tamu
                </button>
              </form>

              <div className="mt-2 sm:mt-2.5 text-center">
                <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  Akses ini hanya untuk personal berwenang. Semua aktivitas masuk akan dicatat untuk audit keamanan.
                </p>
              </div>

              {/* Status Footer */}
              <div className="mt-2 sm:mt-2.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Konsol aman
                </span>
                <span className="font-mono tracking-wider">ADMIN-SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderModals()}
    </div>
  );
};
