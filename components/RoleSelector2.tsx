import React, { useState, useEffect } from 'react';
import { UserRole, UserPermissions, ProfileConfig } from '../types';
import { Box, Shuffle, Package, Monitor, Moon, Sun, LogOut, Info, ChevronRight, AlertCircle, Lock, Warehouse, Bike, User } from 'lucide-react';

interface RoleSelector2Props {
  onSelectRole: (role: UserRole) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  userEmail: string;
  onLogout: () => void;
  permissions: UserPermissions;
  profileConfig?: ProfileConfig[];
}

const roleCardConfig: Record<string, { bgImage: string, icon: any, colorClass: string, title: string, desc: string }> = {
  'PICKER': { bgImage: '/assets/picker-bg.webp', icon: Box, colorClass: 'from-blue-500 to-blue-700 dark:from-blue-700 dark:to-blue-950 shadow-blue-200 dark:shadow-blue-500/40 dark:border-blue-900 text-blue-100', title: 'PICKER', desc: 'Pengambilan Barang' },
  'SORTIR': { bgImage: '/assets/sortir-bg.webp', icon: Shuffle, colorClass: 'from-purple-500 to-purple-700 dark:from-purple-700 dark:to-purple-950 shadow-purple-200 dark:shadow-purple-500/40 dark:border-purple-900 text-purple-100', title: 'SORTIR', desc: 'Scan Zona Sortir' },
  'SORTIR_BATCH': { bgImage: '/assets/sortir-bg.webp', icon: Shuffle, colorClass: 'from-fuchsia-500 to-fuchsia-700 dark:from-fuchsia-700 dark:to-fuchsia-950 shadow-fuchsia-200 dark:shadow-fuchsia-500/40 dark:border-fuchsia-900 text-fuchsia-100', title: 'SORTIR BATCH', desc: 'Scan Sortir Batch' },
  'PACKING': { bgImage: '/assets/packing-bg.webp', icon: Package, colorClass: 'from-orange-500 to-orange-700 dark:from-orange-600 dark:to-orange-900 shadow-orange-200 dark:shadow-orange-500/40 dark:border-orange-900 text-orange-100', title: 'PACKING', desc: 'Scan Manifest Box' },
  'GUDANG': { bgImage: '/assets/gudang-bg.webp', icon: Warehouse, colorClass: 'from-emerald-500 to-emerald-700 dark:from-emerald-700 dark:to-emerald-950 shadow-emerald-200 dark:shadow-emerald-500/40 dark:border-emerald-900 text-emerald-100', title: 'GUDANG', desc: 'Manajemen Stok' },
  'OJOL': { bgImage: '/assets/ojol-bg.webp', icon: Bike, colorClass: 'from-cyan-500 to-cyan-700 dark:from-cyan-700 dark:to-cyan-950 shadow-cyan-200 dark:shadow-cyan-500/40 dark:border-cyan-900 text-cyan-100', title: 'OJOL', desc: 'Pengiriman Ojol' },
  'LEADER': { bgImage: '/assets/leader-bg.webp', icon: User, colorClass: 'from-indigo-500 to-indigo-700 dark:from-indigo-700 dark:to-indigo-950 shadow-indigo-200 dark:shadow-indigo-500/40 dark:border-indigo-900 text-indigo-100', title: 'LEADER', desc: 'Monitoring & Check' },
  'CHECKER': { bgImage: '/assets/checker-bg.webp', icon: User, colorClass: 'from-teal-500 to-teal-700 dark:from-teal-700 dark:to-teal-950 shadow-teal-200 dark:shadow-teal-500/40 dark:border-teal-900 text-teal-100', title: 'CHECKER', desc: 'Verifikasi & Checker' },
  'ADMIN': { bgImage: '/assets/admin-bg.webp', icon: Monitor, colorClass: 'from-pink-500 to-pink-700 dark:from-pink-700 dark:to-pink-950 shadow-pink-200 dark:shadow-pink-500/40 dark:border-pink-900 text-pink-100', title: 'ADMIN', desc: 'Scan Admin' },
};

