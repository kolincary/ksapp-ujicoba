import React, { useState, useEffect } from 'react';
import { ProfileConfig } from '../types';
import { 
  Save, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  Box, 
  Shuffle, 
  Package, 
  Warehouse, 
  Bike, 
  Crown, 
  UserCheck, 
  Shield, 
  Layers, 
  Zap, 
  SlidersHorizontal,
  Check,
  Power
} from 'lucide-react';

interface ProfileConfigViewProps {
  profileConfig?: ProfileConfig[];
  onSave?: (newConfig: ProfileConfig[]) => void;
  isDarkMode: boolean;
}

interface RoleMeta {
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  iconBg: string;
  borderColor: string;
}

const ROLE_METADATA: Record<string, RoleMeta> = {
  PICKER: { 
    label: 'PICKER', 
    desc: 'Pengambilan barang dari rak gudang', 
    icon: Box, 
    color: 'text-blue-600 dark:text-blue-400', 
    iconBg: 'bg-blue-50 dark:bg-blue-950/50', 
    borderColor: 'border-blue-100 dark:border-blue-900/40' 
  },
  PICKER_2: { 
    label: 'PICKER 2', 
    desc: 'Pengambilan barang modul sekunder', 
    icon: Box, 
    color: 'text-sky-600 dark:text-sky-400', 
    iconBg: 'bg-sky-50 dark:bg-sky-950/50', 
    borderColor: 'border-sky-100 dark:border-sky-900/40' 
  },
  SORTIR: { 
    label: 'SORTIR', 
    desc: 'Pemisahan zona dan alokasi ekspedisi', 
    icon: Shuffle, 
    color: 'text-purple-600 dark:text-purple-400', 
    iconBg: 'bg-purple-50 dark:bg-purple-950/50', 
    borderColor: 'border-purple-100 dark:border-purple-900/40' 
  },
  SORTIR_BATCH: { 
    label: 'SORTIR BATCH', 
    desc: 'Sortir paket berbasis kumpulan batch pesanan', 
    icon: Shuffle, 
    color: 'text-fuchsia-600 dark:text-fuchsia-400', 
    iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50', 
    borderColor: 'border-fuchsia-100 dark:border-fuchsia-900/40' 
  },
  CHECKER: { 
    label: 'CHECKER', 
    desc: 'Pemeriksaan fisik barang sebelum proses packing', 
    icon: UserCheck, 
    color: 'text-teal-600 dark:text-teal-400', 
    iconBg: 'bg-teal-50 dark:bg-teal-950/50', 
    borderColor: 'border-teal-100 dark:border-teal-900/40' 
  },
  PACKING: { 
    label: 'PACKING', 
    desc: 'Pengemasan final & penempelan label resi', 
    icon: Package, 
    color: 'text-orange-600 dark:text-orange-400', 
    iconBg: 'bg-orange-50 dark:bg-orange-950/50', 
    borderColor: 'border-orange-100 dark:border-orange-900/40' 
  },
  PACKING_2: { 
    label: 'PACKING 2', 
    desc: 'Meja kerja packing cadangan / tambahan', 
    icon: Package, 
    color: 'text-amber-600 dark:text-amber-400', 
    iconBg: 'bg-amber-50 dark:bg-amber-950/50', 
    borderColor: 'border-amber-100 dark:border-amber-900/40' 
  },
  GUDANG: { 
    label: 'GUDANG', 
    desc: 'Manajemen penerimaan & mutasi stok gudang', 
    icon: Warehouse, 
    color: 'text-emerald-600 dark:text-emerald-400', 
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50', 
    borderColor: 'border-emerald-100 dark:border-emerald-900/40' 
  },
  OJOL: { 
    label: 'OJOL', 
    desc: 'Serah terima kurir sameday / instan', 
    icon: Bike, 
    color: 'text-cyan-600 dark:text-cyan-400', 
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/50', 
    borderColor: 'border-cyan-100 dark:border-cyan-900/40' 
  },
  LEADER: { 
    label: 'LEADER', 
    desc: 'Monitoring laporan & produktivitas tim', 
    icon: Crown, 
    color: 'text-indigo-600 dark:text-indigo-400', 
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/50', 
    borderColor: 'border-indigo-100 dark:border-indigo-900/40' 
  },
  ADMIN: { 
    label: 'ADMIN', 
    desc: 'Hak akses penuh & konfigurasi sistem', 
    icon: Shield, 
    color: 'text-pink-600 dark:text-pink-400', 
    iconBg: 'bg-pink-50 dark:bg-pink-950/50', 
    borderColor: 'border-pink-100 dark:border-pink-900/40' 
  },
};

