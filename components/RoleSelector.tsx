import React, { useState, useEffect } from 'react';
import { UserRole, UserPermissions, ProfileConfig } from '../types';
import {
  Box,
  Shuffle,
  Package,
  PackageCheck,
  Monitor,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  AlertCircle,
  Lock,
  Warehouse,
  Bike,
  User,
  UserCheck,
  Shield,
  ShieldCheck,
  Cloud,
  Crown,
  ScanLine,
  Palette,
  Check
} from 'lucide-react';
import { getActiveLoginTheme, saveUserLoginTheme, LoginThemeVariant } from '../services/themeSyncService';

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  userEmail: string;
  onLogout: () => void;
  permissions: UserPermissions;
  profileConfig?: ProfileConfig[];
  onOpenGodMode?: () => void;
}

/* =========================================================================
   TEMA 1 CONFIGURATION (DESAIN LAMA - KARTU HORIZONTAL GRADASI)
   ========================================================================= */

const roleCardConfigTema1: Record<
  string,
  { icon: any; colorGradient: string; title: string; desc: string; bgImage?: string }
> = {
  PICKER: {
    icon: Box,
    colorGradient: 'from-[#2563eb] via-[#2563eb] to-[#1d4ed8] shadow-blue-500/20',
    title: 'PICKER',
    desc: 'Pengambilan Barang',
    bgImage: '/assets/picker-bg.webp'
  },
  PICKER_2: {
    icon: Box,
    colorGradient: 'from-[#2563eb] via-[#2563eb] to-[#1d4ed8] shadow-blue-500/20',
    title: 'PICKER 2',
    desc: 'Pengambilan Barang',
    bgImage: '/assets/picker-bg.webp'
  },
  SORTIR: {
    icon: Shuffle,
    colorGradient: 'from-[#9333ea] via-[#9333ea] to-[#7e22ce] shadow-purple-500/20',
    title: 'SORTIR',
    desc: 'Scan Zona Sortir',
    bgImage: '/assets/sortir-bg.webp'
  },
  SORTIR_BATCH: {
    icon: Shuffle,
    colorGradient: 'from-[#c026d3] via-[#c026d3] to-[#a21caf] shadow-fuchsia-500/20',
    title: 'SORTIR BATCH',
    desc: 'Scan Sortir Batch',
    bgImage: '/assets/sortirbatch-bg.webp'
  },
  PACKING: {
    icon: Package,
    colorGradient: 'from-[#f97316] via-[#ea580c] to-[#c2410c] shadow-orange-500/20',
    title: 'PACKING',
    desc: 'Packing & Pengemasan',
    bgImage: '/assets/packing-bg.webp'
  },
  PACKING_2: {
    icon: Package,
    colorGradient: 'from-[#f97316] via-[#ea580c] to-[#c2410c] shadow-orange-500/20',
    title: 'PACKING 2',
    desc: 'Packing & Pengemasan',
    bgImage: '/assets/packing-bg.webp'
  },
  GUDANG: {
    icon: Warehouse,
    colorGradient: 'from-[#059669] via-[#059669] to-[#047857] shadow-emerald-500/20',
    title: 'GUDANG',
    desc: 'Manajemen Stok',
    bgImage: '/assets/gudang-bg.webp'
  },
  OJOL: {
    icon: Bike,
    colorGradient: 'from-[#0891b2] via-[#0891b2] to-[#0e7490] shadow-cyan-500/20',
    title: 'OJOL',
    desc: 'Pengiriman Ojol',
    bgImage: '/assets/ojol-bg.webp'
  },
  LEADER: {
    icon: Crown,
    colorGradient: 'from-[#6366f1] via-[#4f46e5] to-[#3730a3] shadow-indigo-500/20',
    title: 'LEADER',
    desc: 'Laporan & Monitoring',
    bgImage: '/assets/leader-bg.webp'
  },
  CHECKER: {
    icon: User,
    colorGradient: 'from-[#0d9488] via-[#0d9488] to-[#0f766e] shadow-teal-500/20',
    title: 'CHECKER',
    desc: 'Verifikasi & Checker',
    bgImage: '/assets/checker-bg.webp'
  },
  ADMIN: {
    icon: Monitor,
    colorGradient: 'from-[#db2777] via-[#db2777] to-[#be185d] shadow-pink-500/20',
    title: 'ADMIN',
    desc: 'Scan Admin',
    bgImage: '/assets/admin-bg.webp'
  }
};