export const RoleSelector2: React.FC<RoleSelector2Props> = ({ onSelectRole, isDarkMode, toggleTheme, userEmail, onLogout, permissions, profileConfig = [] }) => {
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
    // Akun developer selalu diizinkan masuk ke mana saja tanpa cek permission database
    const isSuperUser = userEmail === 'developer@kalindo.com' || userEmail === 'dev@kalindo.com' || userEmail === 'jgilbeth92@gmail.com';

    // 1. Check if email exists in DB (passed via props)
    // Only check permission if NOT a super user
    if (!isSuperUser) {
      const strictRoles = permissions[userEmail];

      if (strictRoles && !strictRoles.includes(role)) {
        // Access Denied
        setError(`Access Denied: Account not authorized for ${role}`);
        return;
      }
    }

    // 2. Proceed
    onSelectRole(role);
  };

  // Reusable Background Component to ensure perfect uniformity with Dashboard
  const DashboardBackground = () => (
    <>
      {/* 1. New Dot Matrix Pattern (Replaces Isometric Grid) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotMatrix" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white" />
              <circle cx="12" cy="12" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotMatrix)" />
        </svg>
      </div>

      {/* 2. Abstract Angular Data Lines (Right Side) - PRESERVED */}
      <div className="absolute right-0 top-0 h-full w-3/4 opacity-15 pointer-events-none">
        <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="w-full h-full">
          <path d="M 450 0 L 250 200 L 300 200 L 500 0" fill="white" />
          <path d="M 400 0 L 200 200 L 220 200 L 420 0" fill="white" opacity="0.5" />
        </svg>
      </div>

      {/* 3. Small Rounded Bars (Bottom Left) */}
      <div className="absolute left-6 bottom-6 w-12 h-1 bg-white opacity-20 rounded-full"></div>
      <div className="absolute left-6 bottom-8 w-6 h-1 bg-white opacity-20 rounded-full"></div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative overflow-hidden transition-colors duration-500 ease-in-out">

      {/* Fixed Header */}
      <div className="px-6 pt-8 pb-4 shrink-0 bg-gray-50 dark:bg-gray-900 z-10 transition-colors duration-500 ease-in-out">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Kalindo <span className="text-blue-600 dark:text-blue-500">Scan</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30 shadow-sm"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Selamat Bekerja, <span className="text-gray-900 dark:text-gray-200 font-semibold">{userEmail || 'User'}</span>
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
        <div className="px-6 pb-10">
          {/* System Status - Added mt-4 for spacing */}
          <div className="mb-6 mt-4">
            <div className="bg-white dark:bg-blue-900/10 rounded-xl p-4 flex items-center gap-4 border border-blue-100 dark:border-blue-800/50 shadow-sm transition-colors duration-500">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-colors duration-500">
                <Info size={20} />
              </div>
              <div>
                <h3 className="text-blue-900 dark:text-blue-100 font-bold text-sm">System Ready</h3>
                <p className="text-blue-600 dark:text-blue-300 text-xs font-medium mt-0.5">Server Cloud • Online</p>
              </div>
            </div>
          </div>

          {/* Error Toast (Fixed on Mobile) */}
          {error && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-[toastSlide_0.5s_cubic-bezier(0.16,1,0.3,1)]">
              <div className="bg-red-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-white/20 shadow-red-500/30">
                <AlertCircle size={24} className="shrink-0" />
                <span className="font-bold text-sm text-center">{error}</span>
              </div>
            </div>
          )}

          {/* Menu Title */}
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Menu Utama</h2>
            <span className="text-xs font-mono text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">v2.3 Cloud</span>
          </div>

          {/* Cards Container - Responsive Grid */}
          <div className="flex flex-col gap-4 md:grid md:grid-cols-2 xl:grid-cols-4 md:gap-6">

            {profileConfig
              .filter(p => p.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(profile => {
                const config = roleCardConfig[profile.role];
                if (!config) return null;
                const Icon = config.icon;
                
                return (
                  <button
                    key={profile.role}
                    onClick={() => handleRoleClick(profile.role as UserRole)}
                    className={`relative w-full h-40 md:h-64 bg-gradient-to-br ${config.colorClass} rounded-[2rem] p-6 text-left overflow-hidden group shadow-lg border border-transparent dark:border-t-white/10 dark:border-l-white/10 transition-all duration-500 active:scale-[0.98] hover:shadow-xl hover:translate-y-[-2px] flex flex-col justify-between`}
                  >
                    <DashboardBackground />

                    {config.bgImage && (
                      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-[2rem] opacity-30 group-hover:opacity-40 transition-opacity">
                        <img
                          src={config.bgImage}
                          alt={`${config.title} background`}
                          className="w-full h-full object-cover object-center"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                      </div>
                    )}

                    <div className="flex items-start justify-between relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 shadow-inner">
                        <Icon size={28} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <ChevronRight />
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className="text-2xl font-bold text-white mb-0.5 drop-shadow-sm">{config.title}</h3>
                      <p className="text-sm font-medium opacity-90">{config.desc}</p>
                    </div>
                  </button>
                );
              })}

          </div>

          <div className="mt-8 flex justify-center">
            <p className="text-xs text-gray-400 dark:text-gray-600 flex items-center gap-1">
              <Lock size={10} /> Authorized Access Only
            </p>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setShowLogoutConfirm(false)}
          ></div>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-6 animate-[popIn_0.2s_ease-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-4 transition-colors">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Konfirmasi Keluar</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Apakah anda yakin ingin keluar dari aplikasi?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors"
                >
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
