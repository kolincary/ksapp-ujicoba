
import React, { useState, useEffect } from 'react';
import { UserRole, UserPermissions, ProfileConfig } from '../types';
import { Box, Shuffle, Package, Monitor, Moon, Sun, LogOut, Info, ChevronRight, AlertCircle, Lock, Warehouse, Bike, User, Shield, Cloud, Crown, Award } from 'lucide-react';

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  userEmail: string;
  onLogout: () => void;
  permissions: UserPermissions;
  profileConfig?: ProfileConfig[];
}

const roleCardConfig: Record<string, { icon: any, colorGradient: string, title: string, desc: string, bgImage?: string }> = {
  'PICKER': { icon: Box, colorGradient: 'from-[#2563eb] via-[#2563eb] to-[#1d4ed8] shadow-blue-500/20', title: 'PICKER', desc: 'Pengambilan Barang', bgImage: '/assets/picker-bg.webp' },
  'PICKER_2': { icon: Box, colorGradient: 'from-[#2563eb] via-[#2563eb] to-[#1d4ed8] shadow-blue-500/20', title: 'PICKER 2', desc: 'Pengambilan Barang', bgImage: '/assets/picker-bg.webp' },
  'SORTIR': { icon: Shuffle, colorGradient: 'from-[#9333ea] via-[#9333ea] to-[#7e22ce] shadow-purple-500/20', title: 'SORTIR', desc: 'Scan Zona Sortir', bgImage: '/assets/sortir-bg.webp' },
  'SORTIR_BATCH': { icon: Shuffle, colorGradient: 'from-[#c026d3] via-[#c026d3] to-[#a21caf] shadow-fuchsia-500/20', title: 'SORTIR BATCH', desc: 'Scan Sortir Batch', bgImage: '/assets/sortirbatch-bg.webp' },
  'PACKING': { icon: Package, colorGradient: 'from-[#f97316] via-[#ea580c] to-[#c2410c] shadow-orange-500/20', title: 'PACKING', desc: 'Packing & Pengemasan', bgImage: '/assets/packing-bg.webp' },
  'PACKING_2': { icon: Package, colorGradient: 'from-[#f97316] via-[#ea580c] to-[#c2410c] shadow-orange-500/20', title: 'PACKING 2', desc: 'Packing & Pengemasan', bgImage: '/assets/packing-bg.webp' },
  'GUDANG': { icon: Warehouse, colorGradient: 'from-[#059669] via-[#059669] to-[#047857] shadow-emerald-500/20', title: 'GUDANG', desc: 'Manajemen Stok', bgImage: '/assets/gudang-bg.webp' },
  'OJOL': { icon: Bike, colorGradient: 'from-[#0891b2] via-[#0891b2] to-[#0e7490] shadow-cyan-500/20', title: 'OJOL', desc: 'Pengiriman Ojol', bgImage: '/assets/ojol-bg.webp' },
  'LEADER': { icon: Crown, colorGradient: 'from-[#6366f1] via-[#4f46e5] to-[#3730a3] shadow-indigo-500/20', title: 'LEADER', desc: 'Laporan & Monitoring', bgImage: '/assets/leader-bg.webp' },
  'CHECKER': { icon: User, colorGradient: 'from-[#0d9488] via-[#0d9488] to-[#0f766e] shadow-teal-500/20', title: 'CHECKER', desc: 'Verifikasi & Checker', bgImage: '/assets/checker-bg.webp' },
  'ADMIN': { icon: Monitor, colorGradient: 'from-[#db2777] via-[#db2777] to-[#be185d] shadow-pink-500/20', title: 'ADMIN', desc: 'Scan Admin', bgImage: '/assets/admin-bg.webp' },
};

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole, isDarkMode, toggleTheme, userEmail, onLogout, permissions, profileConfig = [] }) => {
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
    const isSuperUser = userEmail === 'developer@kalindo.com' || userEmail === 'dev@kalindo.com' || userEmail === 'jgilbeth92@gmail.com';

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
    if (email.toLowerCase().includes('jgilbeth') || email.toLowerCase().includes('johan')) return 'Johan G.';
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

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-gray-950 relative overflow-hidden transition-colors duration-500 ease-in-out select-none">

      {/* ================= TOP BLUE HERO SECTION ================= */}
      <div className="relative w-full bg-gradient-to-br from-[#1d63ed] via-[#2563eb] to-[#1e40af] text-white pt-6 pb-11 sm:pb-14 px-6 sm:px-8 shrink-0 overflow-hidden">
        
        {/* Background Responsive WebP Graphic - Full Width Left to Right */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-85 sm:opacity-95">
          <picture className="w-full h-full block">
            <source media="(max-width: 639px)" srcSet="/assets/dashboard-hero-mobile-internal.webp" type="image/webp" />
            <source media="(min-width: 640px)" srcSet="/assets/dashboard-hero-internal.webp" type="image/webp" />
            <img
              src="/assets/dashboard-hero-internal.webp"
              alt="Dashboard Warehouse Illustration"
              className="w-full h-full object-cover object-right"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
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
              className="w-9 h-9 rounded-full bg-blue-800/40 hover:bg-blue-800/60 backdrop-blur-md flex items-center justify-center text-white transition-all border border-blue-400/20 shadow-xs active:scale-95"
              title="Ganti Tema"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-9 h-9 rounded-full bg-white hover:bg-red-50 flex items-center justify-center text-red-500 transition-all shadow-md active:scale-95"
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
            <path d="M0,35 Q600,90 1200,35 L1200,120 L0,120 Z" className="fill-[#f8fafc] dark:fill-gray-950"></path>
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
                <h3 className="text-slate-900 dark:text-white font-extrabold text-sm sm:text-base leading-tight">System Ready</h3>
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

        {/* Error Toast Alert */}
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm animate-[toastSlide_0.4s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="bg-red-500 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-white/20 shadow-red-500/30">
              <AlertCircle size={20} className="shrink-0" />
              <span className="font-bold text-xs sm:text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Menu Section Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">Menu Utama</h2>
          <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-100/80 dark:border-blue-900/40 shadow-2xs">
            v2.3 Cloud
          </span>
        </div>

        {/* Role Cards List - Horizontal Design as requested */}
        <div className="flex flex-col gap-3.5 sm:gap-4 max-w-3xl mx-auto">
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
                  className={`relative w-full h-20 sm:h-22 bg-gradient-to-r ${config.colorGradient} rounded-3xl p-4 sm:p-5 text-left overflow-hidden group shadow-md hover:shadow-xl transition-all duration-300 active:scale-[0.98] flex items-center justify-between border border-white/10`}
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

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
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
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-all active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-2xl hover:bg-red-700 shadow-md shadow-red-500/20 text-sm transition-all active:scale-95"
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