/* =========================================================================
   TEMA 2 CONFIGURATION (DESAIN BARU - CLEAN MODERN GRID & BORDER-L)
   ========================================================================= */

const roleCardConfigTema2: Record<
  string,
  { icon: any; color: string; title: string; subtitle: string }
> = {
  PICKER: {
    icon: Package,
    color: '#2F6FB5',
    title: 'Picker',
    subtitle: 'Pengambilan barang'
  },
  PICKER_2: {
    icon: Package,
    color: '#2F6FB5',
    title: 'Picker 2',
    subtitle: 'Pengambilan barang'
  },
  CHECKER: {
    icon: UserCheck,
    color: '#2E8B6E',
    title: 'Checker',
    subtitle: 'Verifikasi & checker'
  },
  PACKING: {
    icon: PackageCheck,
    color: '#C9772B',
    title: 'Packing',
    subtitle: 'Packing & pengemasan'
  },
  PACKING_2: {
    icon: PackageCheck,
    color: '#C9772B',
    title: 'Packing 2',
    subtitle: 'Packing & pengemasan'
  },
  GUDANG: {
    icon: Warehouse,
    color: '#5E8C3A',
    title: 'Gudang',
    subtitle: 'Manajemen stok'
  },
  OJOL: {
    icon: Bike,
    color: '#2A8FA3',
    title: 'Ojol',
    subtitle: 'Pengiriman ojol'
  },
  LEADER: {
    icon: Crown,
    color: '#6E5BB5',
    title: 'Leader',
    subtitle: 'Laporan & monitoring'
  },
  ADMIN: {
    icon: Monitor,
    color: '#B5446E',
    title: 'Admin',
    subtitle: 'Scan admin'
  },
  SORTIR: {
    icon: Shuffle,
    color: '#8A4EB5',
    title: 'Sortir',
    subtitle: 'Scan zona sortir'
  },
  SORTIR_BATCH: {
    icon: Shuffle,
    color: '#A21CAF',
    title: 'Sortir Batch',
    subtitle: 'Scan sortir batch'
  }
};

/* =========================================================================
   TEMA 2 VECTOR ASSETS
   ========================================================================= */

const MarkTema2 = ({ size = 36 }: { size?: number }) => (
  <div
    className="grid place-items-center rounded-xl bg-[#F2B705] text-[#16191D] shadow-sm"
    style={{ width: size, height: size }}
  >
    <ScanLine size={size * 0.55} strokeWidth={2.4} />
  </div>
);

