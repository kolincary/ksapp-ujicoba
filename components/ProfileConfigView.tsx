import React, { useState, useEffect } from 'react';
import { ProfileConfig } from '../types';
import { Save, ArrowUp, ArrowDown, Power, PowerOff } from 'lucide-react';

interface ProfileConfigViewProps {
  profileConfig?: ProfileConfig[];
  onSave?: (newConfig: ProfileConfig[]) => void;
  isDarkMode: boolean;
}

const ROLE_BG_MAP: Record<string, string> = {
  'PICKER': '/assets/picker-bg.webp',
  'PICKER_2': '/assets/picker-bg.webp',
  'SORTIR': '/assets/sortir-bg.webp',
  'SORTIR_BATCH': '/assets/sortir-bg.webp',
  'PACKING': '/assets/packing-bg.webp',
  'PACKING_2': '/assets/packing-bg.webp',
  'GUDANG': '/assets/gudang-bg.webp',
  'OJOL': '/assets/ojol-bg.webp',
  'LEADER': '/assets/leader-bg.webp',
  'CHECKER': '/assets/checker-bg.webp',
  'ADMIN': '/assets/admin-bg.webp',
};

export const ProfileConfigView: React.FC<ProfileConfigViewProps> = ({ profileConfig = [], onSave, isDarkMode }) => {
  const [localConfig, setLocalConfig] = useState<ProfileConfig[]>([]);

  useEffect(() => {
    // Sort correctly on initial load
    setLocalConfig([...profileConfig].sort((a, b) => a.sort_order - b.sort_order));
  }, [profileConfig]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newConfig = [...localConfig];
    const temp = newConfig[index - 1].sort_order;
    newConfig[index - 1].sort_order = newConfig[index].sort_order;
    newConfig[index].sort_order = temp;
    setLocalConfig(newConfig.sort((a, b) => a.sort_order - b.sort_order));
  };

  const moveDown = (index: number) => {
    if (index === localConfig.length - 1) return;
    const newConfig = [...localConfig];
    const temp = newConfig[index + 1].sort_order;
    newConfig[index + 1].sort_order = newConfig[index].sort_order;
    newConfig[index].sort_order = temp;
    setLocalConfig(newConfig.sort((a, b) => a.sort_order - b.sort_order));
  };

  const toggleActive = (index: number) => {
    const newConfig = [...localConfig];
    newConfig[index].is_active = !newConfig[index].is_active;
    setLocalConfig(newConfig);
  };

  const togglePageModal = (index: number) => {
    const newConfig = [...localConfig];
    newConfig[index].use_page_modal = newConfig[index].use_page_modal === false ? true : false;
    setLocalConfig(newConfig);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(localConfig);
      alert('Konfigurasi berhasil disimpan dan akan langsung diterapkan.');
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 flex flex-col p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-8 animate-[slideUp_0.3s_ease-out]">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Pengaturan Profil Aplikasi
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Atur urutan dan visibilitas setiap profil di menu utama. Perubahan akan tersimpan di cloud dan memengaruhi semua perangkat.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {localConfig.map((item, index) => {
              const bgUrl = ROLE_BG_MAP[item.role] || '/assets/picker-bg.webp';
              return (
                <li key={item.role} className={`p-4 flex items-center justify-between transition-colors relative overflow-hidden ${item.is_active ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-800/50 opacity-70'}`}>
                  {/* WebP Role Background Image */}
                  <div className="absolute inset-0 w-full h-full pointer-events-none opacity-20 dark:opacity-25 overflow-hidden">
                    <img
                      src={bgUrl}
                      alt={`${item.role} Background`}
                      className="w-full h-full object-cover object-center"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-800 dark:via-gray-800/80 pointer-events-none" />
                  </div>

                  <div className="flex items-center gap-4 relative z-10">
                  <span className="text-lg font-semibold text-gray-800 dark:text-white w-32">
                    {item.role.replace('_', ' ')}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {['PICKER', 'PICKER_2', 'SORTIR_BATCH', 'CHECKER', 'OJOL'].includes(item.role) && (
                     <button
                        onClick={() => togglePageModal(index)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${item.use_page_modal !== false ? 'border-indigo-200 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-900/50 dark:text-indigo-400' : 'border-gray-200 text-gray-500 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'}`}
                        title="Aktif/Nonaktifkan Modal Pemilihan Halaman Saat Scan"
                     >
                        MODAL: {item.use_page_modal !== false ? 'ON' : 'OFF'}
                     </button>
                  )}
                  <button
                    onClick={() => toggleActive(index)}
                    className={`p-2 rounded-lg border transition-colors ${item.is_active ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30' : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900/50 dark:text-green-400 dark:hover:bg-green-900/30'}`}
                    title={item.is_active ? "Matikan Profil" : "Aktifkan Profil"}
                  >
                    {item.is_active ? <PowerOff size={20} /> : <Power size={20} />}
                  </button>
                  <div className="flex flex-col gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === localConfig.length - 1}
                      className="p-1 rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-30"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          </ul>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 font-medium"
          >
            <Save size={20} />
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
};