export const ProfileConfigView: React.FC<ProfileConfigViewProps> = ({ profileConfig = [], onSave, isDarkMode }) => {
  const [localConfig, setLocalConfig] = useState<ProfileConfig[]>([]);
  const [autoSaved, setAutoSaved] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  useEffect(() => {
    // Urutkan berdasarkan sort_order saat konfigurasi diterima
    setLocalConfig([...profileConfig].sort((a, b) => a.sort_order - b.sort_order));
  }, [profileConfig]);

  const notifySaved = (updated: ProfileConfig[]) => {
    if (onSave) {
      onSave(updated);
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 3000);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newConfig = [...localConfig];
    const temp = newConfig[index - 1].sort_order;
    newConfig[index - 1].sort_order = newConfig[index].sort_order;
    newConfig[index].sort_order = temp;
    const sorted = newConfig.sort((a, b) => a.sort_order - b.sort_order);
    setLocalConfig(sorted);
    notifySaved(sorted);
  };

  const moveDown = (index: number) => {
    if (index === localConfig.length - 1) return;
    const newConfig = [...localConfig];
    const temp = newConfig[index + 1].sort_order;
    newConfig[index + 1].sort_order = newConfig[index].sort_order;
    newConfig[index].sort_order = temp;
    const sorted = newConfig.sort((a, b) => a.sort_order - b.sort_order);
    setLocalConfig(sorted);
    notifySaved(sorted);
  };

  const toggleActive = (index: number) => {
    const newConfig = [...localConfig];
    newConfig[index].is_active = !newConfig[index].is_active;
    setLocalConfig(newConfig);
    notifySaved(newConfig);
  };

  const togglePageModal = (index: number) => {
    const newConfig = [...localConfig];
    newConfig[index].use_page_modal = newConfig[index].use_page_modal === false ? true : false;
    setLocalConfig(newConfig);
    notifySaved(newConfig);
  };

  const handleManualSave = () => {
    if (onSave) {
      onSave(localConfig);
      setManualSaved(true);
      setTimeout(() => setManualSaved(false), 2500);
    }
  };

  // Metrik Ringkasan
  const totalProfiles = localConfig.length;
  const activeCount = localConfig.filter(c => c.is_active).length;
  const inactiveCount = totalProfiles - activeCount;
  const checkerProfile = localConfig.find(c => c.role === 'CHECKER');
  const isCheckerActive = checkerProfile ? checkerProfile.is_active !== false : true;

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-gray-950 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6 animate-[fadeIn_0.25s_ease-out]">
        
        {/* ================= HEADER SECTION WITH TOP SAVE BUTTON ================= */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-[11px] font-bold text-blue-700 dark:text-blue-300">
              <SlidersHorizontal size={12} />
              <span>Sistem Profil & Alur Kerja</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Pengaturan Profil Aplikasi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 max-w-xl leading-relaxed">
              Atur urutan tampilan menu, visibilitas profil, serta opsi popup modal. Perubahan langsung disinkronkan ke seluruh perangkat operasional.
            </p>
          </div>

          {/* Action Area: Status & Save Button */}
          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            {autoSaved && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl animate-[fadeIn_0.2s_ease-out]">
                <CheckCircle2 size={15} className="text-emerald-500 animate-pulse" />
                <span>Tersimpan Otomatis</span>
              </div>
            )}

            <button
              onClick={handleManualSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 ${
                manualSaved
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:shadow-md'
              }`}
            >
              {manualSaved ? (
                <>
                  <Check size={18} className="stroke-[3]" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Simpan Pengaturan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ================= SUMMARY METRIC CARDS ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200/80 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block">
              Total Profil
            </span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-0.5 block">
              {totalProfiles}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200/80 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Profil Aktif
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {activeCount}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200/80 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block">
              Nonaktif
            </span>
            <span className="text-2xl font-black text-slate-500 dark:text-gray-400 mt-0.5 block">
              {inactiveCount}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200/80 dark:border-gray-800 shadow-2xs">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Mode Validasi
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${isCheckerActive ? 'bg-teal-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-xs font-bold text-slate-700 dark:text-gray-200 truncate">
                {isCheckerActive ? 'Standar (Checker)' : 'Mode Cepat (Picker)'}
              </span>
            </div>
          </div>
        </div>

        {/* ================= PROFILE LIST CARDS ================= */}
        <div className="space-y-3">
          {localConfig.map((item, index) => {
            const meta = ROLE_METADATA[item.role] || {
              label: item.role.replace('_', ' '),
              desc: 'Modul sistem operasional',
              icon: Box,
              color: 'text-slate-600 dark:text-slate-400',
              iconBg: 'bg-slate-100 dark:bg-gray-800',
              borderColor: 'border-slate-200 dark:border-gray-700'
            };
            const IconComponent = meta.icon;
            const supportsPageModal = ['PICKER', 'PICKER_2', 'SORTIR_BATCH', 'CHECKER', 'OJOL'].includes(item.role);
            const isChecker = item.role === 'CHECKER';

            return (
              <div
                key={item.role}
                className={`group rounded-2xl border transition-all duration-200 overflow-hidden ${
                  item.is_active
                    ? 'bg-white dark:bg-gray-900 border-slate-200/90 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900/50 shadow-xs hover:shadow-sm'
                    : 'bg-slate-100/70 dark:bg-gray-900/40 border-slate-200/50 dark:border-gray-800/50 opacity-75'
                }`}
              >
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  
                  {/* Left: Reorder & Role Details */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    
                    {/* Urutan & Reorder Controls */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0 bg-slate-50 dark:bg-gray-800/80 rounded-xl p-1 border border-slate-200/60 dark:border-gray-700/60">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        title="Geser ke Atas"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all cursor-pointer"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <span className="text-[10px] font-black text-slate-600 dark:text-gray-400 px-1 select-none">
                        #{index + 1}
                      </span>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === localConfig.length - 1}
                        title="Geser ke Bawah"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all cursor-pointer"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    {/* Role Icon */}
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${meta.iconBg} ${meta.borderColor} ${meta.color}`}>
                      <IconComponent size={22} />
                    </div>

                    {/* Title & Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {meta.label}
                        </h2>

                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {item.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>

                        {/* Special Tag for Checker Fast Mode */}
                        {isChecker && !item.is_active && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            <Zap size={12} className="text-amber-500" />
                            <span>Mode Cepat (Packing langsung dari Picker)</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-0.5">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions & Switches */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-gray-800 shrink-0">
                    
                    {/* Modal Page Picker Toggle Button */}
                    {supportsPageModal && (
                      <button
                        onClick={() => togglePageModal(index)}
                        title="Tampilkan popup pilihan halaman (Page Modal) saat proses scan berlangsung"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          item.use_page_modal !== false
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                            : 'bg-slate-50 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-750'
                        }`}
                      >
                        <Layers size={13} />
                        <span>Modal: {item.use_page_modal !== false ? 'ON' : 'OFF'}</span>
                      </button>
                    )}

                    {/* Modern Toggle Switch for Active / Inactive */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-gray-500 hidden sm:inline">
                        {item.is_active ? 'ON' : 'OFF'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleActive(index)}
                        role="switch"
                        aria-checked={item.is_active}
                        title={item.is_active ? `Matikan profil ${meta.label}` : `Aktifkan profil ${meta.label}`}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          item.is_active ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-slate-300 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            item.is_active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= BOTTOM FOOTER INFO ================= */}
        <div className="pt-4 pb-12 text-center border-t border-slate-200/60 dark:border-gray-800/80">
          <p className="text-xs text-slate-400 dark:text-gray-500">
            Semua perubahan otomatis tersimpan langsung ke database cloud Firestore & Supabase.
          </p>
        </div>

      </div>
    </div>
  );
};