function IllustrationTema2({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 400"
      className={className}
      role="img"
      aria-label="Kotak paket terbuka dengan label barcode yang dipindai pemindai genggam"
    >
      <defs>
        <pattern id="hm_bc" width="9" height="1" patternUnits="userSpaceOnUse">
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
        <rect x="14" y="54" width="47" height="22" fill="url(#hm_bc)" />
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

/* =========================================================================
   ROLE SELECTOR COMPONENT
   ========================================================================= */

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  onSelectRole,
  isDarkMode,
  toggleTheme,
  userEmail,
  onLogout,
  permissions,
  profileConfig = [],
  onOpenGodMode
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Active Login Theme (defaults to 'tema_1')
  const [activeTheme, setActiveTheme] = useState<LoginThemeVariant>(() => getActiveLoginTheme());

  const userKey = userEmail ? userEmail.toLowerCase().trim() : 'guest';
  const THEME_CHOSEN_KEY = `kalindo_theme_chosen_${userKey}`;

  // Modal selector muncul sekali setelah login jika belum pernah memilih tema
  const [showThemeModal, setShowThemeModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_CHOSEN_KEY) !== 'true';
    } catch {
      return false;
    }
  });
  const [selectedThemeOption, setSelectedThemeOption] = useState<LoginThemeVariant>(() => getActiveLoginTheme());

  const handleSelectTheme = (theme: LoginThemeVariant) => {
    setSelectedThemeOption(theme);
    setActiveTheme(theme);
    saveUserLoginTheme(theme, userEmail);
    try {
      localStorage.setItem(THEME_CHOSEN_KEY, 'true');
    } catch (e) {
      console.warn('Storage error', e);
    }
    setShowThemeModal(false);
  };

  // Auto-dismiss error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleRoleClick = (role: UserRole) => {
    setError(null);

    // 0. DEVELOPER / GOD MODE BYPASS
    const isSuperUser =
      userEmail === 'developer@kalindo.com' ||
      userEmail === 'dev@kalindo.com' ||
      userEmail === 'jgilbeth92@gmail.com';

    // 1. Check if email exists in DB (passed via props)
    if (!isSuperUser) {
      const strictRoles = permissions[userEmail];

      if (strictRoles && !strictRoles.includes(role)) {
        setError(`Akses Ditolak: Akun tidak memiliki izin untuk ${role}`);
        return;
      }
    }

    // 2. Proceed
    onSelectRole(role);
  };

  // Helper to format clean display name from user email
  const getDisplayName = (email: string) => {
    if (!email) return 'Johan G.';
    if (email.toLowerCase().includes('jgilbeth') || email.toLowerCase().includes('johan'))
      return 'Johan G.';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)} ${parts[1].charAt(0).toUpperCase()}.`;
    }
    return email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
  };

  // Helper to get dynamic title based on user email and permissions
  const getUserTitle = (email: string, userPerms: UserPermissions) => {
    if (!email) return 'Staff Warehouse';
    const lower = email.toLowerCase();

    // Check Developer / Superuser
    if (lower.includes('developer') || lower.includes('jgilbeth') || lower.includes('dev@')) {
      return 'System Developer';
    }

    // Check Email name hints
    if (lower.includes('admin')) return 'System Administrator';
    if (lower.includes('spv') || lower.includes('supervisor')) return 'SPV Warehouse';
    if (lower.includes('leader')) return 'Leader Warehouse';
    if (lower.includes('checker')) return 'Tim Checker';
    if (lower.includes('gudang')) return 'Tim Gudang';
    if (lower.includes('packing')) return 'Tim Packing';
    if (lower.includes('picker')) return 'Tim Picker';
    if (lower.includes('sortir')) return 'Tim Sortir';
    if (lower.includes('ojol')) return 'Tim Ojol';

    // Check Permissions array
    const userRoles = userPerms[email] || [];
    if (userRoles.includes('ADMIN')) return 'System Administrator';
    if (userRoles.includes('LEADER')) return 'Leader Warehouse';
    if (userRoles.length >= 3) return 'Staff Operasional';

    if (userRoles.length > 0) {
      const primaryRole = userRoles[0];
      switch (primaryRole) {
        case 'PICKER':
        case 'PICKER_2':
          return 'Tim Picker';
        case 'SORTIR':
        case 'SORTIR_BATCH':
          return 'Tim Sortir';
        case 'PACKING':
        case 'PACKING_2':
          return 'Tim Packing';
        case 'GUDANG':
          return 'Tim Gudang';
        case 'CHECKER':
          return 'Tim Checker';
        case 'OJOL':
          return 'Tim Ojol';
        default:
          return 'Staff Warehouse';
      }
    }

    return 'Staff Warehouse';
  };

  // Common Dialog: Logout Confirmation Modal
  const renderLogoutModal = () =>
    showLogoutConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setShowLogoutConfirm(false)}
        ></div>
        <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6 animate-[popIn_0.2s_ease-out] border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-4 transition-colors border border-red-100 dark:border-red-900/30">
              <LogOut size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Konfirmasi Keluar</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mb-6">
              Apakah Anda yakin ingin keluar dari aplikasi Kalindo Scan?
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 shadow-md shadow-red-500/20 text-sm transition-all active:scale-95 cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  // Modal Pilih Tema (Muncul sekali setelah login ke halaman profil)
  const renderThemeModal = () =>
    showThemeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" />
        <div className="bg-white dark:bg-[#16191D] w-full max-w-md rounded-3xl shadow-2xl relative z-10 p-6 animate-[popIn_0.25s_ease-out] border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Palette size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Pilih Tampilan Desain</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pilih gaya tampilan yang paling nyaman untuk Anda bekerja
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {/* Opsi 1: Tema 1 */}
            <div
              onClick={() => handleSelectTheme('tema_1')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedThemeOption === 'tema_1'
                  ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  T1
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Tema 1: Kalindo Klasik</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                      Standar
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Desain warna biru khas Kalindo dengan kartu peran horizontal
                  </p>
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                  selectedThemeOption === 'tema_1'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {selectedThemeOption === 'tema_1' && <Check size={14} strokeWidth={3} />}
              </div>
            </div>

            {/* Opsi 2: Tema 2 */}
            <div
              onClick={() => handleSelectTheme('tema_2')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedThemeOption === 'tema_2'
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0E1B2E] border border-[#2B3A55] text-[#F2B705] flex items-center justify-center font-bold text-sm shadow-sm">
                  T2
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">Tema 2: Modern Warehouse</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                      Baru
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Desain industrial modern navy & emas dengan layout menu grid
                  </p>
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 ${
                  selectedThemeOption === 'tema_2'
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {selectedThemeOption === 'tema_2' && <Check size={14} strokeWidth={3} />}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => handleSelectTheme(selectedThemeOption)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-sm transition-all active:scale-[0.99] shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Terapkan Pilihan
            </button>
            <p className="text-[11px] text-center text-gray-400 dark:text-gray-500">
              💡 Pilihan tersimpan di profil Anda. Anda dapat mengganti tema kapan saja melalui menu <b>Pengaturan</b>.
            </p>
          </div>
        </div>
      </div>
    );

  // Common Toast: Error Alert
  const renderErrorToast = () =>
    error && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-[toastSlide_0.4s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="bg-red-500 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-white/20 shadow-red-500/30">
          <AlertCircle size={20} className="shrink-0" />
          <span className="font-bold text-xs sm:text-sm">{error}</span>
        </div>
      </div>
    );

  /* =========================================================================
     RENDER TEMA 2: DESAIN MODERN DARK NAVY & CLEAN MENU GRID
     ========================================================================= */
  if (activeTheme === 'tema_2') {
    const iconBtn =
      'hm-focus grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer shadow-xs active:scale-95';

    // Active profiles sorted by sort_order
    const activeProfiles = profileConfig
      .filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    return (
      <div className="hm-root min-h-full select-none" data-theme={isDarkMode ? 'dark' : 'light'}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
          .hm-root {
            --page: #F3F4F2;
            --surface: #ffffff;
            --text: #16191D;
            --muted: #5B636B;
            --line: #D5D9DC;
            --tile: #EEF1F4;
            --ring: #B8860B;
            font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            background: var(--page);
            color: var(--text);
          }
          .hm-root[data-theme='dark'] {
            --page: #0F1114;
            --surface: #181B1F;
            --text: #ECEEF0;
            --muted: #9AA3AB;
            --line: #2B3036;
            --tile: #22262B;
            --ring: #F2B705;
          }
          .hm-surface { background: var(--surface); }
          .hm-muted { color: var(--muted); }
          .hm-border { border-color: var(--line); }
          .hm-tile { background: var(--tile); color: var(--muted); }
          .hm-card { background: var(--surface); border-color: var(--line); }
          .hm-focus:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

          @keyframes ks-sweep {
            to { transform: translateY(26px); }
          }
          .ks-sweep {
            animation: ks-sweep 2.2s ease-in-out infinite alternate;
          }
          @media (prefers-reduced-motion: reduce) {
            .ks-sweep { animation: none; }
          }
          @media (min-width: 1024px) {
            html {
              font-size: clamp(14px, min(2.2vh, 1.1vw), 17px);
            }
          }
        `}</style>

        {/* ================= HEADER HERO MELENGKUNG ================= */}
        <header className="relative overflow-hidden rounded-b-[2rem] bg-[#0E1B2E] text-white lg:rounded-b-[2.5rem]">
          {/* Watermark Ilustrasi Tema 2 */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <IllustrationTema2 className="absolute -bottom-8 -right-10 block w-[24rem] max-w-none opacity-40 sm:right-0 sm:w-[28rem] sm:opacity-60 lg:right-[4%] lg:w-[34rem] lg:opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E1B2E] via-[#0E1B2E]/75 to-transparent" />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-12 pt-5 sm:px-8 lg:pb-16">
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MarkTema2 size={36} />
                <span className="text-lg font-semibold tracking-tight">Kalindo Scan</span>
              </div>
              <div className="flex gap-2">
                {onOpenGodMode && (
                <button
                  onClick={onOpenGodMode}
                  aria-label="Developer Mode"
                  className={iconBtn}
                  title="Developer Mode"
                >
                  <Crown size={17} className="text-amber-400" />
                </button>
              )}
              <button
                  onClick={toggleTheme}
                  aria-label={isDarkMode ? 'Mode terang' : 'Mode gelap'}
                  className={iconBtn}
                  title="Ganti Mode Terang/Gelap"
                >
                  {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  aria-label="Keluar"
                  className={iconBtn}
                  title="Keluar dari akun"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>

            {/* Sapaan Karyawan & Lencana Peran */}
            <div className="mt-8 lg:mt-12">
              <p className="text-sm text-[#8FA0B8]">Selamat bekerja,</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {getDisplayName(userEmail)}
              </h1>
              {onOpenGodMode ? (
                <button
                  onClick={onOpenGodMode}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-xs cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
                  title="Buka Developer Mode"
                >
                  <Crown size={15} className="text-amber-400" />
                  <span>{getUserTitle(userEmail, permissions)}</span>
                </button>
              ) : (
                <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium backdrop-blur-xs">
                  <ShieldCheck size={15} />
                  {getUserTitle(userEmail, permissions)}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ================= BODY KONTEN MENU ================= */}
        <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:pb-28 sm:px-8">
          {/* Kartu Status Cloud Server Melayang (-mt-7) */}
          <section className="hm-surface hm-border relative -mt-7 flex items-center gap-4 rounded-2xl border p-4 shadow-[0_16px_40px_-24px_rgba(14,27,46,0.45)] sm:p-5 transition-colors duration-200">
            <div className="hm-tile relative grid h-12 w-12 shrink-0 place-items-center rounded-xl">
              <Cloud size={22} className="text-blue-500 dark:text-blue-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-emerald-500 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base">System Ready</div>
              <p className="hm-muted flex items-center gap-2 text-sm mt-0.5">
                <span>Server Cloud</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Online</span>
              </p>
            </div>
          </section>

          {/* Subheader: Menu Utama & Versi Cloud */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Menu utama</h2>
            <span className="hm-card rounded-full border px-3 py-1 font-mono text-xs hm-muted shadow-2xs">
              v2.3 Cloud
            </span>
          </div>

          {/* Grid Kartu Peran 2-3 Kolom dengan Border-L [5px] */}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeProfiles.map((profile) => {
              const config =
                roleCardConfigTema2[profile.role] || {
                  icon: Package,
                  color: '#2F6FB5',
                  title: profile.role,
                  subtitle: 'Akses sistem'
                };
              const Icon = config.icon;

              return (
                <li key={profile.role}>
                  <button
                    onClick={() => handleRoleClick(profile.role as UserRole)}
                    className="hm-focus hm-card group flex w-full items-center gap-4 rounded-2xl border border-l-[5px] p-4 text-left transition-all hover:shadow-md active:scale-[0.99] sm:p-5 cursor-pointer"
                    style={{ borderLeftColor: config.color }}
                  >
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-xs"
                      style={{ background: config.color }}
                    >
                      <Icon size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-tight">{config.title}</span>
                      <span className="hm-muted block text-xs sm:text-sm mt-0.5 truncate">
                        {config.subtitle}
                      </span>
                    </span>
                    <ChevronRight
                      size={18}
                      className="hm-muted shrink-0 transition-transform group-hover:translate-x-1"
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer Keamanan */}
          <p className="hm-muted mt-10 flex items-center justify-center gap-3 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={13} />
              Authorized access only
            </span>
            <span>&bull;</span>
            <span>Kalindo WMS</span>
          </p>
        </main>

        {renderErrorToast()}
        {renderLogoutModal()}
        {renderThemeModal()}
      </div>
    );
  }

  /* =========================================================================
     RENDER TEMA 1: DESAIN LAMA (BIRU GRADASI KLASIK)
     ========================================================================= */
  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-gray-950 relative overflow-hidden transition-colors duration-500 ease-in-out select-none">
      {/* ================= TOP BLUE HERO SECTION ================= */}
      <div className="relative w-full bg-gradient-to-br from-[#1d63ed] via-[#2563eb] to-[#1e40af] text-white pt-6 pb-11 sm:pb-14 px-6 sm:px-8 shrink-0 overflow-hidden">
        {/* Background Responsive WebP Graphic - Full Width Left to Right */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-85 sm:opacity-95">
          <picture className="w-full h-full block">
            <source
              media="(max-width: 639px)"
              srcSet="/assets/dashboard-hero-mobile.webp"
              type="image/webp"
            />
            <source
              media="(min-width: 640px)"
              srcSet="/assets/dashboard-hero.webp"
              type="image/webp"
            />
            <img
              src="/assets/dashboard-hero.webp"
              alt="Dashboard Warehouse Illustration"
              className="w-full h-full object-cover object-right"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-[#1d63ed] via-[#1d63ed]/50 to-transparent/10 pointer-events-none" />
        </div>

        {/* Ambient Subtle Wave Overlays */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 right-1/3 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Top Bar Navigation */}
        <div className="relative z-10 flex justify-between items-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Kalindo <span className="text-blue-200 font-bold">Scan</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-blue-800/40 hover:bg-blue-800/60 backdrop-blur-md flex items-center justify-center text-white transition-all border border-blue-400/20 shadow-xs active:scale-95 cursor-pointer"
              title="Ganti Tema"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-9 h-9 rounded-full bg-white hover:bg-red-50 flex items-center justify-center text-red-500 transition-all shadow-md active:scale-95 cursor-pointer"
              title="Keluar"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* User Greeting Box */}
        <div className="relative z-10 max-w-xs sm:max-w-md pt-1 pb-1">
          <p className="text-blue-100 text-xs sm:text-sm font-medium tracking-wide">
            Selamat Bekerja,
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5 mb-2 drop-shadow-sm">
            {getDisplayName(userEmail)}
          </h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full border border-white/25 text-xs font-semibold text-white shadow-xs">
            <Shield size={13} className="text-blue-200 shrink-0" />
            <span>{getUserTitle(userEmail, permissions)}</span>
          </div>
        </div>

        {/* Bottom Curved Wave Separator */}
        <div className="absolute -bottom-1 -left-[1%] w-[102%] h-6 sm:h-8 overflow-hidden pointer-events-none z-10 translate-y-[1px]">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-full w-full block">
            <path
              d="M0,35 Q600,90 1200,35 L1200,120 L0,120 Z"
              className="fill-[#f8fafc] dark:fill-gray-950"
            ></path>
          </svg>
        </div>
      </div>

      {/* ================= SCROLLABLE DASHBOARD BODY ================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 sm:px-8 pb-10 pt-2 relative z-10">
        {/* System Ready Status Card */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 flex items-center justify-between border border-slate-200/70 dark:border-gray-800/80 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center gap-3.5">
              <div className="relative w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 border border-blue-100 dark:border-blue-800/40">
                <Cloud size={22} className="text-blue-500 dark:text-blue-400" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-extrabold text-sm sm:text-base leading-tight">
                  System Ready
                </h3>
                <p className="text-blue-600 dark:text-blue-400 text-xs font-medium mt-0.5 flex items-center gap-1">
                  <span>Server Cloud</span>
                  <span className="inline-block w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                  <span>Online</span>
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-gray-600 shrink-0" />
          </div>
        </div>

        {/* Menu Section Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Menu Utama
          </h2>
          <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-100/80 dark:border-blue-900/40 shadow-2xs">
            v2.3 Cloud
          </span>
        </div>

        {/* Role Cards List - Horizontal Design */}
        <div className="flex flex-col gap-3.5 sm:gap-4 max-w-3xl mx-auto">
          {profileConfig
            .filter((p) => p.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((profile) => {
              const config = roleCardConfigTema1[profile.role];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <button
                  key={profile.role}
                  onClick={() => handleRoleClick(profile.role as UserRole)}
                  className={`relative w-full h-20 sm:h-22 bg-gradient-to-r ${config.colorGradient} rounded-3xl p-4 sm:p-5 text-left overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 active:scale-[0.98] flex items-center justify-between border border-white/10 cursor-pointer`}
                >
                  {/* Background WebP Image full width if provided */}
                  {config.bgImage ? (
                    <img
                      src={config.bgImage}
                      alt={config.title}
                      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none z-0 transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <>
                      {/* Glossy Diagonal Texture Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-black/10 pointer-events-none"></div>
                      <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,transparent_60%)] pointer-events-none"></div>
                    </>
                  )}

                  {/* Left Side: Squircle Icon & Text */}
                  <div className="flex items-center gap-3.5 relative z-10 min-w-0">
                    <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner shrink-0">
                      <Icon size={24} className="sm:w-7 sm:h-7" />
                    </div>
                    <div className="truncate">
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-wider drop-shadow-xs truncate">
                        {config.title}
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-white/90 truncate underline decoration-white/30 underline-offset-2">
                        {config.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Chevron Indicator */}
                  <div className="relative z-10 shrink-0 ml-2">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white/25 group-hover:translate-x-1 transition-all">
                      <ChevronRight size={22} className="text-white/90" />
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {/* Footer Security Badge */}
        <div className="mt-8 flex justify-center pb-2">
          <p className="text-[11px] font-medium text-slate-400 dark:text-gray-600 flex items-center gap-1.5">
            <Lock size={12} /> Authorized Access Only &bull; Kalindo WMS
          </p>
        </div>
      </div>

      {renderErrorToast()}
      {renderLogoutModal()}
      {renderThemeModal()}

      <style>{`
        @keyframes toastSlide {
          0% { transform: translate(-50%, -100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
