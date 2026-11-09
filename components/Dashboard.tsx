
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { UserRole, ScannedItem, FailedItem } from '../types';
import { ScanLine, Loader2, Settings, Search, Zap, CheckCircle2, Clock, Package, Monitor, User, AlertCircle, Menu, History, FileText, ArrowRight, X, ListOrdered, ArrowLeft, Wifi, WifiOff, CloudOff, CloudCog, Lock, Target, ChevronDown, ChevronUp, Calendar, AlertTriangle, RefreshCw, CheckSquare, Square, Trash2, ChevronRight, XCircle, Layers, Check, Save, Star, ShieldCheck, Truck, AlertOctagon } from 'lucide-react';
import { ScannerModal } from './ScannerModal';
import { SettingsModal } from './SettingsModal';
import { RunningTextBanner } from './RunningTextBanner';
import { supabase, supabaseNew, supabaseLeader } from '../services/supabaseClient';
import { supabaseBundling } from '../services/supabaseBundlingClient';
import { PinModal } from './PinModal';
import { getActiveLoginTheme, LoginThemeVariant } from '../services/themeSyncService';
import { 
  replicateBackupInsert, 
  replicateBackupUpsert, 
  replicateBackupUpdate, 
  replicateBackupDelete,
  syncBackupConfigFromCloud 
} from '../services/dualSupabaseService';

import { Users, UserPlus, Shield } from 'lucide-react';

interface DashboardProps {
   role: UserRole;
   onBack: () => void;
   userEmail: string;
   userPin: string;
   employeeName: string;
   dailyTarget?: number;
   isDarkMode: boolean;
   toggleTheme: () => void;
   scanButtonPosition?: 'left' | 'center' | 'right';
   setScanButtonPosition?: (pos: 'left' | 'center' | 'right') => void;
   allowManualInput: boolean;
   profileConfig?: any[]; // Using any[] to avoid strict import issues if not exported
}

// Expanded Views to support History per section AND Failed History
type DashboardView = 'SCAN' | 'SCAN_HISTORY' | 'SCAN_2' | 'SCAN_2_HISTORY' | 'PENDING' | 'PENDING_HISTORY' | 'READY' | 'READY_HISTORY' | 'CANCEL' | 'CANCEL_HISTORY' | 'REPORT' | 'REPORT_HISTORY' | 'HISTORY' | 'FAILED_HISTORY' | 'BUNDLING' | 'BUNDLING_HISTORY' | 'LEADER_DASHBOARD' | 'LEADER_GLOBAL' | 'LEADER_ORDERS' | 'LEADER_SUMMARY' | 'LEADER_PENDING' | 'LEADER_PENDING_HISTORY' | 'SPECIAL_SCAN';

// Leader Profile Constants
const LEADER_PROFILES = ['RICKY', 'AKMAL'] as const;
type LeaderProfile = typeof LEADER_PROFILES[number];
const STORAGE_KEY_LEADER_PROFILE = 'kalindo_leader_profile';
const STORAGE_KEY_LEADER_PROFILE_DATE = 'kalindo_leader_profile_date';

// Role Background WebP Assets
const ROLE_BG_IMAGES: Record<string, string> = {
   [UserRole.PICKER]: '/assets/picker-bg.webp',
   [UserRole.PICKER_2]: '/assets/picker-bg.webp',
   [UserRole.SORTIR]: '/assets/sortir-bg.webp',
   [UserRole.SORTIR_BATCH]: '/assets/sortir-bg.webp',
   [UserRole.PACKING]: '/assets/packing-bg.webp',
   [UserRole.PACKING_2]: '/assets/packing-bg.webp',
   [UserRole.GUDANG]: '/assets/gudang-bg.webp',
   [UserRole.OJOL]: '/assets/ojol-bg.webp',
   [UserRole.LEADER]: '/assets/leader-bg.webp',
   [UserRole.CHECKER]: '/assets/checker-bg.webp',
   [UserRole.ADMIN]: '/assets/admin-bg.webp',
};

// Scan Type Constants (Pretelan vs Satuan)
const generateUniqueScanId = () => (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9)).padEnd(15, '0');
type LeaderScanType = 'PRETELAN' | 'SATUAN';
const STORAGE_KEY_LEADER_SCAN_TYPE = 'kalindo_leader_scan_type';

// Local Storage Keys
const STORAGE_KEY_CONTINUOUS_SCAN = 'kalindo_continuous_scan';
const STORAGE_KEY_SOUND_SUCCESS = 'kalindo_sound_success';
const STORAGE_KEY_SOUND_ERROR = 'kalindo_sound_error';
const STORAGE_KEY_VIBRATION = 'kalindo_vibration';
const STORAGE_KEY_SCAN_SPEED = 'kalindo_scan_speed';

// --- SOUND ASSETS LIBRARY ---
export const SOUND_LIBRARY = {
   SUCCESS: {
      'DEFAULT': { label: 'Default', url: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3' },
      'BEEP': { label: 'Classic Beep', url: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3' },
      'BEEP2': { label: 'Beep 2', url: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3' },
      'BEEP3': { label: 'Beep 3', url: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3' },
      'MAGIC': { label: 'Magic Chime', url: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3' }, // NEW
      'COIN': { label: 'Coin Collect', url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' }, // NEW
   },
   ERROR: {
      'DEFAULT': { label: 'Default', url: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3' },
      'NOTNOT': { label: 'Not Not', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
      'KNOCK': { label: 'Knock', url: 'https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3' },
      'DOWN': { label: 'System Down', url: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3' },
      'BUZZER': { label: 'Buzzer', url: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3' }, // NEW
      'GLITCH': { label: 'Glitch Error', url: 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3' }, // NEW
   }
};

export const getBarcodeCandidates = (raw: string): string[] => {
   let clean = (raw || '').trim().toUpperCase();
   if (!clean) return [];

   const candidates = new Set<string>();
   candidates.add(clean);

   // 1. Without hyphens / spaces / punctuation
   const unhyphenated = clean.replace(/[^A-Z0-9]/g, '');
   if (unhyphenated) candidates.add(unhyphenated);

   // 2. Known prefixes with hyphen vs without hyphen (LXAD, JNAP, JNEB)
   for (const p of ['LXAD', 'JNAP', 'JNEB']) {
      if (clean.startsWith(p)) {
         const rest = clean.slice(p.length).replace(/^-+/, '');
         if (rest.length > 0) {
            candidates.add(`${p}-${rest}`);
            candidates.add(`${p}${rest}`);
         }
      }
   }

   // 3. Leading zero padding variations (e.g. SiCepat 10-digit vs 12-digit with 00)
   if (/^\d{10}$/.test(clean)) {
      candidates.add('00' + clean);
   } else if (/^00\d{10}$/.test(clean)) {
      candidates.add(clean.slice(2));
   }

   return Array.from(candidates).filter(Boolean);
};


// --- TEMA 2 ASSETS ---
const MarkTema2 = ({ size = 34 }: { size?: number }) => (
  <div
    className="grid place-items-center rounded-xl bg-[#F2B705] text-[#16191D] shadow-sm shrink-0"
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
        <pattern id="pk_dash_bc" width="9" height="1" patternUnits="userSpaceOnUse">
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

      {/* Label Barcode */}
      <g transform="matrix(1 -0.507 0 1 260 276)">
        <rect x="9" y="46" width="57" height="48" rx="3" fill="#fff" />
        <rect x="14" y="54" width="47" height="22" fill="url(#pk_dash_bc)" />
        <rect x="14" y="82" width="47" height="3" rx="1.5" fill="#B9B2A0" />
        <rect x="6" y="52" width="63" height="3" rx="1.5" fill="#F2B705" />
      </g>

      {/* Pemindai Genggam */}
      <polygon points="350,116 268,322 328,336" fill="#F2B705" opacity=".16" />
      <g transform="translate(332 96) rotate(-24)">
        <rect width="84" height="34" rx="10" fill="#1F2A3D" />
        <rect x="8" y="8" width="16" height="18" rx="4" fill="#F2B705" />
        <rect x="44" y="26" width="26" height="70" rx="10" fill="#2A3A55" />
      </g>
    </svg>
  );
}


// --- MEMOIZED COMPONENTS ---

const ScanCard = React.memo(({ item, theme, index, onClick, isActuallyCancelled, role }: { item: ScannedItem, theme: any, index: number, onClick?: () => void, isActuallyCancelled?: boolean, role?: string }) => {
   const isSortir = role === 'SORTIR';
   const isCancel = isSortir && (isActuallyCancelled || item.description?.toUpperCase().includes('[CANCEL]') || (item.priority === 'HIGH'));

   return (
      <div
         onClick={onClick}
         className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group animate-[slideDown_0.3s_ease-out] ${onClick ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all' : ''} ${isCancel ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : ''}`}
         style={{ animationDelay: `${index * 0.05}s` }}
      >
         {/* Priority Indicator */}
         <div className={`absolute top-0 right-0 w-1.5 h-full ${isCancel ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : (item.priority === 'HIGH' ? 'bg-orange-500' : (item.priority === 'LOW' ? 'bg-blue-400' : 'bg-green-500'))}`} />

         {isCancel && (
            <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-br-xl shadow-md z-20 animate-pulse">
               CANCEL ORDER
            </div>
         )}

         <div className="flex justify-between items-start mb-2 relative z-10">
            <div className={isCancel ? 'mt-4' : ''}>
               <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-lg text-gray-800 dark:text-gray-200 tracking-tight select-all cursor-copy" title="Salin Barcode/Resi">
                     {item.barcode}
                  </span>
                  {item.order_id && (
                     <span className="font-mono font-semibold text-sm text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 tracking-tight select-all cursor-copy" title="Salin ID Pesanan">
                        {item.order_id}
                     </span>
                  )}
               </div>
               <p className="text-xs text-gray-400 font-medium">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {item.destination && <span className="mx-1">• {item.destination}</span>}
               </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.priority === 'HIGH' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
               }`}>
               {item.priority === 'HIGH' ? <Zap size={16} fill="currentColor" /> : <CheckCircle2 size={16} />}
            </div>
         </div>

         <div className="relative z-10">
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
               {item.description || 'No description'}
            </p>
            {item.excel_filename && (
               <p className="mt-1 text-xs font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded w-fit">
                  File: {item.excel_filename}
               </p>
            )}
         </div>

         {item.employee_name && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
               <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500 font-bold">
                  {item.employee_name.charAt(0)}
               </div>
               <span className="text-xs text-gray-400">{item.employee_name}</span>
               <div className="ml-auto flex items-center gap-1.5">
                  {isCancel && (
                     <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        CANCEL
                     </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                     }`}>
                     {item.status}
                  </span>
               </div>
            </div>
         )}
      </div>
   );
});


// --- MAIN COMPONENT ---

export const Dashboard: React.FC<DashboardProps> = ({
   role,
   onBack,
   userEmail,
   userPin,
   employeeName,
   dailyTarget = 0,
   isDarkMode,
   toggleTheme,
   scanButtonPosition = 'right',
   setScanButtonPosition,
   allowManualInput,
   profileConfig = []
}) => {
   const [items, setItems] = useState<ScannedItem[]>([]);
   const [failedItems, setFailedItems] = useState<FailedItem[]>([]); // New State for Failed Scans
   const [isCameraOpen, setIsCameraOpen] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   const [manualInput, setManualInput] = useState('');
   const [isManualSubmitting, setIsManualSubmitting] = useState(false);
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [devMode, setDevMode] = useState(false);
   const [activeLoginTheme, setActiveLoginTheme] = useState<LoginThemeVariant>(() => getActiveLoginTheme());

   useEffect(() => {
      const handleThemeChange = () => {
         setActiveLoginTheme(getActiveLoginTheme());
      };
      window.addEventListener('storage', handleThemeChange);
      window.addEventListener('kalindo_theme_changed', handleThemeChange);
      return () => {
         window.removeEventListener('storage', handleThemeChange);
         window.removeEventListener('kalindo_theme_changed', handleThemeChange);
      };
   }, []);

   const isTema2 = activeLoginTheme === 'tema_2';

   // Settings States
   const [isSoundEnabled, setIsSoundEnabled] = useState(true);
   const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);
   const [scanSpeed, setScanSpeed] = useState<'SLOW' | 'NORMAL' | 'FAST' | 'TURBO'>('NORMAL');
   const [skipCheckerDuplicate, setSkipCheckerDuplicate] = useState(false);
   const [strictResiMode, setStrictResiMode] = useState<boolean>(() => {
      const saved = localStorage.getItem('kalindo_strict_resi_mode');
      return saved !== null ? saved === 'true' : true; // Default true agar selalu aman & ketat sejak awal buka web
   });

   // Realtime Active Profile Config (to detect whether CHECKER is active or disabled)
   const [activeProfilesConfig, setActiveProfilesConfig] = useState<any[]>(() => {
      if (profileConfig && profileConfig.length > 0) return profileConfig;
      try {
         const cached = localStorage.getItem('kalindo_profile_config');
         return cached ? JSON.parse(cached) : [];
      } catch (e) {
         return [];
      }
   });

   useEffect(() => {
      if (profileConfig && profileConfig.length > 0) {
         setActiveProfilesConfig(profileConfig);
      }
   }, [profileConfig]);

   // Helper: Cek apakah profil CHECKER sedang aktif atau dinonaktifkan di Pengaturan Profil
   const isCheckerProfileActive = useCallback(() => {
      let cfg = activeProfilesConfig && activeProfilesConfig.length > 0 ? activeProfilesConfig : null;
      if (!cfg && profileConfig && profileConfig.length > 0) cfg = profileConfig;
      if (!cfg) {
         try {
            const cached = localStorage.getItem('kalindo_profile_config');
            if (cached) cfg = JSON.parse(cached);
         } catch (e) {}
      }
      if (!cfg || !Array.isArray(cfg)) return true;
      const checker = cfg.find((p: any) => p.role === UserRole.CHECKER || p.role === 'CHECKER');
      return checker ? checker.is_active !== false : true;
   }, [activeProfilesConfig, profileConfig]);

   useEffect(() => {
      const fetchGlobalSettings = async () => {
         try {
            // Sinkronisasi kredensial Supabase Cadangan terbaru dari Supabase VPS (app_settings)
            syncBackupConfigFromCloud().catch(() => {});

            const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (!error && data) {
               setSkipCheckerDuplicate(!!data.skip_duplicate_checker);
               if (data.strict_resi_mode !== undefined && data.strict_resi_mode !== null) {
                  const isStrict = !!data.strict_resi_mode;
                  setStrictResiMode(isStrict);
                  localStorage.setItem('kalindo_strict_resi_mode', String(isStrict));
               }
            }
         } catch (err) {
            console.error("Error fetching global settings:", err);
         }
      };
      fetchGlobalSettings();

      // Interval otomatis periksa pembaruan setting Supabase Cadangan setiap 3 menit
      const backupSyncInterval = setInterval(() => {
         syncBackupConfigFromCloud().catch(() => {});
      }, 180000);

      // Sync Profiles Config in realtime
      const fetchProfilesConfig = async () => {
         try {
            const { data } = await supabase.from('app_profiles_config').select('*').order('sort_order');
            if (data && data.length > 0) {
               setActiveProfilesConfig(data);
               localStorage.setItem('kalindo_profile_config', JSON.stringify(data));
            }
         } catch (e) {}
      };
      fetchProfilesConfig();

      // Listen to profile config updates from localStorage or cross-tab/modal
      const handleProfileConfigUpdate = (e: any) => {
         if (e?.detail && Array.isArray(e.detail)) {
            setActiveProfilesConfig(e.detail);
         } else {
            try {
               const cached = localStorage.getItem('kalindo_profile_config');
               if (cached) setActiveProfilesConfig(JSON.parse(cached));
            } catch (err) {}
         }
      };
      window.addEventListener('kalindo_profile_config_updated', handleProfileConfigUpdate);
      window.addEventListener('storage', handleProfileConfigUpdate);

      // Subscribe realtime Supabase for app_profiles_config
      const channelProfiles = supabase
         .channel('realtime_profiles_config')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'app_profiles_config' }, () => {
            fetchProfilesConfig();
         })
         .subscribe();

      const channel = supabase
         .channel('dashboard_app_settings_changes')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
            // Sinkronkan Supabase Cadangan secara instan via realtime jika diubah Admin
            syncBackupConfigFromCloud().catch(() => {});
            if (payload.new) {
               setSkipCheckerDuplicate(!!payload.new.skip_duplicate_checker);
               if (payload.new.strict_resi_mode !== undefined && payload.new.strict_resi_mode !== null) {
                  const isStrict = !!payload.new.strict_resi_mode;
                  setStrictResiMode(isStrict);
                  localStorage.setItem('kalindo_strict_resi_mode', String(isStrict));
               }
            }
         })
         .subscribe();

      return () => {
         clearInterval(backupSyncInterval);
         supabase.removeChannel(channel);
         supabase.removeChannel(channelProfiles);
         window.removeEventListener('kalindo_profile_config_updated', handleProfileConfigUpdate);
         window.removeEventListener('storage', handleProfileConfigUpdate);
      };
   }, []);

   // Alert States
   const [errorToast, setErrorToast] = useState<string | null>(null); // For Duplicates/Forbidden
   const [successToast, setSuccessToast] = useState<string | null>(null); // For general success messages

   // VIBRATION TESTER
   const triggerTestVibration = () => {
      if (navigator.vibrate) {
         const success = navigator.vibrate([200]);
         if (success) {
            // alert("Vibration command sent!"); // Debug only
         } else {
            alert("Vibration failed or not supported/allowed.");
         }
      } else {
         alert("Vibration API not supported on this device.");
      }
   };

   const handleModeToggle = (targetMode: 'INDIVIDU' | 'TIM') => {
      if (targetMode === scanMode) return;

      if (targetMode === 'TIM') {
         setPendingModeChange('TIM');
         setIsModePinModalOpen(true);
      } else {
         // Add PIN confirmation for switching back to INDIVIDU to prevent accidental clicks
         setPendingModeChange('INDIVIDU');
         setIsModePinModalOpen(true);
      }
   };

   const handleModePinSuccess = () => {
      if (pendingModeChange) {
         setScanMode(pendingModeChange);
         setPendingModeChange(null);
      }
      setIsModePinModalOpen(false);
   };

   const toggleTeamMember = (name: string) => {
      setTeamMembers(prev =>
         prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
   };

   const [criticalNetworkError, setCriticalNetworkError] = useState<string | null>(null); // For NETWORK ONLY (Full Screen)
   const [consolidatedAlerts, setConsolidatedAlerts] = useState<string[]>([]); // New for bulk alerts

   // BUNDLING CONTEXT
   const BUNDLING_CONTEXT = 'BUNDLING';
   const REPORT_CONTEXT = 'REPORT'; // Assuming existing logic uses this or description tags


   // Sound Selection State (Default Updated)
   const [successSoundKey, setSuccessSoundKey] = useState<string>('BEEP2');
   const [errorSoundKey, setErrorSoundKey] = useState<string>('DOWN');

   // Continuous Scan State
   const [isContinuousScan, setIsContinuousScan] = useState(false);
   const [recentScans, setRecentScans] = useState<{ id: number, code: string, status: 'success' | 'error' | 'loading', message?: string }[]>([]);
   const lastScannedRef = useRef<{ code: string, timestamp: number } | null>(null);
   const [cameraToast, setCameraToast] = useState<{ message: string, type: 'error' | 'success' } | null>(null);

   // Network & Sync State
   const [isOnline, setIsOnline] = useState(navigator.onLine);
   
   // --- GUDANG REPORT MODAL STATE ---
   const [pendingReportScan, setPendingReportScan] = useState<string | null>(null);
   const [reportKeterangan, setReportKeterangan] = useState('');
   const [reportNamaBarang, setReportNamaBarang] = useState('');
   const [reportQty, setReportQty] = useState('');
   const [skuOptions, setSkuOptions] = useState<string[]>([]);
   const [isFetchingSkus, setIsFetchingSkus] = useState(false);
   const [showSkuDropdown, setShowSkuDropdown] = useState(false);
   const [showKeteranganDropdown, setShowKeteranganDropdown] = useState(false);

   // Removed isSyncing since we are strict online now
   const [forbiddenSymbols, setForbiddenSymbols] = useState<string[]>([]);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const VIEW_STORAGE_KEY = `kalindo_current_view_${role}`;
   const [currentView, setCurrentView] = useState<DashboardView>(() => {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved) return saved as DashboardView;
      return role === UserRole.GUDANG ? 'PENDING' : (role === UserRole.LEADER ? 'LEADER_DASHBOARD' : 'SCAN');
   });

   useEffect(() => {
      if (pendingReportScan && skuOptions.length === 0 && !isFetchingSkus) {
         const fetchSkus = async () => {
            setIsFetchingSkus(true);
            try {
               const { data, error } = await supabase
                  .from('sku_data')
                  .select('sku')
                  .order('sku', { ascending: true });
               if (!error && data) {
                  const skus = data.map((d: any) => d.sku as string).filter(Boolean);
                  setSkuOptions(skus);
               }
            } catch (err) {
               console.error("Failed to fetch SKUs from Supabase VPS", err);
            } finally {
               setIsFetchingSkus(false);
            }
         };
         fetchSkus();
      }
   }, [pendingReportScan, skuOptions.length, isFetchingSkus]);

   useEffect(() => {
      localStorage.setItem(VIEW_STORAGE_KEY, currentView);
   }, [currentView, VIEW_STORAGE_KEY]);
   const [listSearchTerm, setListSearchTerm] = useState('');
   const [scanListPage, setScanListPage] = useState(1);
   const ITEMS_PER_PAGE = 100;
   const [teamSearchTerm, setTeamSearchTerm] = useState('');
   const [isSearchFocused, setIsSearchFocused] = useState(false);
   const [expandedDates, setExpandedDates] = useState<string[]>([]);
   const listEndRef = useRef<HTMLDivElement>(null);

   // State to force refresh at midnight
   const [todayDateIdentifier, setTodayDateIdentifier] = useState(new Date().toDateString());

   // Failed History Selection State
   const [selectedFailedIds, setSelectedFailedIds] = useState<string[]>([]);
   const [isResending, setIsResending] = useState(false);

   // PICKER Page Selection Modal State (Modal Konfirmasi Scan)
   const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
   const [pendingPickerScan, setPendingPickerScan] = useState<{
      barcode: string;
      description: string;
      destination: string;
      priority: 'HIGH' | 'NORMAL' | 'LOW';
      tempId?: number;
      order_id?: string;
   } | null>(null);
   const [selectedPage, setSelectedPage] = useState<number>(1);
   // Fullscreen Page Picker (Mobile only)
   const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
   // Desktop Page Dropdown
   const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false);
   const [pageSearchTerm, setPageSearchTerm] = useState('');

   // Cancel Data Warning State
   const [cancelledBarcodes, setCancelledBarcodes] = useState<string[]>([]);
   const [showCancelWarning, setShowCancelWarning] = useState(false);
   const [pendingCancelScan, setPendingCancelScan] = useState<{
      item: ScannedItem;
      tempId?: number;
      updateContinuousStatus: (status: 'error' | 'success', msg?: string) => void;
      recordFail: (reason: 'DUPLICATE' | 'FORBIDDEN' | 'NETWORK' | 'OTHER', msg: string) => Promise<void>;
   } | null>(null);

   const [showOnlyCancel, setShowOnlyCancel] = useState(false);

   // SORTIR Mode & Team State
   const [scanMode, setScanMode] = useState<'INDIVIDU' | 'TIM'>(() => {
      const savedDate = localStorage.getItem('kalindo_sortir_team_date');
      const today = new Date().toDateString();
      if (savedDate && savedDate !== today) {
         return 'INDIVIDU';
      }
      const saved = localStorage.getItem('kalindo_sortir_mode');
      return (saved === 'TIM' ? 'TIM' : 'INDIVIDU') as 'INDIVIDU' | 'TIM';
   });
   const [teamMembers, setTeamMembers] = useState<string[]>(() => {
      const savedDate = localStorage.getItem('kalindo_sortir_team_date');
      const today = new Date().toDateString();
      if (savedDate && savedDate !== today) {
         return [];
      }
      const saved = localStorage.getItem('kalindo_sortir_team');
      return saved ? JSON.parse(saved) : [];
   });
   const [isModePinModalOpen, setIsModePinModalOpen] = useState(false);
   const [pendingModeChange, setPendingModeChange] = useState<'INDIVIDU' | 'TIM' | null>(null);
   const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false);
   const [employees, setEmployees] = useState<{ id: number, name: string, shift: string, allowed_roles?: string }[]>([]);

   // LEADER SCAN 2 ASSIGNMENT STATE
   const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
   const [pendingAssignmentBarcode, setPendingAssignmentBarcode] = useState('');
   const [assignmentMode, setAssignmentMode] = useState<'INDIVIDU' | 'TIM'>('INDIVIDU');
   const [assignmentPicker, setAssignmentPicker] = useState<string>('');
   const [assignmentTeam, setAssignmentTeam] = useState<string[]>([]);
   const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
   const [leaderDashboardSearch, setLeaderDashboardSearch] = useState('');
   const [isAssigning, setIsAssigning] = useState(false);
   const [pickersList, setPickersList] = useState<{ id: number, name: string, shift: string }[]>([]);
   const [expandedPicker, setExpandedPicker] = useState<string | null>(null);
   const [isDeletePinModalOpen, setIsDeletePinModalOpen] = useState(false);
   const [pendingDeleteBarcode, setPendingDeleteBarcode] = useState<string | null>(null);
   const [isDeleting, setIsDeleting] = useState(false);

   // LEADER SCAN 2 SWITCH TYPE STATE
   const [isSwitchPinModalOpen, setIsSwitchPinModalOpen] = useState(false);
   const [pendingSwitchBarcode, setPendingSwitchBarcode] = useState<string | null>(null);
   const [isSwitchingType, setIsSwitchingType] = useState(false);

   // LEADER PROFILE SELECTION STATE
   const [selectedLeaderProfile, setSelectedLeaderProfile] = useState<LeaderProfile | null>(() => {
      const savedDate = localStorage.getItem(STORAGE_KEY_LEADER_PROFILE_DATE);
      const today = new Date().toDateString();
      if (savedDate && savedDate === today) {
         const saved = localStorage.getItem(STORAGE_KEY_LEADER_PROFILE);
         if (saved === 'RICKY' || saved === 'AKMAL') return saved;
      }
      return null;
   });
   const [showLeaderProfileModal, setShowLeaderProfileModal] = useState(false);

   // LEADER SCAN TYPE STATE (Pretelan vs Satuan)
   const [leaderScanType, setLeaderScanType] = useState<LeaderScanType>(() => {
      const saved = localStorage.getItem(STORAGE_KEY_LEADER_SCAN_TYPE);
      return (saved === 'SATUAN' ? 'SATUAN' : 'PRETELAN') as LeaderScanType;
   });

   // SORTIR: Move Cancel to History State
   const [isMoveCancelModalOpen, setIsMoveCancelModalOpen] = useState(false);
   const [pendingMoveCancelItem, setPendingMoveCancelItem] = useState<ScannedItem | null>(null);
   const [isMovingCancel, setIsMovingCancel] = useState(false);

   // LEADER ORDERS VIEW STATE
   const [leaderOrdersFilter, setLeaderOrdersFilter] = useState<'RICKY' | 'AKMAL'>(() => {
      const savedDate = localStorage.getItem(STORAGE_KEY_LEADER_PROFILE_DATE);
      const today = new Date().toDateString();
      if (savedDate && savedDate === today) {
         const saved = localStorage.getItem(STORAGE_KEY_LEADER_PROFILE);
         if (saved === 'AKMAL') return 'AKMAL';
      }
      return 'RICKY';
   });
   const [leaderOrdersTypeFilter, setLeaderOrdersTypeFilter] = useState<'PRETELAN' | 'SATUAN'>('PRETELAN');
   const [leaderOrdersData, setLeaderOrdersData] = useState<any[]>([]);
   const [leaderOrdersSearch, setLeaderOrdersSearch] = useState('');
   const [leaderOrdersTimeFilter, setLeaderOrdersTimeFilter] = useState('');
   const [leaderOrdersDate, setLeaderOrdersDate] = useState<string>(() => {
      // FIX: Get LOCAL date in YYYY-MM-DD format (prevents UTC date lag)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
   });
   const dateInputRef = useRef<HTMLInputElement>(null);

   // AUTO-PAUSE & WAJIB ACKNOWLEDGE STATE (UNTUK CHECKER & PACKING)
   const [sequenceAlertModal, setSequenceAlertModal] = useState<{
      barcode: string;
      role: UserRole;
      targetRole: string;
      message: string;
   } | null>(null);
   const hasActiveSequenceAlertRef = useRef(false);
   const ignoredCooldownRef = useRef<{ code: string; until: number } | null>(null);

   const handleAcknowledgeSequenceAlert = () => {
      if (!sequenceAlertModal) return;
      const ackBarcode = sequenceAlertModal.barcode;
      // Cooldown 4 detik untuk barcode ini agar saat staf memindahkan paket tidak kena scan ulang
      ignoredCooldownRef.current = {
         code: ackBarcode,
         until: Date.now() + 4000
      };
      if (lastScannedRef.current) {
         lastScannedRef.current = { code: ackBarcode, timestamp: Date.now() + 4000 };
      }
      hasActiveSequenceAlertRef.current = false;
      setSequenceAlertModal(null);
      // Jika di single scan mode, kamera ditutup setelah acknowledge
      if (!isContinuousScan) {
         setIsCameraOpen(false);
      }
   };

   // Listen for keyboard Enter / Space / Escape to acknowledge modal
   useEffect(() => {
      if (!sequenceAlertModal) return;
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            handleAcknowledgeSequenceAlert();
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [sequenceAlertModal, isContinuousScan]);

   // Sync order filter with global selected leader profile
   useEffect(() => {
      if (selectedLeaderProfile === 'RICKY' || selectedLeaderProfile === 'AKMAL') {
         setLeaderOrdersFilter(selectedLeaderProfile);
      }
   }, [selectedLeaderProfile]);

   // Persist Sortir Mode
   useEffect(() => {
      localStorage.setItem('kalindo_sortir_mode', scanMode);
   }, [scanMode]);

   useEffect(() => {
      localStorage.setItem('kalindo_sortir_team', JSON.stringify(teamMembers));
      localStorage.setItem('kalindo_sortir_team_date', new Date().toDateString());
   }, [teamMembers]);

   // Fetch Employees for Team Management & Leader Assignment
   useEffect(() => {
      if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) || role === UserRole.LEADER) {
         const fetchEmployees = async () => {
            const { data } = await supabase
               .from('employees')
               .select('id, name, shift, allowed_roles')
               .eq('active', true)
               .order('name');
            if (data) {
               let filteredData = data;
               if (role === UserRole.SORTIR_BATCH) {
                  filteredData = data.filter(e => e.shift && e.shift.toLowerCase().includes('harian'));
               }
               setEmployees(filteredData);
               if (role === UserRole.LEADER) {
                  // Filter strictly for PICKER
                  setPickersList(data.filter(e => {
                     if (!e.allowed_roles) return false;
                     try {
                        const roles = Array.isArray(e.allowed_roles) ? e.allowed_roles : JSON.parse(e.allowed_roles);
                        return roles.includes('PICKER') || roles.includes('Picker');
                     } catch {
                        return typeof e.allowed_roles === 'string' && e.allowed_roles.toUpperCase().includes('PICKER');
                     }
                  }));
               }
            }
         };
         fetchEmployees();
      }
   }, [role]);

   // Persist Leader Scan Type
   useEffect(() => {
      localStorage.setItem(STORAGE_KEY_LEADER_SCAN_TYPE, leaderScanType);
   }, [leaderScanType]);

   // Leader Profile Selection: Show modal if no profile selected for today
   useEffect(() => {
      if (role === UserRole.LEADER && !selectedLeaderProfile) {
         setShowLeaderProfileModal(true);
      }
   }, [role, selectedLeaderProfile]);

   // Handle Leader Profile Selection
   const handleLeaderProfileSelect = (profile: LeaderProfile) => {
      setSelectedLeaderProfile(profile);
      localStorage.setItem(STORAGE_KEY_LEADER_PROFILE, profile);
      localStorage.setItem(STORAGE_KEY_LEADER_PROFILE_DATE, new Date().toDateString());
      setShowLeaderProfileModal(false);
   };

   // Fetch Leader Orders for LEADER_ORDERS, LEADER_GLOBAL, and LEADER_SUMMARY view
   useEffect(() => {
      if (role === UserRole.LEADER && (currentView === 'LEADER_ORDERS' || currentView === 'LEADER_GLOBAL' || currentView === 'LEADER_SUMMARY')) {
         const fetchLeaderOrders = async () => {
            try {
               const [y, m, d] = (leaderOrdersDate || '').split('-');
               const dFormatted1 = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
               const dFormatted2 = `${d}/${m}/${y}`;

               const { data, error } = await Promise.resolve(
                  supabase
                     .from('leader_scan_2')
                     .select('id, barcode, leader_name, scan_type, timestamp, assignment_mode, assignees, date')
                     .in('date', [dFormatted1, dFormatted2])
                     .limit(5000)
               ).catch((e) => ({ data: null, error: e }));

               if (data) {
                  setLeaderOrdersData(data);
               }
               if (error) console.error('Leader orders fetch error:', error);
            } catch (e) {
               console.error('Leader orders fetch exception:', e);
            }
         };
         fetchLeaderOrders();
      }
   }, [role, currentView, leaderOrdersDate]);

   // Theme Config
   const theme = useMemo(() => ({
      [UserRole.PICKER]: {
         gradient: 'bg-gradient-to-r from-picker-600 to-picker-500 dark:from-picker-950 dark:to-picker-900',
         accent: 'text-picker-600 dark:text-picker-300',
         bgLight: 'bg-picker-50 dark:bg-picker-900/30',
         btn: 'bg-picker-600 active:bg-picker-700 dark:bg-picker-700 dark:active:bg-picker-600',
         title: 'Pengambilan Barang'
      },
      [UserRole.PICKER_2]: {
         gradient: 'bg-gradient-to-r from-picker-600 to-picker-500 dark:from-picker-950 dark:to-picker-900',
         accent: 'text-picker-600 dark:text-picker-300',
         bgLight: 'bg-picker-50 dark:bg-picker-900/30',
         btn: 'bg-picker-600 active:bg-picker-700 dark:bg-picker-700 dark:active:bg-picker-600',
         title: 'Pengambilan Barang'
      },
      [UserRole.CHECKER]: {
         gradient: 'bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 dark:from-teal-950 dark:via-teal-900 dark:to-emerald-950',
         accent: 'text-teal-600 dark:text-teal-300',
         bgLight: 'bg-teal-50 dark:bg-teal-900/30',
         btn: 'bg-teal-600 active:bg-teal-700 dark:bg-teal-700 dark:active:bg-teal-600',
         title: 'Checker'
      },
      [UserRole.SORTIR]: {
         gradient: 'bg-gradient-to-r from-sortir-600 to-sortir-500 dark:from-sortir-950 dark:to-sortir-900',
         accent: 'text-sortir-600 dark:text-sortir-300',
         bgLight: 'bg-sortir-50 dark:bg-sortir-900/30',
         btn: 'bg-sortir-600 active:bg-sortir-700 dark:bg-sortir-700 dark:active:bg-sortir-600',
         title: 'Scan Zona Sortir'
      },
      [UserRole.SORTIR_BATCH]: {
         gradient: 'bg-gradient-to-r from-teal-600 to-teal-500 dark:from-teal-950 dark:to-teal-900',
         accent: 'text-teal-600 dark:text-teal-300',
         bgLight: 'bg-teal-50 dark:bg-teal-900/30',
         btn: 'bg-teal-600 active:bg-teal-700 dark:bg-teal-700 dark:active:bg-teal-600',
         title: 'Scan Sortir Batch'
      },
      [UserRole.PACKING]: {
         gradient: 'bg-gradient-to-r from-packing-600 to-packing-500 dark:from-packing-950 dark:to-packing-900',
         accent: 'text-packing-600 dark:text-packing-300',
         bgLight: 'bg-packing-50 dark:bg-packing-900/30',
         btn: 'bg-packing-600 active:bg-packing-700 dark:bg-packing-700 dark:active:bg-packing-600',
         title: 'Manifest Box'
      },
      [UserRole.PACKING_2]: {
         gradient: 'bg-gradient-to-r from-packing-600 to-packing-500 dark:from-packing-950 dark:to-packing-900',
         accent: 'text-packing-600 dark:text-packing-300',
         bgLight: 'bg-packing-50 dark:bg-packing-900/30',
         btn: 'bg-packing-600 active:bg-packing-700 dark:bg-packing-700 dark:active:bg-packing-600',
         title: 'Manifest Box 2'
      },
      [UserRole.ADMIN]: {
         gradient: 'bg-gradient-to-r from-pink-600 to-rose-500 dark:from-pink-950 dark:to-rose-900',
         accent: 'text-pink-600 dark:text-pink-300',
         bgLight: 'bg-pink-50 dark:bg-pink-900/30',
         btn: 'bg-pink-600 active:bg-pink-700 dark:bg-pink-700 dark:active:bg-pink-600',
         title: 'Scan Admin'
      },
      [UserRole.GUDANG]: {
         gradient: 'bg-gradient-to-r from-gudang-600 to-gudang-500 dark:from-gudang-950 dark:to-gudang-900',
         accent: 'text-gudang-600 dark:text-gudang-300',
         bgLight: 'bg-gudang-50 dark:bg-gudang-900/30',
         btn: 'bg-gudang-600 active:bg-gudang-700 dark:bg-gudang-700 dark:active:bg-gudang-600',
         title: 'Manajemen Gudang'
      },
      [UserRole.OJOL]: {
         gradient: 'bg-gradient-to-r from-cyan-600 to-cyan-500 dark:from-cyan-950 dark:to-cyan-900',
         accent: 'text-cyan-600 dark:text-cyan-300',
         bgLight: 'bg-cyan-50 dark:bg-cyan-900/30',
         btn: 'bg-cyan-600 active:bg-cyan-700 dark:bg-cyan-700 dark:active:bg-cyan-600',
         title: 'Pengiriman Ojol'
      },
      [UserRole.LEADER]: {
         gradient: 'bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#1e1b4b]',
         accent: 'text-purple-400 dark:text-purple-300',
         bgLight: 'bg-purple-950/20 dark:bg-purple-900/30',
         btn: 'bg-indigo-600 active:bg-indigo-700 dark:bg-indigo-800 dark:active:bg-indigo-600',
         title: 'Leader Monitoring'
      },
   }[role]), [role]);

   const successAudio = useRef<HTMLAudioElement | null>(null);
   const errorAudio = useRef<HTMLAudioElement | null>(null);

   // Initialize Audio & Settings
   useEffect(() => {
      // Load Preferences
      const savedSuccessKey = localStorage.getItem(STORAGE_KEY_SOUND_SUCCESS) || 'BEEP2';
      const savedErrorKey = localStorage.getItem(STORAGE_KEY_SOUND_ERROR) || 'DOWN';
      const savedVibration = localStorage.getItem(STORAGE_KEY_VIBRATION);
      const savedSpeed = localStorage.getItem(STORAGE_KEY_SCAN_SPEED);

      // Validate keys exist in library, fallback if not
      setSuccessSoundKey(SOUND_LIBRARY.SUCCESS[savedSuccessKey as keyof typeof SOUND_LIBRARY.SUCCESS] ? savedSuccessKey : 'BEEP2');
      setErrorSoundKey(SOUND_LIBRARY.ERROR[savedErrorKey as keyof typeof SOUND_LIBRARY.ERROR] ? savedErrorKey : 'DOWN');

      const savedContinuous = localStorage.getItem(STORAGE_KEY_CONTINUOUS_SCAN);
      if (savedContinuous === 'true') setIsContinuousScan(true);

      // New Settings Load
      if (savedVibration !== null) setIsVibrationEnabled(savedVibration === 'true');

      // SPEED LOGIC:
      // 1. If saved speed exists, use it.
      // 2. If NO saved speed, default based on Role.
      if (savedSpeed && ['SLOW', 'NORMAL', 'FAST', 'TURBO'].includes(savedSpeed)) {
         setScanSpeed(savedSpeed as 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO');
      } else {
         // Default to SLOW (Akurat) for ALL profiles if no setting exists
         setScanSpeed('SLOW');
         localStorage.setItem(STORAGE_KEY_SCAN_SPEED, 'SLOW');
      }

   }, [role]); // Added role dependency

   // Update Audio Refs when selection changes
   useEffect(() => {
      const url = SOUND_LIBRARY.SUCCESS[successSoundKey as keyof typeof SOUND_LIBRARY.SUCCESS]?.url || SOUND_LIBRARY.SUCCESS.BEEP2.url;
      successAudio.current = new Audio(url);
      localStorage.setItem(STORAGE_KEY_SOUND_SUCCESS, successSoundKey);
   }, [successSoundKey]);

   useEffect(() => {
      const url = SOUND_LIBRARY.ERROR[errorSoundKey as keyof typeof SOUND_LIBRARY.ERROR]?.url || SOUND_LIBRARY.ERROR.DOWN.url;
      errorAudio.current = new Audio(url);
      localStorage.setItem(STORAGE_KEY_SOUND_ERROR, errorSoundKey);
   }, [errorSoundKey]);

   // --- MIDNIGHT RESET LOGIC (00:00:00) ---
   useEffect(() => {
      const now = new Date();
      const night = new Date(
         now.getFullYear(),
         now.getMonth(),
         now.getDate() + 1, // tomorrow
         0, 0, 0 // 00:00:00
      );
      const msToMidnight = night.getTime() - now.getTime();

      // Set timeout to reload/refresh state at midnight
      const timer = setTimeout(() => {
         // Updating this state forces 'todayItems' memo to recalculate
         setTodayDateIdentifier(new Date().toDateString());
         // Also reload window to be safe and clear any stale frontend caches
         window.location.reload();
      }, msToMidnight);

      return () => clearTimeout(timer);
   }, []);

   // --- FETCH & REALTIME FORBIDDEN SYMBOLS ---
    useEffect(() => {
       const fetchForbidden = async () => {
          try {
             const { data, error } = await supabase.from('app_forbidden_symbols').select('symbol');
             if (error) throw error;
             if (data) {
                setForbiddenSymbols(data.map((d: any) => d.symbol));
             }
          } catch (err: any) {
             if (err.code !== '42P01' && !err.message?.includes('Could not find the table')) {
                console.error("Error fetching symbols", err);
             }
          }
       };
       fetchForbidden();

       let debounceTimer: any = null;
       const subscription = supabase
          .channel('forbidden_symbols_update')
          .on(
             'postgres_changes',
             { event: '*', schema: 'public', table: 'app_forbidden_symbols' },
             () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                   fetchForbidden();
                }, 1000);
             }
          )
          .subscribe();

       return () => {
          supabase.removeChannel(subscription);
          if (debounceTimer) clearTimeout(debounceTimer);
       };
    }, []);

    // --- FETCH & REALTIME CANCELLED BARCODES ---
    useEffect(() => {
       const fetchCancelledBarcodes = async () => {
          try {
             // Supabase default limit is 1000 rows per query.
             // We must paginate to fetch cancelled barcodes.
             const PAGE_SIZE = 1000;
             let allBarcodes: string[] = [];
             let page = 0;
             let hasMore = true;

             while (hasMore) {
                const from = page * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;

                const { data, error } = await supabase
                   .from('cancelled_orders')
                   .select('barcode')
                   .eq('is_active', true)
                   .range(from, to);

                if (error) {
                   console.error('[CANCEL] Fetch error:', error.code, error.message);
                   if (error.code !== '42P01') throw error;
                   break;
                }

                if (data && data.length > 0) {
                   allBarcodes = allBarcodes.concat(data.map((d: any) => d.barcode.toUpperCase()));
                   if (data.length < PAGE_SIZE) {
                      hasMore = false;
                   } else {
                      page++;
                   }
                } else {
                   hasMore = false;
                }
             }

             console.log(`[CANCEL] Loaded ${allBarcodes.length} active cancelled barcodes`);
             setCancelledBarcodes(allBarcodes);
          } catch (err: any) {
             console.error('[CANCEL] Exception fetching cancelled barcodes:', err);
          }
       };
       fetchCancelledBarcodes();

       let debounceTimer: any = null;
       const subscription = supabase
          .channel('cancelled_orders_update')
          .on(
             'postgres_changes',
             { event: '*', schema: 'public', table: 'cancelled_orders' },
             (payload) => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                   fetchCancelledBarcodes();
                }, 1000);
             }
          )
          .subscribe();

       return () => {
          supabase.removeChannel(subscription);
          if (debounceTimer) clearTimeout(debounceTimer);
       };
    }, []);

   const cancelledSet = useMemo(() => new Set(cancelledBarcodes.map(b => b.trim().toUpperCase())), [cancelledBarcodes]);

   // --- AUTO-SWEEP CANCEL (23:00) ---
   useEffect(() => {
      if (role !== UserRole.SORTIR) return;

      const checkAndSweep = async () => {
         const now = new Date();
         if (now.getHours() === 23) {
            const itemsToMove = items.filter(item => {
               const isCancel = (item.barcode && cancelledSet.has(item.barcode.trim().toUpperCase())) || (item.description || '').toUpperCase().includes('[CANCEL]') || item.priority === 'HIGH';
               return isCancel && item.menu_context !== 'HISTORY_MOVED';
            });

            if (itemsToMove.length > 0) {
               console.log(`[AUTO-SWEEP] Moving ${itemsToMove.length} items to elimination`);
               
               // 1. Move to sortir_eliminations
               const { error: moveErr } = await supabase.from('sortir_eliminations').insert(
                  itemsToMove.map(item => ({
                     barcode: item.barcode,
                     employee_name: item.employee_name || employeeName,
                     timestamp: Date.now(),
                     move_type: 'AUTO'
                  }))
               );

               if (!moveErr) {
                  // 2. Delete from scanned_items
                  const idsToDelete = itemsToMove.map(i => i.id);
                  await supabase.from('scanned_items').delete().in('id', idsToDelete);
                  replicateBackupDelete('scanned_items', { column: 'id', inValues: idsToDelete });
                  
                  // 3. Update local state
                  setItems(prev => prev.filter(i => !idsToDelete.includes(i.id)));
                  setSuccessToast(`Otomatis memindahkan ${itemsToMove.length} resi cancel ke History`);
                  setTimeout(() => setSuccessToast(null), 5000);
               }
            }
         }
      };

      const interval = setInterval(checkAndSweep, 60000); // Check every minute
      return () => clearInterval(interval);
   }, [role, items, cancelledSet, employeeName]);

   // --- 7-DAY CLEANUP LOGIC ---
   // --- 7-DAY CLEANUP LOGIC REMOVED ---
   // User requested data retention beyond 7 days.
   // useEffect(() => { ... }, []);

   // --- FETCH PERSISTENT FAILED ITEMS (7 Days Logic) ---
   useEffect(() => {
      const fetchFailedItems = async () => {
         try {
            const { data, error } = await supabase
               .from('failed_scans')
               .select('*')
               .eq('user_email', userEmail)
               .eq('role', role)
               .order('timestamp', { ascending: false });

            if (error) {
               if (error.code !== '42P01') throw error; // Ignore missing table error initially
            }

            if (data) {
               const persistentFailed: FailedItem[] = data.map((d: any) => ({
                  id: d.id, // Use UUID from DB
                  timestamp: d.timestamp,
                  barcode: d.barcode,
                  role: d.role as UserRole,
                  status: 'ERROR',
                  description: d.description,
                  destination: d.destination,
                  priority: d.priority,
                  employee_name: d.employee_name,
                  failReason: d.fail_reason,
                  failMessage: d.fail_message
               }));
               // Merge with existing (RAM-based network errors are separate, but we set state here)
               // We prioritize persistent data here, network errors added dynamically later
               setFailedItems(persistentFailed);

               // enforceFailedHistoryLimit(persistentFailed);
            }
         } catch (err) {
            console.warn("Failed fetch failed_scans", err);
         }
      };

      if (navigator.onLine) {
         fetchFailedItems();
      }
   }, [userEmail, role]);

   // Helper: Enforce 7 distinct active days limit (Extra Check)
   const enforceFailedHistoryLimit = async (items: FailedItem[]) => {
      if (items.length === 0) return;

      // Group by Date String
      const dateGroups = new Set<string>();
      items.forEach(i => {
         const d = new Date(i.timestamp).toDateString();
         dateGroups.add(d);
      });

      // Convert to array and sort DESC (newest first)
      const sortedDates = Array.from(dateGroups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      if (sortedDates.length > 7) {
         // Identify dates to delete (anything after index 6)
         const datesToDelete = sortedDates.slice(7);

         // Convert dates back to timestamps for DB query
         // We'll delete strictly by ID found in RAM that matches these dates to be safe
         const idsToDelete = items.filter(i => datesToDelete.includes(new Date(i.timestamp).toDateString())).map(i => i.id);

         if (idsToDelete.length > 0) {
            await supabase.from('failed_scans').delete().in('id', idsToDelete);
            // Update Local State
            setFailedItems(prev => prev.filter(i => !idsToDelete.includes(i.id)));
         }
      }
   };

   const toggleContinuousScan = () => {
      setIsContinuousScan(prev => {
         const newVal = !prev;
         localStorage.setItem(STORAGE_KEY_CONTINUOUS_SCAN, String(newVal));
         return newVal;
      });
   };

   const toggleVibration = () => {
      setIsVibrationEnabled(prev => {
         const newVal = !prev;
         localStorage.setItem(STORAGE_KEY_VIBRATION, String(newVal));
         return newVal;
      });
   };

   const handleSetScanSpeed = (speed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO') => {
      setScanSpeed(speed);
      localStorage.setItem(STORAGE_KEY_SCAN_SPEED, speed);
   };

   const triggerCameraToast = (message: string, type: 'error' | 'success') => {
      setCameraToast({ message, type });
      setTimeout(() => setCameraToast(null), 3000);
   };

   useEffect(() => {
      const handleOnline = () => {
         setIsOnline(true);
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
         window.removeEventListener('online', handleOnline);
         window.removeEventListener('offline', handleOffline);
      };
   }, []);
   const handleMoveCancelToSatuan = async () => {
      if (!pendingMoveCancelItem) return;
      setIsMovingCancel(true);
      
      try {
         // 1. Move to sortir_eliminations
         const { error: insertErr } = await supabase.from('sortir_eliminations').insert([{
            barcode: pendingMoveCancelItem.barcode,
            employee_name: pendingMoveCancelItem.employee_name || employeeName,
            timestamp: Date.now(),
            move_type: 'MANUAL'
         }]);

         if (insertErr) throw insertErr;
         replicateBackupInsert('sortir_eliminations', [{
            barcode: pendingMoveCancelItem.barcode,
            employee_name: pendingMoveCancelItem.employee_name || employeeName,
            timestamp: Date.now(),
            move_type: 'MANUAL'
         }]);

         // 2. Delete from scanned_items
         const { error: deleteErr } = await supabase.from('scanned_items').delete().eq('id', pendingMoveCancelItem.id);
         if (deleteErr) throw deleteErr;
         replicateBackupDelete('scanned_items', { column: 'id', value: pendingMoveCancelItem.id });

         // 3. Update local state
         setItems(prev => prev.filter(i => i.id !== pendingMoveCancelItem.id));
         setSuccessToast("Berhasil dipindahkan ke Riwayat Satuan!");
         setTimeout(() => setSuccessToast(null), 3000);
         playSuccess();
      } catch (err) {
         console.error("Error moving cancel item:", err);
         setErrorToast("Gagal memindahkan data");
         setTimeout(() => setErrorToast(null), 3000);
         playError();
      } finally {
         setIsMovingCancel(false);
         setIsMoveCancelModalOpen(false);
         setPendingMoveCancelItem(null);
      }
   };

   useEffect(() => {
      // Don't fetch main list for dashboard/global/orders specialized views
      if (currentView !== 'LEADER_DASHBOARD' && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS') {
         fetchData();
      }
   }, [role, userEmail, employeeName, currentView]);

    // --- REALTIME: scanned_items & leader_pending_scans changes (from other devices) ---
    useEffect(() => {
       if (currentView === 'LEADER_DASHBOARD' || currentView === 'LEADER_GLOBAL' || currentView === 'LEADER_ORDERS') return;

       let debounceTimer: any = null;

       const channel = supabase
          .channel('scanned_items_realtime')
          .on(
             'postgres_changes',
             { event: '*', schema: 'public', table: 'scanned_items' },
             (payload) => {
                const row = (payload.new || payload.old) as any;
                if (row && (row.role === role || row.employee_name === employeeName)) {
                   if (debounceTimer) clearTimeout(debounceTimer);
                   debounceTimer = setTimeout(() => {
                      fetchData();
                   }, 500);
                }
             }
          )
          .on(
             'postgres_changes',
             { event: '*', schema: 'public', table: 'leader_pending_scans' },
             () => {
                if (role === UserRole.LEADER) {
                   if (debounceTimer) clearTimeout(debounceTimer);
                   debounceTimer = setTimeout(() => {
                      fetchData();
                   }, 500);
                }
             }
          )
          .subscribe();

       return () => {
          supabase.removeChannel(channel);
          if (debounceTimer) clearTimeout(debounceTimer);
       };
    }, [role, userEmail, employeeName, currentView]);

   const fetchData = async () => {
      // We only fetch from SERVER now. No Local Storage merging.
      if (!navigator.onLine) {
         // If offline, just show nothing or keep current state. 
         // We do NOT load from local storage queue as requested.
         return;
      }

      const isHistory = currentView.endsWith('_HISTORY') || currentView === 'HISTORY';

      // IF HISTORY MODE: Fetch last 7 Days (Updated from 30)
      // IF SCAN MODE: Fetch last 24 Hours (Buffer)
      const startOfPeriod = new Date();
      if (isHistory) {
         startOfPeriod.setDate(startOfPeriod.getDate() - 30); // Expanded to 30 days
      } else if (role === 'GUDANG' || (role === UserRole.LEADER && currentView === 'LEADER_PENDING')) {
         // GUDANG & LEADER PENDING Active View: Reset at 00:00 Today
         startOfPeriod.setHours(0, 0, 0, 0);
      } else {
         startOfPeriod.setDate(startOfPeriod.getDate() - 1); // Other Roles: 24 Hour Buffer
      }

      const startTimestamp = startOfPeriod.getTime();

      // SPECIAL FETCH FOR LEADER PENDING SCANS (Dedicated Table: leader_pending_scans)
      if (role === UserRole.LEADER && (currentView === 'LEADER_PENDING' || currentView === 'LEADER_PENDING_HISTORY')) {
         try {
            let lpQuery = supabase
               .from('leader_pending_scans')
               .select('*')
               .gte('timestamp', startTimestamp);

            if (selectedLeaderProfile) {
               lpQuery = lpQuery.eq('leader_profile', selectedLeaderProfile);
            }

            const { data: lpData, error: lpErr } = await lpQuery.order('timestamp', { ascending: false }).limit(5000);

            if (lpData) {
               const lpItems = lpData.map((row: any) => ({
                  id: row.id,
                  timestamp: isNaN(Number(row.timestamp)) ? new Date(row.timestamp).getTime() : Number(row.timestamp),
                  barcode: row.barcode,
                  role: UserRole.LEADER,
                  destination: row.leader_profile || 'LEADER',
                  description: row.description || `[PENDING LEADER] ${row.scan_type || ''}`,
                  priority: 'NORMAL',
                  status: 'PENDING',
                  employee_name: row.leader_name || employeeName,
                  syncStatus: 'SYNCED',
                  menu_context: 'LEADER_PENDING',
                  scan_mode: row.scan_type as any
               }));
               setItems(lpItems as ScannedItem[]);
               return;
            }
            if (lpErr) console.error("Leader pending fetch error:", lpErr);
         } catch (err) {
            console.error("Leader pending fetch exception:", err);
         }
         return;
      }

      try {
         // DYNAMIC SUPABASE CLIENT
         const targetClient = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? supabaseBundling : supabase;
         const targetTable = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? 'outbound_scans' : (currentView === 'SPECIAL_SCAN' ? 'admin_special_scans' : 'scanned_items');
         
         let query = targetClient
            .from(targetTable)
            .select('id, timestamp, barcode, role, description, status, employee_name, menu_context, destination, scan_mode, user_email');

         if (targetTable === 'admin_special_scans') {
            query = query
               .order('scanned_at', { ascending: false })
               .limit(5000);
         } else {
            query = query.eq('role', role);

            const cleanEmail = (userEmail || '').trim().replace(/"/g, '');
            const cleanName = (employeeName || '').trim().replace(/"/g, '');

            if (cleanEmail && cleanName) {
               query = query.or(`user_email.eq."${cleanEmail}",employee_name.ilike."%${cleanName}%"`);
            } else if (cleanEmail) {
               query = query.eq('user_email', cleanEmail);
            } else if (cleanName) {
               query = query.ilike('employee_name', `%${cleanName}%`);
            }

            query = query
               .gte('timestamp', startTimestamp)
               .order('timestamp', { ascending: false })
               .limit(5000);
         }

         const { data, error } = await query;

         if (data) {
            let serverItems = data.map((row: any) => {
               if (targetTable === 'admin_special_scans') {
                  return {
                     id: row.id.toString(), // Convert to string as item.id is string
                     barcode: row.barcode,
                     timestamp: new Date(row.scanned_at).getTime(),
                     role: 'Admin',
                     description: 'Special Scan',
                     status: 'COMPLETED',
                     employee_name: row.admin_name,
                     menu_context: 'SPECIAL_SCAN',
                     destination: '',
                     scan_mode: 'camera',
                     syncStatus: 'SYNCED'
                  };
               }
               return {
                  id: row.id,
                  // Handle both BIGINT (ms) and TIMESTAMPTZ (ISO String) from Supabase
                  timestamp: isNaN(Number(row.timestamp)) ? new Date(row.timestamp).getTime() : Number(row.timestamp),
                  barcode: row.barcode,
                  role: row.role as UserRole,
                  destination: row.destination,
                  description: row.description,
                  priority: (row as any).priority as any,
                  status: row.status as any,
                  employee_name: row.employee_name,
                  syncStatus: 'SYNCED',
                  menu_context: row.menu_context || (currentView === 'SCAN_2' ? 'SCAN_2' : (currentView === 'PENDING' ? 'PENDING' : 'SCAN'))
               };
            }) as any[];

            const isHistory = currentView.endsWith('_HISTORY') || currentView === 'HISTORY';

            if (role === UserRole.LEADER || ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && isHistory)) {
               try {
                  const targetHistoryTable = (role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) ? 'sortir_eliminations' : 'leader_scan_2';
                  let leaderQuery = supabase
                     .from(targetHistoryTable)
                     .select('*')
                     .gte('timestamp', startTimestamp);

                  if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH)) {
                     leaderQuery = leaderQuery.eq('employee_name', employeeName);
                  }

                  const { data: leaderData } = await leaderQuery.order('timestamp', { ascending: false });

                  if (leaderData) {
                     const historyItems = leaderData.map(row => ({
                        id: row.id,
                        timestamp: row.timestamp,
                        barcode: row.barcode,
                        role: UserRole.SORTIR,
                        destination: 'ELIMINASI',
                        description: `[CANCEL] Moved to History`,
                        priority: 'HIGH',
                        status: 'COMPLETED',
                        employee_name: (role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) ? row.employee_name : (row.assignees ? row.assignees[0] : 'N/A'),
                        syncStatus: 'SYNCED',
                        menu_context: 'HISTORY_MOVED'
                     }));
                     serverItems = [...serverItems, ...historyItems].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
                  }
               } catch (err) {
                  console.error("History fetch error", err);
               }
            }

            setItems(serverItems as ScannedItem[]);
         }
      } catch (error) {
         console.warn("Fetch error:", error);
      }
   };

   const playSuccess = () => {
      // Audio
      if (successAudio.current && isSoundEnabled) {
         successAudio.current.currentTime = 0;
         successAudio.current.play().catch(e => console.log("Audio play failed", e));
      }
      // Vibration: Force attempt without checks to bypass some browser logic
      if (isVibrationEnabled) {
         try {
            // Simple vibration for success
            if (navigator.vibrate) {
               navigator.vibrate(200);
            }
         } catch (e) {
            console.warn("Vibration failed:", e);
         }
      }
   };

   const playErrorSynth = () => {
      try {
         const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
         if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
         }
      } catch (e) {
         console.warn("Synth play error failed:", e);
      }
   };

   const playError = () => {
      // Audio
      if (errorAudio.current && isSoundEnabled) {
         errorAudio.current.currentTime = 0;
         errorAudio.current.play().catch(e => {
            console.log("Audio play failed, playing synth fallback", e);
            playErrorSynth();
         });
      } else {
         playErrorSynth();
      }
      // Vibration: Stronger pattern
      if (isVibrationEnabled) {
         try {
            // Error pattern
            if (navigator.vibrate) {
               navigator.vibrate([100, 50, 100, 50, 300]);
            }
         } catch (e) {
            console.warn("Vibration failed:", e);
         }
      }
   };

   const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!allowManualInput) {
         playError();
         setErrorToast("Manual input is locked.\nPlease ask admin for access.");
         setTimeout(() => setErrorToast(null), 3000);
         return;
      }

      if (hasActiveSequenceAlertRef.current) return;
      const rawInput = manualInput.trim();
      if (!rawInput) return;

      // DevMode toggle: typing 'devmode' or 'devmodenew' activates hidden menus (admin only)
      if (rawInput.toLowerCase() === 'devmode' || rawInput.toLowerCase() === 'devmodenew') {
         const cleanEmail = (userEmail || '').trim().toLowerCase();
         const isOnlyAdminAccount = cleanEmail === 'admin' || cleanEmail === 'admin@kalindo.com' || cleanEmail.startsWith('admin@');
         if (!isOnlyAdminAccount) {
            setManualInput('');
            return;
         }
         setDevMode(prev => !prev);
         setManualInput('');
         setSuccessToast(devMode ? 'Dev Mode OFF' : 'Dev Mode ON');
         setTimeout(() => setSuccessToast(null), 2000);
         return;
      }

      const finalBarcode = rawInput.toUpperCase();
      // Respons seketika: langsung kosongkan input agar user tidak merasa macet/lag
      setManualInput('');

      if (role === UserRole.GUDANG && currentView === 'REPORT') {
         setPendingReportScan(finalBarcode);
         return;
      }

      setIsManualSubmitting(true);
      const tempId = Date.now();
      if (tempId) {
         setRecentScans(prev => {
            const newHistory = [{ id: tempId, code: finalBarcode, status: 'loading' as const }, ...prev];
            return newHistory.slice(0, 20);
         });
      }

      try {
         await processScanResult({
            barcode: finalBarcode,
            description: 'Manual Entry',
            destination: 'N/A',
            priority: 'NORMAL'
         }, tempId);
      } catch (err) {
         console.error("Manual scan error:", err);
      } finally {
         setIsManualSubmitting(false);
      }
   };

   const submitReportScan = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!pendingReportScan) return;

      if (!reportKeterangan) {
         // Fallback basic alert for validation if empty
         alert("Silakan pilih Keterangan terlebih dahulu.");
         return;
      }

      const desc = `[REPORT] Keterangan: ${reportKeterangan} | MSKU: ${reportNamaBarang} | Qty: ${reportQty}`;
      
      setIsProcessing(true);
      const barcodeToSubmit = pendingReportScan;
      setPendingReportScan(null);
      setReportKeterangan('');
      setReportNamaBarang('');
      setReportQty('');
      
      try {
         await processScanResult({
            barcode: barcodeToSubmit,
            description: desc,
            destination: 'N/A',
            priority: 'NORMAL',
            report_keterangan: reportKeterangan,
            report_msku: reportNamaBarang,
            report_qty: reportQty
         });
      } catch (err) {
         console.error(err);
      } finally {
         setIsProcessing(false);
      }
   };

   const handleCameraCapture = async (barcode: string) => {
      // If sequence alert modal is active, completely ignore incoming scans
      if (hasActiveSequenceAlertRef.current) return;

      // Check if barcode is in grace period cooldown after acknowledgment
      if (ignoredCooldownRef.current && ignoredCooldownRef.current.code === barcode && Date.now() < ignoredCooldownRef.current.until) {
         return;
      }

      if (role === UserRole.GUDANG && currentView === 'REPORT') {
         setPendingReportScan(barcode);
         return;
      }

      // If continuous mode, we DON'T set isProcessing true here, to avoid blocking UI/Camera.
      // Instead we use optimistic updates in recentScans.
      if (!isContinuousScan && isProcessing) return;

      // --- CONTINUOUS MODE COOLDOWN ---
      if (isContinuousScan) {
         const now = Date.now();

         // Calculate cooldown based on speed setting
         let cooldownMs = 2000; // Normal
         if (scanSpeed === 'FAST') cooldownMs = 1000;
         if (scanSpeed === 'TURBO') cooldownMs = 200; // Very fast

         if (lastScannedRef.current &&
            lastScannedRef.current.code === barcode &&
            now - lastScannedRef.current.timestamp < cooldownMs) {
            return;
         }
         lastScannedRef.current = { code: barcode, timestamp: now };

         // OPTIMISTIC UPDATE: Add 'Loading' state immediately
         const tempId = now;
         setRecentScans(prev => {
            // Keep last 20 items to prevent lag
            const newHistory = [{ id: tempId, code: barcode, status: 'loading' as const }, ...prev];
            return newHistory.slice(0, 20);
         });

         try {
            await processScanResult({
               barcode: barcode,
               description: 'Camera Scan',
               destination: 'N/A',
               priority: 'NORMAL'
            }, tempId); // Pass tempId for update
         } catch (e) {
            console.error(e);
         }
      } else {
         // Normal Mode: Block UI
         setIsProcessing(true);
         try {
            await processScanResult({
               barcode: barcode,
               description: 'Camera Scan',
               destination: 'N/A',
               priority: 'NORMAL'
            });
            // If sequence alert was triggered, keep camera open so user sees paused state behind acknowledge modal
            if (!hasActiveSequenceAlertRef.current) {
               setIsCameraOpen(false); // Close camera after scan
            }
         } catch (error) {
            // handled
         } finally {
            setIsProcessing(false);
         }
      }
   };
   const batchScansTrackerRef = useRef<Record<string, string[]>>({});

   const checkForBatchTrigger = async (barcode: string): Promise<boolean> => {
      try {
         const candidates = getBarcodeCandidates(barcode);
         if (candidates.length === 0) return false;

         // 1. Check if this barcode belongs to an active batch in batch_items
         const { data: matchedItem, error: matchErr } = await supabase
            .from('batch_items')
            .select('batch_id, barcode')
            .in('barcode', candidates)
            .limit(1)
            .maybeSingle();

         if (matchErr || !matchedItem?.batch_id) return false;

         const batchId = matchedItem.batch_id;
         const normalizedCurrentBarcode = matchedItem.barcode.trim().toUpperCase();

         // 2. Fetch all barcodes for this batch to know the full batch roster
         const { data: batchRoster, error: rosterErr } = await supabase
            .from('batch_items')
            .select('barcode')
            .eq('batch_id', batchId);

         if (rosterErr || !batchRoster || batchRoster.length === 0) return false;

         const batchRosterSet = new Set(batchRoster.map(b => b.barcode.trim().toUpperCase()));

         // 3. Collect unique barcodes from this batch that have been scanned by this role
         const scannedFromThisBatch = new Set<string>();

         // Check local items state for this role
         items.forEach(it => {
            if (it.role === role) {
               const norm = it.barcode.trim().toUpperCase();
               if (batchRosterSet.has(norm)) {
                  scannedFromThisBatch.add(norm);
               }
            }
         });

         // Check in-memory tracker for this batch
         const prevTrackerList = batchScansTrackerRef.current[batchId] || [];
         prevTrackerList.forEach(b => {
            if (batchRosterSet.has(b)) {
               scannedFromThisBatch.add(b);
            }
         });

         // Add the current scanned barcode
         scannedFromThisBatch.add(normalizedCurrentBarcode);

         // Update in-memory tracker
         batchScansTrackerRef.current[batchId] = Array.from(scannedFromThisBatch);

         // 4. Trigger auto-batch as soon as 3 unique barcodes of this batch are reached (or all if batch size < 3)
         const requiredCount = Math.min(3, batchRoster.length);
         if (scannedFromThisBatch.size >= requiredCount) {
            const triggerList = Array.from(scannedFromThisBatch);
            // Reset tracker for this batch so it doesn't fire again
            batchScansTrackerRef.current[batchId] = [];

            // Trigger auto-scan
            await triggerAutoBatchScan(batchId, triggerList, normalizedCurrentBarcode);
            return true;
         }
      } catch (e) {
         console.error("Batch trigger check failed:", e);
      }
      return false;
   };

   const triggerAutoBatchScan = async (
      batchId: string,
      triggeringBarcodes: string[] = [],
      currentBarcode?: string
   ) => {
      try {
         setIsProcessing(true);
         // 1. Fetch batch items & header concurrently
         const [batchItemsRes, batchHeaderRes] = await Promise.all([
            supabase.from('batch_items').select('*').eq('batch_id', batchId),
            supabase.from('batches').select('excel_filename').eq('id', batchId).single()
         ]);

         const batchItems = batchItemsRes.data;
         const fetchErr = batchItemsRes.error;

         if (fetchErr || !batchItems || batchItems.length === 0) {
            console.error("Fetch batch error:", fetchErr);
            return;
         }

         const batchExcelName = batchHeaderRes.data?.excel_filename || undefined;

         // 2. Prepare Set for Cancel Validation (Case Insensitive)
         const cancelledSet = new Set(cancelledBarcodes.map(bc => bc.trim().toUpperCase()));

         // 3. Filter out already scanned items for the current role (from local state)
         const scannedBarcodes = new Set(
            items
               .filter(it => it.role === role)
               .map(it => it.barcode.trim().toUpperCase())
         );
         
         // For PICKER/PICKER_2/SORTIR_BATCH, currentBarcode is currently being scanned and skipped modal,
         // so it was not saved yet. All OTHER triggeringBarcodes were already saved in previous steps.
         // For other roles (e.g. SORTIR), all triggeringBarcodes were already saved.
         const isModalRole = [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR_BATCH].includes(role);
         const normalizedCurrent = (currentBarcode || '').trim().toUpperCase();

         const alreadySavedTriggers = new Set(
            triggeringBarcodes
               .map(bc => bc.trim().toUpperCase())
               .filter(bc => isModalRole ? bc !== normalizedCurrent : true)
         );

         const toAutoScan = batchItems.filter(it => {
            const normalizedBC = it.barcode.trim().toUpperCase();
            return !scannedBarcodes.has(normalizedBC) && !alreadySavedTriggers.has(normalizedBC);
         });

         if (toAutoScan.length === 0) {
            return;
         }

         playSuccess();
         triggerCameraToast(`Memindahkan ${toAutoScan.length} data batch...`, 'success');

         const combinedName = ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) || (role === UserRole.PICKER || role === UserRole.PICKER_2)) && scanMode === 'TIM' 
            ? (teamMembers.length > 0 ? teamMembers.join(', ') : employeeName) 
            : employeeName;

         // 4. Prepare Bulk Data with Cancel Logic
         const bulkItems = toAutoScan.map(it => {
            const uniqueId = generateUniqueScanId();
            const isCancelled = cancelledSet.has(it.barcode.trim().toUpperCase());

            return {
               id: uniqueId,
               timestamp: Date.now(),
               barcode: it.barcode,
               order_id: it.order_id || null, // Include order_id from batch_items
               role: role,
               status: 'COMPLETED' as const,
               description: isCancelled ? `[CANCEL] Camera Scan` : `[AUTO-BATCH] ${it.msku || ''}`,
               destination: [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR_BATCH].includes(role) ? `Page ${selectedPage} (Auto)` : 'BATCH',
               priority: isCancelled ? ('HIGH' as const) : ('NORMAL' as const),
               employee_name: combinedName,
               user_email: userEmail,
               menu_context: 'DEFAULT',
               excel_filename: batchExcelName,
               report_keterangan: null,
               report_msku: null,
               report_qty: null,
               ...(((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) || (role === UserRole.PICKER || role === UserRole.PICKER_2)) ? {
                  scan_mode: scanMode,
                  team_members: scanMode === 'TIM' ? teamMembers : []
               } : {})
            };
         });

         // 5. Update local state IMMEDIATELY (Instant UI Feedback)
         setItems(prev => [...bulkItems.map(bi => ({ ...bi, syncStatus: 'SYNCED' as const })), ...prev]);

         // 6. Bulk Insert to scanned_items (Handled in high-speed parallel chunks by PocketBase)
         const { error: insertErr } = await supabase.from('scanned_items').insert(bulkItems);

         if (!insertErr) {
            replicateBackupInsert('scanned_items', bulkItems);
         }

         if (insertErr) {
            console.error("Bulk Insert Error:", insertErr);
            triggerCameraToast("Gagal sinkron sebagian data batch ke server!", "error");
         }

         // NOTE: DO NOT DELETE FROM batch_items!
         // batch_items must remain intact for Admin Dashboard "Data Items" & "Ringkasan Progress".

         // 7. Update all previously scanned trigger barcodes with excel_filename asynchronously
         if (batchExcelName && triggeringBarcodes.length > 0) {
            const upperBCs = triggeringBarcodes.map(b => b.trim().toUpperCase());
            supabase.from('scanned_items')
               .update({ excel_filename: batchExcelName })
               .in('barcode', upperBCs)
               .catch(console.error);
            replicateBackupUpdate('scanned_items', { excel_filename: batchExcelName }, { column: 'barcode', inValues: upperBCs });
         }

         // Custom message if there were cancelled items
         const cancelledCount = bulkItems.filter(bi => bi.description.includes('[CANCEL]')).length;
         if (cancelledCount > 0) {
            triggerCameraToast(`Berhasil! ${bulkItems.length} data pindah (${cancelledCount} resi CANCEL!)`, 'success');
            playError();
         } else {
            triggerCameraToast(`Berhasil! ${bulkItems.length} data batch dipindahkan.`, 'success');
         }

      } catch (e) {
         console.error("Batch Move failed:", e);
      } finally {
         setIsProcessing(false);
      }
   };

   const processScanResult = async (
      result: { barcode: string; description: string; destination: string; priority: 'HIGH' | 'NORMAL' | 'LOW'; report_keterangan?: string; report_msku?: string; report_qty?: string; order_id?: string; },
      tempId?: number
   ) => {
       // Stripping '@' from barcode globally & format prefixes
       let normalizedBc = result.barcode.replace(/@/g, '').trim().toUpperCase();
       const knownPrefixes = ['LXAD', 'JNEB', 'JNAP'];
       for (const p of knownPrefixes) {
          if (normalizedBc.startsWith(`${p}-`)) break;
          if (normalizedBc.startsWith(p)) {
             const rest = normalizedBc.slice(p.length);
             if (rest.length > 0 && !rest.startsWith('-')) {
                normalizedBc = `${p}-${rest}`;
                break;
             }
          }
       }
       if (/^\d{10}$/.test(normalizedBc) && /^[4-9]/.test(normalizedBc)) {
          normalizedBc = '00' + normalizedBc;
       }
       result.barcode = normalizedBc;

      // Fetch order_id in parallel from batch_items and scanned_items if online
      if (!result.order_id && navigator.onLine) {
         try {
            const fetchOrderPromise = Promise.all([
               supabase
                  .from('batch_items')
                  .select('order_id')
                  .eq('barcode', result.barcode)
                  .not('order_id', 'is', null)
                  .limit(1)
                  .maybeSingle(),
               supabase
                  .from('scanned_items')
                  .select('order_id')
                  .eq('barcode', result.barcode)
                  .not('order_id', 'is', null)
                  .limit(1)
                  .maybeSingle()
            ]);
            const orderTimeout = new Promise<any[]>(resolve => setTimeout(() => resolve([null, null]), 200));
            const [bItemRes, sItemRes] = await Promise.race([fetchOrderPromise, orderTimeout]);
            
            if (bItemRes?.data?.order_id) {
               result.order_id = bItemRes.data.order_id;
            } else if (sItemRes?.data?.order_id) {
               result.order_id = sItemRes.data.order_id;
            }
         } catch (e) {
            console.warn("Failed to fetch order_id:", e);
         }
      }

      // Buat nama gabungan untuk mode TIM agar anggota tim terekam di DB Supabase
      const combinedName = (((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) || (role === UserRole.PICKER || role === UserRole.PICKER_2)) && scanMode === 'TIM' && teamMembers.length > 0)
         ? Array.from(new Set([employeeName, ...teamMembers])).join(', ')
         : employeeName;

      // Helper to update optimistic UI if in continuous mode
      const updateContinuousStatus = (status: 'error' | 'success', msg?: string) => {
         if (tempId) {
            setRecentScans(prev => prev.map(s =>
               s.id === tempId ? { ...s, status: status, message: msg } : s
            ));
         }
      };

      // -- LEADER SCAN 2 ASSIGNMENT INTERCEPT --
      if (role === UserRole.LEADER && currentView === 'SCAN_2') {
         if (!navigator.onLine) {
            playError();
            setCriticalNetworkError("Koneksi Internet Terputus!\nData TIDAK bisa di-assign.");
            if (isContinuousScan) updateContinuousStatus('error', 'Offline');
            return;
         }

         // --- DUPLICATE CHECK FOR LEADER SCAN 2 ---
         const startOfDay = new Date();
         startOfDay.setHours(0, 0, 0, 0);

         // Check local items first
         const localDuplicate = items.find(i => 
            i.menu_context === 'SCAN_2' && 
            i.barcode === result.barcode &&
            i.timestamp >= startOfDay.getTime()
         );
         if (localDuplicate) {
            playError();
            const msg = `⚠️ BARCODE SUDAH DISCAN!\n${result.barcode}\nsudah ada di data list.`;
            setErrorToast(msg);
            setTimeout(() => setErrorToast(null), 4000);
            if (isContinuousScan) updateContinuousStatus('error', 'Duplicate');
            triggerCameraToast(`Duplicate: ${result.barcode}`, 'error');
            return;
         }

         // Check database for duplicate
         try {
            const { data: dbDuplicate } = await supabase
               .from('leader_scan_2')
               .select('leader_name')
               .eq('barcode', result.barcode)
               .gte('timestamp', startOfDay.getTime())
               .limit(1)
               .maybeSingle();

            if (dbDuplicate) {
               playError();
               const msg = `⚠️ BARCODE SUDAH DISCAN!\n${result.barcode}\nsudah di-assign oleh ${dbDuplicate.leader_name}.`;
               setErrorToast(msg);
               setTimeout(() => setErrorToast(null), 4000);
               if (isContinuousScan) updateContinuousStatus('error', `By: ${dbDuplicate.leader_name}`);
               triggerCameraToast(`Duplicate: ${result.barcode} (by ${dbDuplicate.leader_name})`, 'error');
               return;
            }
         } catch (dupErr) {
            console.error('Duplicate check error:', dupErr);
            // Continue if check fails to not block workflow
         }

         // --- PRETELAN / SATUAN VALIDATION ---
         const barcodeUpper = result.barcode.toUpperCase();
         const containsSatuan = barcodeUpper.includes('SATUAN');
         const containsPretelan = barcodeUpper.includes('PRETELAN');

         if (leaderScanType === 'PRETELAN' && containsSatuan) {
            playError();
            const msg = `⛔ DITOLAK!\nAnda sedang di mode PRETELAN.\nBarcode "${result.barcode}" mengandung kata SATUAN.\nPindahkan ke mode SATUAN terlebih dahulu.`;
            setErrorToast(msg);
            setTimeout(() => setErrorToast(null), 5000);
            if (isContinuousScan) updateContinuousStatus('error', 'Wrong Type');
            triggerCameraToast('Barcode SATUAN di mode PRETELAN!', 'error');
            return;
         }

         if (leaderScanType === 'SATUAN' && containsPretelan) {
            playError();
            const msg = `⛔ DITOLAK!\nAnda sedang di mode SATUAN.\nBarcode "${result.barcode}" mengandung kata PRETELAN.\nPindahkan ke mode PRETELAN terlebih dahulu.`;
            setErrorToast(msg);
            setTimeout(() => setErrorToast(null), 5000);
            if (isContinuousScan) updateContinuousStatus('error', 'Wrong Type');
            triggerCameraToast('Barcode PRETELAN di mode SATUAN!', 'error');
            return;
         }

         playSuccess();
         setPendingAssignmentBarcode(result.barcode);
         setIsAssignmentModalOpen(true);
         setAssignmentMode('INDIVIDU');
         setAssignmentPicker('');
         setAssignmentTeam([]);

         if (isContinuousScan) updateContinuousStatus('success', 'Wait Assign');
         return; // Intercept: don't save to scanned_items
      }

      // -- LEADER PENDING SCAN INTERCEPT (Dedicated Table: leader_pending_scans) --
      if (role === UserRole.LEADER && currentView === 'LEADER_PENDING') {
         if (!navigator.onLine) {
            playError();
            setCriticalNetworkError("Koneksi Internet Terputus!\nData TIDAK bisa disimpan.");
            if (isContinuousScan) updateContinuousStatus('error', 'Offline');
            return;
         }

         const startOfDay = new Date();
         startOfDay.setHours(0, 0, 0, 0);

         // 1. Local duplicate check
         const localDuplicate = items.find(i => 
            i.menu_context === 'LEADER_PENDING' && 
            i.barcode === result.barcode &&
            i.timestamp >= startOfDay.getTime()
         );

         if (localDuplicate) {
            playError();
            const msg = `⚠️ BARCODE SUDAH DISCAN!\n${result.barcode}\nsudah ada di pending scan leader.`;
            setErrorToast(msg);
            setTimeout(() => setErrorToast(null), 4000);
            if (isContinuousScan) updateContinuousStatus('error', 'Duplicate');
            triggerCameraToast(`Duplicate: ${result.barcode}`, 'error');
            return;
         }

         // 2. Database duplicate check
         try {
            const { data: dbDuplicate } = await supabase
               .from('leader_pending_scans')
               .select('leader_name, leader_profile')
               .eq('barcode', result.barcode)
               .gte('timestamp', startOfDay.getTime())
               .limit(1)
               .maybeSingle();

            if (dbDuplicate) {
               playError();
               const msg = `⚠️ BARCODE SUDAH DISCAN!\n${result.barcode}\nsudah discan oleh ${dbDuplicate.leader_name || dbDuplicate.leader_profile || 'Leader'}.`;
               setErrorToast(msg);
               setTimeout(() => setErrorToast(null), 4000);
               if (isContinuousScan) updateContinuousStatus('error', `By: ${dbDuplicate.leader_name || 'Leader'}`);
               triggerCameraToast(`Duplicate: ${result.barcode}`, 'error');
               return;
            }
         } catch (dupErr) {
            console.warn('Duplicate check error in leader_pending_scans:', dupErr);
         }

         const uniqueId = generateUniqueScanId();
         const payload = {
            id: uniqueId,
            timestamp: Date.now(),
            barcode: result.barcode,
            leader_name: employeeName,
            leader_profile: selectedLeaderProfile || employeeName,
            status: 'PENDING',
            scan_type: 'PENDING',
            description: `[PENDING LEADER] ${result.description || ''}`,
            date: new Date().toLocaleDateString('id-ID')
         };

         try {
            const { error: insertErr } = await supabase
               .from('leader_pending_scans')
               .insert([payload]);

            // Dual Backup to supabaseNew (Fire-and-forget non-blocking)
            supabaseNew
               .from('leader_pending_scans')
               .insert([payload])
               .catch(backupErr => {
                  console.warn('Backup insert error (non-blocking):', backupErr);
               });

            if (insertErr) {
               playError();
               triggerCameraToast("Gagal menyimpan pending scan leader", 'error');
               console.error("Leader pending insert error:", insertErr);
            } else {
               playSuccess();
               triggerCameraToast("Pending scan leader tersimpan!", 'success');

               const newItem: ScannedItem = {
                  id: uniqueId,
                  timestamp: Date.now(),
                  barcode: result.barcode,
                  role: role,
                  status: 'PENDING',
                  description: `[PENDING LEADER] ${result.description || ''}`,
                  destination: selectedLeaderProfile || 'LEADER',
                  priority: 'NORMAL',
                  employee_name: employeeName,
                  syncStatus: 'SYNCED',
                  menu_context: 'LEADER_PENDING'
               };

               setItems(prev => [newItem, ...prev]);

               if (isContinuousScan) {
                  setRecentScans(prev => prev.map(s =>
                     s.code === result.barcode ? { ...s, status: 'success', message: 'Pending Saved' } : s
                  ));
               }
            }
         } catch (err) {
            console.error(err);
            playError();
            triggerCameraToast("Error saat menyimpan pending scan leader", 'error');
         }
         return; // Intercept: don't save to scanned_items
      }

      // Helper to record failed item - NOW SAVES TO DB IF ONLINE
      const recordFail = async (reason: 'DUPLICATE' | 'FORBIDDEN' | 'NETWORK' | 'OTHER', msg: string) => {
         const uniqueFailId = generateUniqueScanId();

         const failedItem: FailedItem = {
            id: uniqueFailId,
            timestamp: Date.now(),
            barcode: result.barcode,
            role: role,
            status: 'ERROR',
            description: result.description,
            destination: result.destination,
            priority: result.priority,
            employee_name: combinedName,
            failReason: reason,
            failMessage: msg,
            ...((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) ? {
               scan_mode: scanMode,
               team_members: scanMode === 'TIM' ? teamMembers : []
            } : {})
         };

         // Update Local State Immediately
         setFailedItems(prev => [failedItem, ...prev]);

         // IF NOT NETWORK ERROR, TRY TO SAVE PERSISTENTLY (NON-BLOCKING)
         if (reason !== 'NETWORK' && navigator.onLine) {
            supabase.from('failed_scans').insert([{
               id: uniqueFailId,
               timestamp: failedItem.timestamp,
               barcode: failedItem.barcode,
               role: failedItem.role,
               user_email: userEmail,
               employee_name: combinedName,
               destination: failedItem.destination,
               description: failedItem.description,
               priority: failedItem.priority,
               fail_reason: reason,
               fail_message: msg,
               ...((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) ? {
                  scan_mode: scanMode,
                  team_members: scanMode === 'TIM' ? teamMembers : []
               } : {})
            }]).then(({ error }) => {
               if (error) console.error("Failed to save to failed_scans table:", error.message);
            }).catch(e => {
               console.error("Failed to persist failed scan:", e);
            });
         }
      };

      // --- BUNDLING SPECIAL PARSING (DD-MM-YYYY SKU) ---
      if (currentView === 'BUNDLING' && result.barcode.includes('-202')) {
         // Regex pattern to check for DD-MM-YYYY at the start
         const datePattern = /^(\d{2}-\d{2}-\d{4})\s+(.+)$/;
         const match = result.barcode.match(datePattern);
         if (match && match[2]) {
            result.barcode = match[2].trim(); // Extract only the SKU part
         }
      }

      // --- STRICT VALIDATION LOGIC ---
      // 1. Check for Lowercase Letters (Ghost Scans / Auto-Adjustments)
      // 2. Check for Length 1-6 Digits (Too short)
      // 3. Check for Single Leading Zero (e.g. 09123 is invalid, but 009123 is valid)

      const isLowercase = /[a-z]/.test(result.barcode);
      const isShort = result.barcode.trim().length >= 1 && result.barcode.trim().length <= 6;
      const isSingleLeadingZero = /^0[^0]/.test(result.barcode); // Starts with 0, next char is NOT 0

      if (isLowercase || isShort || isSingleLeadingZero) {
         playError();
         const msg = "DATA TIDAK VALID.\nHARAP SCAN INVOICE/LABEL ASLI";

         await recordFail('FORBIDDEN', msg);

         if (isContinuousScan) {
            updateContinuousStatus('error', 'Data Tidak Valid');
            triggerCameraToast(msg, 'error');
         } else {
            setErrorToast(msg);
            setTimeout(() => setErrorToast(null), 4000);
         }
         return; // STOP HERE
      }

      // --- STRICT ONLINE CHECK ---
      if (!navigator.onLine) {
         playError();
         const msg = "INTERNET TERPUTUS!";
         // DO NOT SAVE TO DB (obviously), but show Critical Error
         recordFail('NETWORK', msg);

         if (isContinuousScan) {
            updateContinuousStatus('error', 'Offline');
            setCriticalNetworkError("Koneksi Internet Terputus!\nData TIDAK tersimpan.\nSilahkan scan ulang lagi data yang gagal scan tsb.");
         } else {
            setCriticalNetworkError("Koneksi Internet Terputus!\nData TIDAK tersimpan.\nSilahkan scan ulang lagi data yang gagal scan tsb.");
         }
         return; // STOP HERE
       }

        // --- CANCEL CHECK FOR CHECKER & PACKING ---
        if ([UserRole.CHECKER, UserRole.PACKING, UserRole.PACKING_2].includes(role)) {
           try {
              const { data: cancelData, error: cancelErr } = await supabase
                 .from('cancelled_orders')
                 .select('barcode')
                 .eq('barcode', result.barcode)
                 .eq('is_active', true)
                 .limit(1)
                 .maybeSingle();

              if (cancelErr) throw cancelErr;

              if (cancelData) {
                 // Play error sound as requested
                 playError();
                 // Trigger full screen cancel warning modal
                 let contextDesc = `[CANCEL] ${result.description || ''}`;
                 let scanStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';
                 let menuContext = 'DEFAULT';

                 const uniqueId = generateUniqueScanId();
                 const cancelItem: ScannedItem = {
                    id: uniqueId,
                    timestamp: Date.now(),
                    barcode: result.barcode,
                    role: role,
                    status: scanStatus,
                    description: contextDesc.trim(),
                    destination: result.destination,
                    priority: result.priority,
                    employee_name: combinedName,
                    syncStatus: 'SYNCED',
                    menu_context: menuContext
                 };

                 setPendingCancelScan({
                    item: cancelItem,
                    tempId: tempId,
                    updateContinuousStatus,
                    recordFail
                 });
                 setShowCancelWarning(true);
                 return; // STOP HERE - wait for user acknowledgement
              }
           } catch (err) {
              console.error("Cancel 7-days check failed:", err);
           }
        }

       // --- STRICT RESI MODE VALIDATION ---
       const isStrictActive = strictResiMode || (localStorage.getItem('kalindo_strict_resi_mode') !== 'false');
       if (isStrictActive || role === UserRole.GUDANG || role === UserRole.OJOL) {
          try {
             const cleanBc = result.barcode.trim().toUpperCase();
             const candidates = getBarcodeCandidates(result.barcode);

             // Helper: Cek apakah barcode terdaftar di Batch Management Admin (Supabase/Firestore)
             const validateBarcodeRegisteredInBatch = async (cands: string[]): Promise<{ isValid: boolean; matchedBarcode?: string }> => {
                // Priority 1-3: Cek PocketBase (batch_items, auto-batch scanned_items, leader_scan_2) secara PARALEL
                try {
                   const [adminRes, movedRes, leaderRes] = await Promise.all([
                      supabase.from('batch_items').select('barcode').in('barcode', cands).limit(1).maybeSingle(),
                      supabase.from('scanned_items').select('id, barcode').in('barcode', cands).ilike('description', '%AUTO-BATCH%').limit(1).maybeSingle(),
                      supabase.from('leader_scan_2').select('id, barcode').in('barcode', cands).limit(1).maybeSingle()
                   ]);

                   if (adminRes.data?.barcode) {
                      return { isValid: true, matchedBarcode: adminRes.data.barcode };
                   }
                   if (movedRes.data?.barcode) {
                      return { isValid: true, matchedBarcode: movedRes.data.barcode || cands[0] };
                   }
                   if (leaderRes.data?.barcode) {
                      return { isValid: true, matchedBarcode: leaderRes.data.barcode || cands[0] };
                   }
                } catch (pbErr) {
                   console.warn("Database batch check notice:", pbErr);
                }

                // Fallback 4: Check Supabase VPS admin_batch_imports secara PARALEL
                try {
                   const sbBatchCheck = Promise.all(
                      cands.map(cand =>
                         supabase
                            .from('admin_batch_imports')
                            .select('id, batch_id')
                            .contains('barcodes', JSON.stringify([cand]))
                            .limit(1)
                            .maybeSingle()
                            .then(res => (res.data ? cand : null))
                            .catch(() => null)
                      )
                   ).then(results => results.find(Boolean) || null);

                   const timeoutRace = new Promise(resolve => setTimeout(() => resolve(null), 300));
                   const matchedAdmin = await Promise.race([sbBatchCheck, timeoutRace]);
                   if (matchedAdmin) {
                      return { isValid: true, matchedBarcode: matchedAdmin };
                   }
                } catch (batchErr) {
                   console.warn("Supabase VPS batch check notice:", batchErr);
                }

                return { isValid: false };
             };

             // 1. Role: PICKER
             if ([UserRole.PICKER, UserRole.PICKER_2].includes(role)) {
                // Check if it has already been scanned by anyone in scanned_items under any picker role
                const { data: scans, error: scansErr } = await supabase
                   .from('scanned_items')
                   .select('employee_name, user_email, role')
                   .in('barcode', candidates)
                   .in('role', [UserRole.PICKER, UserRole.PICKER_2]);

                if (scansErr) throw scansErr;

                if (scans && scans.length > 0) {
                   playError();
                   const ownScan = scans.find(s => s.user_email === userEmail);
                   const displayScan = ownScan || scans[0];
                   const isOwnScan = !!ownScan;
                   const msg = isOwnScan 
                      ? `⛔ DUPLIKAT!\nResi "${result.barcode}" sudah Anda scan.`
                      : `⛔ DUPLIKAT!\nResi "${result.barcode}" sudah diproses oleh ${displayScan.employee_name || 'user lain'}.`;
                   
                   await recordFail('DUPLICATE', isOwnScan ? `Resi sudah Anda scan: ${result.barcode}` : `Resi sudah diproses oleh ${displayScan.employee_name}: ${result.barcode}`);
                   
                   if (isContinuousScan) {
                      updateContinuousStatus('error', isOwnScan ? 'Sudah Anda Scan' : `Oleh: ${displayScan.employee_name}`);
                      triggerCameraToast(msg, 'error');
                   } else {
                      setErrorToast(msg);
                      setTimeout(() => setErrorToast(null), 5000);
                   }
                   return;
                }

                // If not duplicate, check if it is in an active batch
                const batchCheck = await validateBarcodeRegisteredInBatch(candidates);
                if (!batchCheck.isValid) {
                   playError();
                   const msg = `⛔ DITOLAK!\nResi "${result.barcode}" tidak terdaftar di data Batch.`;
                   await recordFail('FORBIDDEN', `Resi tidak terdaftar di Batch: ${result.barcode}`);
                   if (isContinuousScan) {
                      updateContinuousStatus('error', 'Ditolak (Batch)');
                      triggerCameraToast(msg, 'error');
                   } else {
                      setErrorToast(msg);
                      setTimeout(() => setErrorToast(null), 5000);
                   }
                   return;
                }
                if (batchCheck.matchedBarcode) {
                   result.barcode = batchCheck.matchedBarcode;
                }
             }

             // 2. Role: OJOL (Strict Validation: Must exist in Batch Management Admin or Auto-Batch)
             else if (role === UserRole.OJOL) {
                const batchCheck = await validateBarcodeRegisteredInBatch(candidates);
                if (!batchCheck.isValid) {
                   playError();
                   const msg = `⛔ DITOLAK!\nResi "${result.barcode}" tidak terdaftar di Batch Management Admin.`;
                   await recordFail('FORBIDDEN', `Resi tidak terdaftar di Batch Admin: ${result.barcode}`);
                   if (isContinuousScan) {
                      updateContinuousStatus('error', 'Ditolak (Batch Admin)');
                      triggerCameraToast(msg, 'error');
                   } else {
                      setErrorToast(msg);
                      setTimeout(() => setErrorToast(null), 5000);
                   }
                   return;
                }
                if (batchCheck.matchedBarcode) {
                   result.barcode = batchCheck.matchedBarcode;
                }
             }

             // 3. Role: GUDANG (Strict Validation: Must be scanned by Picker first)
             else if (role === UserRole.GUDANG) {
                const { data: pickerData, error: pickerErr } = await supabase
                   .from('scanned_items')
                   .select('barcode')
                   .in('barcode', candidates)
                   .in('role', [UserRole.PICKER, UserRole.PICKER_2])
                   .limit(1)
                   .maybeSingle();

                if (pickerErr) throw pickerErr;
                if (!pickerData) {
                   const batchCheck = await validateBarcodeRegisteredInBatch(candidates);
                   if (!batchCheck.isValid) {
                      playError();
                      const msg = `⛔ DITOLAK!\nResi "${result.barcode}" tidak terdaftar di Batch Management Admin.`;
                      await recordFail('FORBIDDEN', `Resi tidak terdaftar di Batch Admin: ${result.barcode}`);
                      if (isContinuousScan) {
                         updateContinuousStatus('error', 'Ditolak (Batch Admin)');
                         triggerCameraToast(msg, 'error');
                      } else {
                         setErrorToast(msg);
                         setTimeout(() => setErrorToast(null), 5000);
                      }
                      return;
                   }

                   playError();
                   const msg = `⛔ DITOLAK!\nResi "${result.barcode}" belum di-scan oleh Picker.`;
                   await recordFail('FORBIDDEN', `Resi belum di-scan oleh Picker: ${result.barcode}`);
                   if (isContinuousScan) {
                      updateContinuousStatus('error', 'Ditolak (Picker)');
                      triggerCameraToast(msg, 'error');
                   } else {
                      setErrorToast(msg);
                      setTimeout(() => setErrorToast(null), 5000);
                   }
                   return;
                }
             }

             // 4. Role: CHECKER
             else if (role === UserRole.CHECKER) {
                const { data: pickerOjolData, error: pickerOjolErr } = await supabase
                   .from('scanned_items')
                   .select('barcode')
                   .in('barcode', candidates)
                   .in('role', [UserRole.PICKER, UserRole.PICKER_2, UserRole.OJOL])
                   .limit(1)
                   .maybeSingle();

                if (pickerOjolErr) throw pickerOjolErr;
                if (!pickerOjolData) {
                   // Cek apakah barcode terdaftar di Batch Management Admin
                   const batchCheck = await validateBarcodeRegisteredInBatch(candidates);
                   if (!batchCheck.isValid) {
                      playError();
                      const msg = `⛔ DITOLAK!\nResi "${result.barcode}" tidak terdaftar di Batch Management Admin.`;
                      await recordFail('FORBIDDEN', `Resi tidak terdaftar di Batch Admin: ${result.barcode}`);
                      if (isContinuousScan) {
                         updateContinuousStatus('error', 'Ditolak (Batch Admin)');
                         triggerCameraToast(msg, 'error');
                      } else {
                         setErrorToast(msg);
                         setTimeout(() => setErrorToast(null), 5000);
                      }
                      return;
                   }

                   // Barcode terdaftar di Batch tapi belum discan oleh Picker/Ojol
                   playError();
                   if (navigator.vibrate) {
                      try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) {}
                   }
                   const msg = `⛔ DITOLAK!\nResi "${result.barcode}" belum discan oleh Picker/Ojol.`;
                   await recordFail('FORBIDDEN', `Resi belum discan oleh Picker/Ojol: ${result.barcode}`);
                   if (isContinuousScan) {
                      updateContinuousStatus('error', 'Ditolak (Picker/Ojol)');
                      triggerCameraToast(msg, 'error');
                   } else {
                      setErrorToast(msg);
                      setTimeout(() => setErrorToast(null), 5000);
                   }
                   // AUTO-PAUSE & WAJIB ACKNOWLEDGE
                   hasActiveSequenceAlertRef.current = true;
                   setSequenceAlertModal({
                      barcode: result.barcode,
                      role: role,
                      targetRole: 'Picker / Ojol',
                      message: `Resi "${result.barcode}" belum discan oleh Picker / Ojol!`
                   });
                   return;
                }
             }

             // 5. Role: PACKING & PACKING_2
              else if (role === UserRole.PACKING || role === UserRole.PACKING_2) {
                 const checkerActive = isCheckerProfileActive();
                 const requiredRoles = checkerActive 
                    ? [UserRole.CHECKER]
                    : [UserRole.PICKER, UserRole.PICKER_2, UserRole.OJOL, UserRole.CHECKER];
                 const targetStageName = checkerActive ? 'Checker' : 'Picker / Ojol';

                 const { data: prevScanData, error: prevScanErr } = await supabase
                    .from('scanned_items')
                    .select('barcode')
                    .in('barcode', candidates)
                    .in('role', requiredRoles)
                    .limit(1)
                    .maybeSingle();

                 if (prevScanErr) throw prevScanErr;
                 if (!prevScanData) {
                    // Cek apakah barcode terdaftar di Batch Management Admin
                    const batchCheck = await validateBarcodeRegisteredInBatch(candidates);
                    if (!batchCheck.isValid) {
                       playError();
                       const msg = `⛔ DITOLAK!\nResi "${result.barcode}" tidak terdaftar di Batch Management Admin.`;
                       await recordFail('FORBIDDEN', `Resi tidak terdaftar di Batch Admin: ${result.barcode}`);
                       if (isContinuousScan) {
                          updateContinuousStatus('error', 'Ditolak (Batch Admin)');
                          triggerCameraToast(msg, 'error');
                       } else {
                          setErrorToast(msg);
                          setTimeout(() => setErrorToast(null), 5000);
                       }
                       return;
                    }

                    playError();
                    if (navigator.vibrate) {
                       try { navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) {}
                    }
                    const msg = `⛔ DITOLAK!\nResi "${result.barcode}" belum discan oleh ${targetStageName}.`;
                    await recordFail('FORBIDDEN', `Resi belum discan oleh ${targetStageName}: ${result.barcode}`);
                    if (isContinuousScan) {
                       updateContinuousStatus('error', `Ditolak (${checkerActive ? 'Checker' : 'Picker'})`);
                       triggerCameraToast(msg, 'error');
                    } else {
                       setErrorToast(msg);
                       setTimeout(() => setErrorToast(null), 5000);
                    }
                    // AUTO-PAUSE & WAJIB ACKNOWLEDGE
                    hasActiveSequenceAlertRef.current = true;
                    setSequenceAlertModal({
                       barcode: result.barcode,
                       role: role,
                       targetRole: targetStageName,
                       message: `Resi "${result.barcode}" belum discan oleh ${targetStageName}!`
                    });
                    return;
                 }
              }
          } catch (err: any) {
             playError();
             const msg = "Gagal Validasi Resi Ketat (Network)";
             recordFail('NETWORK', msg);
             if (isContinuousScan) {
                updateContinuousStatus('error', 'Network Error');
                setCriticalNetworkError("Gagal Validasi Resi (Koneksi Bermasalah).\nData TIDAK tersimpan.\nSilahkan scan ulang lagi.");
             } else {
                setCriticalNetworkError("Gagal Validasi Resi (Koneksi Bermasalah).\nData TIDAK tersimpan.\nSilahkan scan ulang lagi.");
             }
             return;
          }
       }

       // --- VALIDATION: FORBIDDEN SYMBOLS ---
      // Strict symbol check ONLY for SORTIR (SORTIR_BATCH is excluded like PICKER)
      if ([UserRole.SORTIR].includes(role)) {
         const hasForbiddenSymbol = forbiddenSymbols.some(symbol => result.barcode.includes(symbol));
         const hasSpecialChars = /[^a-zA-Z0-9\-\_\/\s]/.test(result.barcode);

         if (hasForbiddenSymbol || hasSpecialChars) {
            playError();
            const msg = hasForbiddenSymbol ? "Barcode mengandung simbol terlarang!" : "Format Barcode Salah!";
            await recordFail('FORBIDDEN', msg); // Record Fail

            if (isContinuousScan) {
               updateContinuousStatus('error', 'Ditolak');
               triggerCameraToast(`${msg}\nData ditolak sistem.`, 'error');
            } else {
               setErrorToast(`${msg}\nScan ulang karena data mengandung simbol terlarang.`);
               setTimeout(() => setErrorToast(null), 4000);
            }
            return;
         }
      }

      // 2. Check Global Duplicate (Supabase) - Strict Online
      // SKIP DUPLICATE CHECK FOR SORTIR_BATCH - Dibutuhkan untuk sistem packing list baru
      // NOTE: Duplicate check MUST run BEFORE cancel check, so that re-scanning a
      // cancelled barcode is properly rejected as duplicate instead of being saved again.
      if (role !== UserRole.SORTIR_BATCH) {
         try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // DYNAMIC CLIENT
            const targetClient = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? supabaseBundling : supabase;
            const targetTable = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? 'outbound_scans' : (currentView === 'SPECIAL_SCAN' ? 'admin_special_scans' : 'scanned_items');

            let query = targetClient
               .from(targetTable)
               .select('employee_name')
               .eq('barcode', result.barcode)
               .eq('role', role)
               .limit(1);

            // SPECIAL LOGIC FOR PICKER/PICKER_2: Only check if scanned by the SAME user (team is allowed)
            if ([UserRole.PICKER, UserRole.PICKER_2].includes(role)) {
               query = query.eq('user_email', userEmail);
            }

            // SPECIAL LOGIC FOR GUDANG: Allow duplicates across different sub-menus
            // Now using DB Column 'menu_context' instead of description match
            if (role === UserRole.GUDANG) {
               if (currentView === 'PENDING') {
                  query = query.eq('menu_context', 'PENDING');
               } else if (currentView === 'READY') {
                  query = query.eq('menu_context', 'READY');
               } else if (currentView === 'REPORT') {
                  query = query.eq('menu_context', 'REPORT');
               } else {
                  // For default SCAN view (Potong Stok) - though it's disabled now
                  query = query.eq('menu_context', 'SCAN');
               }
            } else if (![UserRole.PICKER, UserRole.PICKER_2].includes(role)) {
               // For other roles (except Picker which doesn't enforce menu_context strictly or uses DEFAULT)
               // But since the unique index is (barcode, role, date, menu_context),
               // we should ideally query with the same expected context.
               // Existing items might be null, so we might need 'is', 'null' or just ignore if we trust DB constraint.
               // Best to check 'DEFAULT' as that's what we insert.
               query = query.eq('menu_context', 'DEFAULT');
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error; // If DB check fails, we treat it as Network Error

            if (data) {
               playError();
               const isOwnScan = [UserRole.PICKER, UserRole.PICKER_2].includes(role);
               const msg = isOwnScan ? `Duplicate: Anda sudah scan resi ini` : `Duplicate: Processed by ${data.employee_name}`;
               await recordFail('DUPLICATE', msg); // Await the save

               if (isContinuousScan) {
                  updateContinuousStatus('error', isOwnScan ? 'Sudah Anda Scan' : `Oleh: ${data.employee_name}`);
                  triggerCameraToast(isOwnScan ? `Duplicate: Resi ${result.barcode} sudah Anda scan.` : `Duplicate Scan: ${result.barcode}\nsudah diproses oleh ${data.employee_name || 'Unknown'}.`, 'error');
               } else {
                  setErrorToast(isOwnScan ? `Duplicate Scan: ${result.barcode}\nsudah Anda scan.` : `Duplicate Scan: ${result.barcode}\nalready processed by ${data.employee_name || 'Unknown'}.`);
                  setTimeout(() => setErrorToast(null), 4000);
               }
               return;
            }
         } catch (err: any) {
            console.error("Duplicate check failed (Network):", err);
            playError();
            const msg = "Gagal Cek Duplikat (Network)";
            recordFail('NETWORK', msg); // Keep as Network fail

            if (isContinuousScan) {
               updateContinuousStatus('error', 'Network Error');
               setCriticalNetworkError("Gagal Cek Duplikat (Koneksi Bermasalah).\nData TIDAK tersimpan.\nSilahkan scan ulang lagi data yang gagal scan tsb.");
            } else {
               setCriticalNetworkError("Gagal Cek Duplikat (Koneksi Bermasalah).\nData TIDAK tersimpan.\nSilahkan scan ulang lagi data yang gagal scan tsb.");
            }
            return; // STOP HERE if check fails
         }
      }

      // --- VALIDATION: CANCELLED ORDERS (SORTIR & PACKING only) ---
      // NOTE: This runs AFTER duplicate check, so re-scanning a cancelled barcode
      // that was already saved will be rejected as duplicate above.
      if ([UserRole.SORTIR, UserRole.SORTIR_BATCH].includes(role)) {
         const isCancelledOrder = cancelledSet.has(result.barcode.toUpperCase());

         if (isCancelledOrder) {
            // Generate context and item early to prepare for saving after acknowledgement
            let contextDesc = `[CANCEL] ${result.description}`;
            let scanStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';
            let menuContext = 'DEFAULT';

            if (role === UserRole.GUDANG) {
               if (currentView === 'PENDING') { menuContext = 'PENDING'; scanStatus = 'PENDING'; }
               else if (currentView === 'REPORT') menuContext = 'REPORT';
               else menuContext = 'SCAN';
            }

            const uniqueId = generateUniqueScanId();
            const cancelItem: ScannedItem = {
               id: uniqueId,
               timestamp: Date.now(),
               barcode: result.barcode,
               order_id: result.order_id,
               role: role,
               status: scanStatus,
               description: contextDesc,
               destination: result.destination,
               priority: result.priority,
               employee_name: combinedName,
               syncStatus: 'SYNCED',
               menu_context: menuContext
            };
            // Store pending cancel scan and show warning
            setPendingCancelScan({
               item: cancelItem,
               tempId: tempId,
               updateContinuousStatus,
               recordFail
            });
            setShowCancelWarning(true);

            // Don't play error sound for cancel warning
            return; // STOP HERE - wait for user acknowledgement
         }
      }

      // --- PICKER & SORTIR_BATCH: CHECK BATCH TRIGGER FIRST (before modal) ---
      if ([UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR_BATCH].includes(role) && navigator.onLine) {
         const batchTriggered = await checkForBatchTrigger(result.barcode);
         if (batchTriggered) {
            // Batch detected & auto-processed! Skip modal entirely.
            if (tempId) {
               setRecentScans(prev => prev.map(s =>
                  s.id === tempId ? { ...s, status: 'success', message: 'Auto-Batch' } : s
               ));
            }
            return;
         }
      }

      // --- PICKER & SORTIR_BATCH SPECIAL FLOW: Show Page Selection Modal ---
      if ([UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR_BATCH].includes(role)) {
         // Cek apakah pengaturan on/off modal halaman aktif
         const currentProfileConfig = profileConfig.find(p => p.role === role);
         const useModal = currentProfileConfig?.use_page_modal !== false; // Default true jika tidak ada

         if (useModal) {
            // Store pending scan data and show modal
            setPendingPickerScan({
            barcode: result.barcode,
            description: result.description,
            destination: result.destination,
            priority: result.priority,
            tempId: tempId,
            order_id: result.order_id
         });
         setSelectedPage(1); // Reset to page 1
         setIsPickerModalOpen(true);

         // For continuous mode, mark as pending (will be updated after confirmation)
         if (tempId) {
            // Note: using 'loading' status which is already defined in recentScans type
         }
         return; // STOP HERE - wait for modal confirmation
         }
         // Jika useModal = false, lewati modal dan biarkan alur berlanjut ke bawah
         // Sistem otomatis akan menggunakan destinasi 'Page X (Auto)' yang di-handle di bagian bawah
      }

      // Determine context based on current view
      let contextDesc = result.description;
      let scanStatus: 'COMPLETED' | 'PENDING' = 'COMPLETED';

      if (role === UserRole.GUDANG) {
         if (currentView === 'PENDING') {
            contextDesc = `[PENDING] ${result.description}`;
            scanStatus = 'PENDING';
         }
         if (currentView === 'READY') {
            contextDesc = `[READY] ${result.description}`;
            scanStatus = 'COMPLETED';
         }
         if (currentView === 'REPORT') contextDesc = `[REPORT] ${result.description}`;
         if (currentView === 'BUNDLING') contextDesc = `[BUNDLING] ${result.description}`;
         if (currentView === 'CANCEL') contextDesc = `[CANCEL] ${result.description}`;
      }

      // Determine Menu Context for DB Validation
      let menuContext = 'DEFAULT';
      if (role === UserRole.GUDANG) {
         if (currentView === 'PENDING') menuContext = 'PENDING';
         else if (currentView === 'READY') menuContext = 'READY';
         else if (currentView === 'REPORT') menuContext = 'REPORT';
         else if (currentView === 'BUNDLING') menuContext = 'BUNDLING';
         else if (currentView === 'CANCEL') menuContext = 'CANCEL';
         else menuContext = 'SCAN';
      } else if (role === UserRole.LEADER) {
         if (currentView === 'SCAN_2') menuContext = 'SCAN_2';
         else menuContext = 'DEFAULT';
      }

      // Generate unique ID locally (timestamp + random) to prevent collision
      const uniqueId = generateUniqueScanId();

      const newItem: ScannedItem = {
         id: uniqueId,
         timestamp: Date.now(),
         barcode: result.barcode,
         order_id: result.order_id,
         role: role,
         status: scanStatus,
         description: contextDesc,
         destination: result.destination,
         priority: result.priority,
         employee_name: combinedName,
         syncStatus: 'SYNCED',
         menu_context: menuContext,
         report_keterangan: result.report_keterangan || undefined,
         report_msku: result.report_msku || undefined,
         report_qty: result.report_qty || undefined,
         ...((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) ? {
            scan_mode: scanMode,
            team_members: scanMode === 'TIM' ? teamMembers : []
         } : {})
      };

      // --- CONVERT PENDING TO READY (GUDANG ONLY) ---
      if (role === UserRole.GUDANG && currentView === 'READY') {
         const cleanBc = result.barcode.trim().toUpperCase();
         let targetPendingId: string | null = null;
         let targetPendingDesc: string = '';

         // 1. Check local in-memory items first
         const localPending = items.find(i => i.barcode.trim().toUpperCase() === cleanBc && i.role === UserRole.GUDANG && (i.status === 'PENDING' || i.menu_context === 'PENDING'));
         if (localPending) {
            targetPendingId = localPending.id;
            targetPendingDesc = localPending.description || '';
         } else if (navigator.onLine) {
            // 2. Query Supabase DB directly across ALL users & dates!
            try {
               const { data: dbPending } = await supabase
                  .from('scanned_items')
                  .select('id, description')
                  .eq('barcode', cleanBc)
                  .eq('role', UserRole.GUDANG)
                  .or('status.eq.PENDING,menu_context.eq.PENDING')
                  .limit(1)
                  .maybeSingle();

               if (dbPending) {
                  targetPendingId = dbPending.id;
                  targetPendingDesc = dbPending.description || '';
               }
            } catch (err) {
               console.warn("Error querying dbPending:", err);
            }
         }

         if (targetPendingId) {
            const updatedDesc = targetPendingDesc ? targetPendingDesc.replace('[PENDING] ', '[READY] ') : '[READY] Manual Entry';
            try {
               await supabase
                  .from('scanned_items')
                  .update({
                     status: 'COMPLETED',
                     menu_context: 'READY',
                     description: updatedDesc,
                     employee_name: combinedName
                  })
                  .eq('id', targetPendingId);
               replicateBackupUpdate('scanned_items', {
                  status: 'COMPLETED',
                  menu_context: 'READY',
                  description: updatedDesc,
                  employee_name: combinedName
               }, { column: 'id', value: targetPendingId });
            } catch (e) {
               console.error("Failed to convert pending item status in Supabase:", e);
            }

            setItems(prev => prev.map(item => {
               if (item.id === targetPendingId) {
                  return {
                     ...item,
                     status: 'COMPLETED',
                     menu_context: 'READY',
                     description: updatedDesc,
                     employee_name: combinedName
                  };
               }
               return item;
            }));

            playSuccess();
            if (isContinuousScan) {
               updateContinuousStatus('success', 'Status READY');
               triggerCameraToast(`SUCCESS: Resi ${result.barcode}\nberhasil diubah dari PENDING menjadi READY!`, 'success');
            } else {
               setSuccessToast(`SUCCESS: Resi ${result.barcode}\nberhasil diubah dari PENDING menjadi READY!`);
               setTimeout(() => setSuccessToast(null), 4000);
            }
            return; // STOP HERE! Do NOT insert a duplicate row!
         }
      }

      // SAVE DATA
      await addScan(newItem, tempId, updateContinuousStatus, recordFail);

      // --- BATCH AUTO-SCAN TRIGGER (SORTIR ONLY) ---
      if (role === UserRole.SORTIR && navigator.onLine) {
         checkForBatchTrigger(result.barcode);
      }
   };

   // --- PICKER: Confirm Page Selection and Save ---
   const handlePickerConfirm = async () => {
      if (!pendingPickerScan) return;

      const { barcode, description, destination, priority, tempId, order_id } = pendingPickerScan;

      // Generate unique ID
      const uniqueId = generateUniqueScanId();

      // Create description with page number
      const contextDesc = `Page ${selectedPage} - ${description}`;

      const combinedName = (scanMode === 'TIM' && teamMembers.length > 0)
         ? Array.from(new Set([employeeName, ...teamMembers])).join(', ')
         : employeeName;

      const newItem: ScannedItem = {
         id: uniqueId,
         timestamp: Date.now(),
         barcode: barcode,
         order_id: order_id,
         role: role,
         status: 'COMPLETED',
         description: contextDesc,
         destination: `Page ${selectedPage}`,
         priority: priority,
         employee_name: combinedName,
         ...(scanMode === 'TIM' ? {
            scan_mode: scanMode,
            team_members: teamMembers
         } : {}),
         syncStatus: 'SYNCED',
         menu_context: 'DEFAULT'
      };

      // Close modal
      setIsPickerModalOpen(false);
      setPendingPickerScan(null);

      // Helper functions for save
      const updateContinuousStatus = (status: 'error' | 'success', msg?: string) => {
         if (tempId) {
            setRecentScans(prev => prev.map(s =>
               s.id === tempId ? { ...s, status: status, message: msg } : s
            ));
         }
      };

      const recordFail = async (reason: 'DUPLICATE' | 'FORBIDDEN' | 'NETWORK' | 'OTHER', msg: string) => {
         const uniqueFailId = generateUniqueScanId();
         const failedItem: FailedItem = {
            id: uniqueFailId,
            timestamp: Date.now(),
            barcode: barcode,
            role: role,
            status: 'ERROR',
            description: description,
            destination: destination,
            priority: priority,
            employee_name: employeeName,
            failReason: reason,
            failMessage: msg
         };
         setFailedItems(prev => [failedItem, ...prev]);
      };

      // Save to database
      await addScan(newItem, tempId, updateContinuousStatus, recordFail);

      // --- BATCH AUTO-SCAN TRIGGER (PICKER) ---
      // Dipindahkan ke processScanResult SEBELUM modal muncul.
      // Tidak perlu dipanggil lagi di sini.
   };

   // --- PICKER: Cancel Modal ---
   const handlePickerCancel = () => {
      if (pendingPickerScan?.tempId) {
         // Update continuous mode status to cancelled
         setRecentScans(prev => prev.map(s =>
            s.id === pendingPickerScan.tempId ? { ...s, status: 'error', message: 'Dibatalkan' } : s
         ));
      }
      setIsPickerModalOpen(false);
      setPendingPickerScan(null);
   };

   // --- LEADER SCAN 2: Handle Assignment Submit ---
   const handleAssignmentSubmit = async () => {
      if (assignmentMode === 'INDIVIDU' && !assignmentPicker) {
         setErrorToast("Pilih Picker terlebih dahulu!");
         setTimeout(() => setErrorToast(null), 3000);
         return;
      }
      if (assignmentMode === 'TIM' && assignmentTeam.length === 0) {
         setErrorToast("Pilih minimal 1 anggota tim!");
         setTimeout(() => setErrorToast(null), 3000);
         return;
      }

      setIsAssigning(true);
      try {
         const assignees = assignmentMode === 'INDIVIDU' ? [assignmentPicker] : assignmentTeam;
         const assigneeString = assignees.join(', ');

         const payload = {
            barcode: pendingAssignmentBarcode,
            assignment_mode: assignmentMode,
            assignees: assignees,
            leader_name: selectedLeaderProfile || employeeName,
            status: 'ASSIGNED',
            timestamp: Date.now(),
            scan_type: leaderScanType,
            leader_profile: selectedLeaderProfile || 'UNKNOWN',
            date: new Date().toLocaleDateString('id-ID')
         };

         // UPSERT TO MAIN TABLE (leader_scan_2) with retry
         let { error } = await supabase
            .from('leader_scan_2')
            .upsert([payload], { onConflict: 'barcode' });

         if (error) {
            // Retry once if network/statement timeout occurred
            const retryRes = await supabase
               .from('leader_scan_2')
               .upsert([payload], { onConflict: 'barcode' });
            error = retryRes.error;
         }

         // BACKUP: UPSERT TO DEDICATED LEADER SUPABASE (ymolrxscthxxtlmnxmob)
         try {
            const bRes = await supabaseLeader
               .from('leader_scan_2')
               .upsert([payload], { onConflict: 'barcode' });
            if (bRes.error) {
               await supabaseLeader
                  .from('leader_scan_2')
                  .upsert([payload], { onConflict: 'barcode' });
            }

            // ALSO SYNC TO SCANNED_ORDERS
            try {
               const cleanLeader = (selectedLeaderProfile || employeeName || '').toLowerCase().includes('akmal') ? 'akmal' : 'ricky';
               const scanDateIso = new Date().toISOString().split('T')[0];
               await supabaseLeader
                  .from('scanned_orders')
                  .upsert({
                     barcode: pendingAssignmentBarcode.trim(),
                     leader: cleanLeader,
                     scan_date: scanDateIso
                  }, { onConflict: 'barcode,scan_date,leader', ignoreDuplicates: true });
            } catch (scannedOrdersErr) {
               console.warn("scanned_orders sync notice (non-blocking):", scannedOrdersErr);
            }

            // Also replicate to hot-swap secondary backup if active
            replicateBackupUpsert('leader_scan_2', payload, 'barcode');
         } catch (backupError) {
            console.error('Backup upsert error (non-blocking):', backupError);
         }

         if (error) {
            triggerCameraToast("Gagal Assign/Barcode sudah ada di DB", 'error');
            console.error(error);
         } else {
            // Success
            triggerCameraToast("Berhasil di-assign!", 'success');

            // Map to local scanned item structure so it renders
            const uniqueId = generateUniqueScanId();
            const newItem: ScannedItem = {
               id: uniqueId,
               timestamp: Date.now(),
               barcode: pendingAssignmentBarcode,
               role: role,
               status: 'COMPLETED',
               description: `Assign: ${assigneeString} (${assignmentMode})`,
               destination: 'ASSIGNED',
               priority: 'NORMAL',
               employee_name: employeeName,
               syncStatus: 'SYNCED',
               menu_context: 'SCAN_2', // Critical for rendering in SCAN_2
               assignees: assignees // Critical for real-time load analytics
            } as any;

            setItems(prev => [newItem, ...prev]);

            // If continuous scan was active, we may want to keep the UI clean, 
            // but we already marked it 'Wait Assign'. Let's mark it success.
            if (isContinuousScan) {
               setRecentScans(prev => prev.map(s =>
                  s.code === pendingAssignmentBarcode ? { ...s, status: 'success', message: 'Assigned' } : s
               ));
            }
         }
      } catch (err) {
         console.error(err);
         triggerCameraToast("Error saat menyimpan assignment", 'error');
      } finally {
         setIsAssigning(false);
         setIsAssignmentModalOpen(false);
         setPendingAssignmentBarcode('');
         setAssignmentSearchTerm('');
      }
   };

   // --- LEADER SCAN 2: Handle Assignment Delete ---
   const handleAssignmentDeleteConfirm = (barcode: string) => {
      setPendingDeleteBarcode(barcode);
      setIsDeletePinModalOpen(true);
   };

   // Expose to window for ScanCard access
   useEffect(() => {
      (window as any).triggerAssignmentDelete = handleAssignmentDeleteConfirm;
      return () => { delete (window as any).triggerAssignmentDelete; };
   }, []);

   const handleAssignmentDeleteSubmit = async () => {
      if (!pendingDeleteBarcode) return;

      setIsDeleting(true);
      try {
         // DELETE FROM MAIN SUPABASE
         const { error } = await supabase
            .from('leader_scan_2')
            .delete()
            .eq('barcode', pendingDeleteBarcode);

         // BACKUP: DELETE FROM DEDICATED LEADER SUPABASE (ymolrxscthxxtlmnxmob)
         try {
            await supabaseLeader
               .from('leader_scan_2')
               .delete()
               .eq('barcode', pendingDeleteBarcode);

            await supabaseLeader
               .from('scanned_orders')
               .delete()
               .eq('barcode', pendingDeleteBarcode);

            // Also replicate to hot-swap secondary backup if active
            replicateBackupDelete('leader_scan_2', { column: 'barcode', value: pendingDeleteBarcode });
         } catch (backupErr) {
            console.error("Backup delete error (non-blocking):", backupErr);
         }

         if (error) {
            setErrorToast("Gagal menghapus data dari server");
            setTimeout(() => setErrorToast(null), 3000);
            console.error(error);
         } else {
            // Success
            setSuccessToast("Data berhasil dihapus!");
            setTimeout(() => setSuccessToast(null), 3000);
            // Remove from local items
            setItems(prev => prev.filter(i => i.barcode !== pendingDeleteBarcode));
            setLeaderOrdersData(prev => prev.filter(o => o.barcode !== pendingDeleteBarcode));
         }
      } catch (err) {
         console.error(err);
         setErrorToast("Error saat menghapus data");
         setTimeout(() => setErrorToast(null), 3000);
      } finally {
         setIsDeleting(false);
         setIsDeletePinModalOpen(false);
         setPendingDeleteBarcode(null);
      }
   };

   // --- LEADER SCAN 2: Handle Assignment Type Switch ---
   const handleAssignmentSwitchConfirm = (barcode: string) => {
      const currentOrder = leaderOrdersData.find(o => o.barcode === barcode);
      if (currentOrder) {
         const barcodeUpper = barcode.toUpperCase();
         if (currentOrder.scan_type === 'PRETELAN') {
            // Pindah ke SATUAN -> Wajib 'SATUAN'
            if (!barcodeUpper.includes('SATUAN')) {
               setErrorToast("Gagal! Data ini ditujukan untuk Pretelan, bukan Satuan (tidak ada tulisan SATUAN di barcode).");
               setTimeout(() => setErrorToast(null), 5000);
               return;
            }
         } else if (currentOrder.scan_type === 'SATUAN') {
            // Pindah ke PRETELAN -> Tidak boleh ada 'SATUAN'
            if (barcodeUpper.includes('SATUAN')) {
               setErrorToast("Gagal! Data ini ditujukan untuk Satuan (barcode mengandung kata SATUAN), tidak bisa masuk Pretelan.");
               setTimeout(() => setErrorToast(null), 5000);
               return;
            }
         }
      }

      setPendingSwitchBarcode(barcode);
      setIsSwitchPinModalOpen(true);
   };

   const handleAssignmentSwitchSubmit = async () => {
      if (!pendingSwitchBarcode) return;
      
      const currentOrder = leaderOrdersData.find(o => o.barcode === pendingSwitchBarcode);
      if (!currentOrder) {
         setIsSwitchPinModalOpen(false);
         setPendingSwitchBarcode(null);
         return;
      }

      setIsSwitchingType(true);
      const newType = currentOrder.scan_type === 'PRETELAN' ? 'SATUAN' : 'PRETELAN';

      try {
         // UPDATE MAIN SUPABASE
         const { error } = await supabase
            .from('leader_scan_2')
            .update({ scan_type: newType })
            .eq('barcode', pendingSwitchBarcode);

         // BACKUP UPDATE TO DEDICATED LEADER SUPABASE (ymolrxscthxxtlmnxmob)
         try {
            await supabaseLeader
               .from('leader_scan_2')
               .update({ scan_type: newType })
               .eq('barcode', pendingSwitchBarcode);

            // Also replicate to hot-swap secondary backup if active
            replicateBackupUpdate('leader_scan_2', { scan_type: newType }, { column: 'barcode', value: pendingSwitchBarcode });
         } catch (backupErr) {
            console.error(backupErr);
         }

         if (error) {
            setErrorToast("Gagal memindahkan tipe data");
            setTimeout(() => setErrorToast(null), 3000);
         } else {
            setSuccessToast(`Berhasil dipindah ke ${newType}`);
            setTimeout(() => setSuccessToast(null), 3000);
            
            // Refetch to reflect changes globally
            fetchData();
            // Optimistic apply to leaderOrdersData for instant UI response (realtime search)
            setLeaderOrdersData(prev => prev.map(o => o.barcode === pendingSwitchBarcode ? { ...o, scan_type: newType } : o));
         }
      } catch (err) {
         setErrorToast("Terjadi kesalahan sistem");
         setTimeout(() => setErrorToast(null), 3000);
      } finally {
         setIsSwitchingType(false);
         setIsSwitchPinModalOpen(false);
         setPendingSwitchBarcode(null);
      }
   };

   const toggleAssignmentTeam = (name: string) => {
      setAssignmentTeam(prev =>
         prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
   };

   const selectAllAssignmentTeam = () => {
      if (assignmentTeam.length === pickersList.length) {
         setAssignmentTeam([]); // Deselect all
      } else {
         setAssignmentTeam(pickersList.map(p => p.name)); // Select all
      }
   };


   // --- CANCEL WARNING: Acknowledge and continue saving ---
    const handleCancelWarningAcknowledge = async () => {
       if (!pendingCancelScan) return;

       const { item, tempId, updateContinuousStatus, recordFail } = pendingCancelScan;

       // Close warning modal
       setShowCancelWarning(false);
       setPendingCancelScan(null);

       // If Checker, DO NOT save data
       if (role === UserRole.CHECKER) {
          if (isContinuousScan) {
             updateContinuousStatus('error', 'Cancel Blocked');
          }
          return;
       }

       // Play success sound since we are proceeding
       playSuccess();

       // Continue saving the item with [CANCEL] label
       await addScan(item, tempId, updateContinuousStatus, recordFail);
    };

    // --- AUTO-SYNC PREVIOUS SCANS DATES ---
    const syncPreviousScansDates = async (barcode: string, currentTimestamp: number) => {
       try {
          // Find ALL older scans for the same barcode (any role, any date)
          // that have a timestamp earlier than the current scan
          const { data: previousScans, error } = await supabase
             .from('scanned_items')
             .select('id, timestamp, description')
             .eq('barcode', barcode)
             .lt('timestamp', currentTimestamp);

          if (error) throw error;
          if (!previousScans || previousScans.length === 0) return;

          // Target date from the current (latest) scan
          const curDate = new Date(currentTimestamp);
          const targetYear = curDate.getFullYear();
          const targetMonth = curDate.getMonth();
          const targetDay = curDate.getDate();
          const scanDateStr = `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`;

          for (const scan of previousScans) {
             const origDate = new Date(scan.timestamp);

             // Skip if already on the same calendar date
             if (origDate.getFullYear() === targetYear && origDate.getMonth() === targetMonth && origDate.getDate() === targetDay) {
                continue;
             }

             // Record original date marker in description (only once)
             const dateStr = `${origDate.getDate().toString().padStart(2, '0')}/${(origDate.getMonth() + 1).toString().padStart(2, '0')}/${origDate.getFullYear()}`;
             let newDesc = scan.description || '';
             if (!newDesc.includes('[Asal Tgl:')) {
                newDesc = `[Asal Tgl: ${dateStr}] ${newDesc}`;
             }

             // Preserve original time-of-day, only change the date portion
             const newDate = new Date(targetYear, targetMonth, targetDay, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds(), origDate.getMilliseconds());
             const newTimestamp = newDate.getTime();

             await supabase
                .from('scanned_items')
                .update({
                   timestamp: newTimestamp,
                   scan_date: scanDateStr,
                   description: newDesc.trim()
                })
                .eq('id', scan.id);
          }
       } catch (err) {
          console.error("Failed to sync previous scans dates:", err);
       }
    };

   // UPDATED: Strict Online Add
   const addScan = async (
      item: ScannedItem,
      tempId: number | undefined,
      updateContinuousStatus: (status: 'error' | 'success', msg?: string) => void,
      recordFail: (reason: 'DUPLICATE' | 'FORBIDDEN' | 'NETWORK' | 'OTHER', msg: string) => Promise<void>
   ) => {

      // Strict Online Check
      if (!navigator.onLine) {
         playError();
         recordFail('NETWORK', 'Internet Putus saat Menyimpan');
         if (isContinuousScan) updateContinuousStatus('error', 'Offline');
         setCriticalNetworkError("Gagal Simpan: Internet Putus.\nScan Ulang!\nSilahkan scan ulang lagi data yang gagal scan tsb.");
         return;
      }

      try {
         // DYNAMIC CLIENT FOR INSERT
         // Note: If menu_context is BUNDLING, it should naturally be using Bundling Client if logic above is correct
         // But we explicitly check currentView or Role context
         const targetClient = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? supabaseBundling : supabase;
         const targetTable = (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') ? 'outbound_scans' : (currentView === 'SPECIAL_SCAN' ? 'admin_special_scans' : 'scanned_items');

         let insertData: any = {};
         
         if (targetTable === 'admin_special_scans') {
            insertData = {
               barcode: item.barcode,
               admin_name: employeeName
            };
         } else {
            insertData = {
               id: item.id,
               timestamp: item.timestamp,
               barcode: item.barcode,
               role: item.role,
               description: item.description,
               status: item.status,
               employee_name: item.employee_name,
               user_email: userEmail,
               menu_context: item.menu_context,
               destination: item.destination || '',
               scan_mode: item.scan_mode,
               ...(targetTable === 'scanned_items' ? {
                  report_keterangan: item.report_keterangan || null,
                  report_msku: item.report_msku || null,
                  report_qty: item.report_qty || null,
                  order_id: item.order_id || null
               } : {}),
               ...(targetTable === 'outbound_scans' ? { qty: 1 } : {})
            };
         }

         const { error } = await targetClient.from(targetTable).insert([insertData]);

         if (!error) {
            // Dual-Write ke Supabase Cadangan (Non-blocking asynchronous background replica)
            replicateBackupInsert(targetTable, insertData);
         }

         if (!error && item.menu_context === 'CANCEL') {
            try {
               // Also insert into cancelled_orders so Admin sees it in Total Cancel Data
               const cancelPayload = {
                  barcode: item.barcode.trim().toUpperCase(),
                  is_active: true,
                  cancelled_at: new Date().toISOString()
               };
               await supabase.from('cancelled_orders').upsert([cancelPayload], { onConflict: 'barcode' });
               replicateBackupUpsert('cancelled_orders', [cancelPayload], 'barcode');
            } catch (cancelErr) {
               console.error("Failed to insert into cancelled_orders:", cancelErr);
            }
         }

         if (error) {
            // Handle Unique Violation (Duplicate)
            if (error.code === '23505') {
               // PICKER & SORTIR_BATCH diizinkan duplikat
               if ([UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR_BATCH].includes(role)) {
                  console.log("PICKER allowed duplicate - Ignoring DB constraint");
                  // Untuk PICKER: abaikan error duplikat, tetap lanjut sebagai sukses
                  playSuccess();
                  setItems(prev => [item, ...prev]);
                  if (isContinuousScan) {
                     updateContinuousStatus('success', 'OK');
                  }
                  return;
               }

               // Checker Skip Duplicate Logic
               if (role === UserRole.CHECKER && skipCheckerDuplicate) {
                  console.log("CHECKER allowed duplicate (Skipped Warning) - Ignoring DB constraint");
                  playSuccess();
                  setItems(prev => [item, ...prev]);
                  if (isContinuousScan) {
                     updateContinuousStatus('success', 'OK');
                  }
                  return;
               }

               console.warn("Duplicate detected by DB Constraint");
               playError();
               recordFail('DUPLICATE', 'Double Scan (Tertangkap Database)');

               if (isContinuousScan) {
                  updateContinuousStatus('error', 'Double Scan');
                  triggerCameraToast(`Duplicate: ${item.barcode}`, 'error');
               } else {
                  setErrorToast(`Duplicate Scan: ${item.barcode}\nData sudah ada di database.`);
                  setTimeout(() => setErrorToast(null), 4000);
               }
               return;
            }
            throw error;
         }

         // SUCCESS!
         playSuccess();
         
         // Trigger date sync for previous roles asynchronously
         if (targetTable === 'scanned_items') {
            syncPreviousScansDates(item.barcode, item.timestamp).catch(console.error);
         }

         // Update Local List (Optimistic or Confirmed)
         setItems(prev => [item, ...prev]);

         if (isContinuousScan) {
            updateContinuousStatus('success', 'OK');
         }

      } catch (err: any) {
         console.error("Strict Online save failed:", err);
         playError();

         // Record as Network Failure in Failed List
         // DO NOT add to main list.
         recordFail('NETWORK', err.message || 'Server Save Failed');

         if (isContinuousScan) {
            updateContinuousStatus('error', 'Gagal Simpan');
         }

         setCriticalNetworkError("Gagal Simpan ke Server (Error Database/Network).\nSilahkan scan ulang lagi data yang gagal scan tsb.");
      }
   };

   const toggleSound = () => setIsSoundEnabled(prev => !prev);
   const isGudang = role === UserRole.GUDANG;
   const isLeader = role === UserRole.LEADER;
   const hasSidebar = isGudang || isLeader;

   const displayedItems = useMemo(() => {
      if (isLeader) {
         if (currentView === 'SCAN_2' || currentView === 'SCAN_2_HISTORY') {
            return items.filter(i => i.menu_context === 'SCAN_2' && i.employee_name === employeeName);
         }
         if (currentView === 'LEADER_PENDING' || currentView === 'LEADER_PENDING_HISTORY') {
            return items.filter(i => i.menu_context === 'LEADER_PENDING');
         }
         if (currentView === 'SCAN' || currentView === 'HISTORY') {
            return items.filter(i => i.menu_context !== 'SCAN_2' && i.menu_context !== 'LEADER_PENDING');
         }
      }

      if (!isGudang) return items; // Regular roles show all

      const tagScan = '[SCAN]';
      const tagPending = '[PENDING]';
      const tagReport = '[REPORT]';
      const tagBundling = '[BUNDLING]';

      if (currentView === 'SCAN' || currentView === 'SCAN_HISTORY') {
         // Show only [SCAN] OR items without special tags (legacy/default)
         return items.filter(i =>
            (i.menu_context === 'SCAN' || i.description?.includes(tagScan)) ||
            (!i.description?.includes(tagPending) && !i.description?.includes(tagReport) && !i.description?.includes(tagBundling) && i.menu_context !== 'BUNDLING')
         );
      }
      if (currentView === 'PENDING' || currentView === 'PENDING_HISTORY') {
         return items.filter(i => i.menu_context === 'PENDING' || i.description?.includes(tagPending));
      }
      if (currentView === 'READY' || currentView === 'READY_HISTORY') {
         return items.filter(i => i.menu_context === 'READY' || i.description?.includes('[READY]'));
      }
      if (currentView === 'REPORT' || currentView === 'REPORT_HISTORY') {
         return items.filter(i => i.menu_context === 'REPORT' || i.description?.includes(tagReport));
      }
      if (currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY') {
         return items.filter(i => i.menu_context === 'BUNDLING' || i.description?.includes(tagBundling));
      }
      if (currentView === 'CANCEL' || currentView === 'CANCEL_HISTORY') {
         return items.filter(i => i.menu_context === 'CANCEL' || i.description?.includes('[CANCEL]'));
      }
      return items;
   }, [items, currentView, isGudang, isLeader, employeeName]);

   const isHistoryView = currentView.endsWith('_HISTORY') || currentView === 'HISTORY';
   const isFailedView = currentView === 'FAILED_HISTORY';
   const isMainView = ['SCAN', 'SCAN_2', 'PENDING', 'READY', 'REPORT', 'BUNDLING', 'CANCEL', 'LEADER_GLOBAL', 'LEADER_ORDERS', 'LEADER_DASHBOARD', 'LEADER_SUMMARY', 'LEADER_PENDING', 'SPECIAL_SCAN'].includes(currentView);

   const todayItems = useMemo(() => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startTs = startOfDay.getTime();
      return displayedItems.filter(i => Number(i.timestamp) >= startTs);
   }, [displayedItems, todayDateIdentifier]);

   const leaderStats = useMemo(() => {
      if (role !== UserRole.LEADER) return null;

      // Global assignments for today (All Leaders)
      const allAssignments = items.filter(i => i.menu_context === 'SCAN_2' && i.timestamp >= new Date().setHours(0, 0, 0, 0));
      // My assignments for today
      const myAssignments = allAssignments.filter(i => i.employee_name === employeeName);

      const pickerMap: Record<string, { count: number, barcodes: string[] }> = {};

      allAssignments.forEach(item => {
         const assignees: string[] = (item as any).assignees || []; // Grab assignees from local extended state
         assignees.forEach(picker => {
            if (!pickerMap[picker]) {
               pickerMap[picker] = { count: 0, barcodes: [] };
            }
            pickerMap[picker].count += 1;
            pickerMap[picker].barcodes.push(item.barcode);
         });
      });

      // Fill in zeros for pickers who haven't received anything yet
      pickersList.forEach(picker => {
         if (!pickerMap[picker.name]) {
            pickerMap[picker.name] = { count: 0, barcodes: [] };
         }
      });

      // Convert to array and sort by count descending
      const pickerLeaderboard = Object.entries(pickerMap)
         .map(([name, data]) => ({ name, ...data }))
         .sort((a, b) => b.count - a.count);

      return {
         totalAssignments: myAssignments.length, // Display only mine in the Hero
         regularScans: items.filter(i => i.menu_context !== 'SCAN_2' && i.timestamp >= new Date().setHours(0, 0, 0, 0) && i.role === UserRole.LEADER && i.employee_name === employeeName).length,
         pickerLeaderboard,
         pickerMap
      };
   }, [items, role, employeeName, todayDateIdentifier, pickersList]);

   const globalLeaderStats = useMemo(() => {
      if (role !== UserRole.LEADER) return [];

      const getResi = (barcode: string) => {
         const match = barcode.match(/\d+\.(\d+)/);
         return match ? parseInt(match[1], 10) : 0;
      };

      const leaderActivity: Record<string, number> = {};

      leaderOrdersData.forEach(item => {
         const name = item.leader_name?.toUpperCase() || 'UNKNOWN';
         const resi = getResi(item.barcode || '');
         leaderActivity[name] = (leaderActivity[name] || 0) + resi;
      });

      return Object.entries(leaderActivity)
         .map(([name, resiCount]) => {
            const batch = resiCount / 50; 
            return { name, count: batch };
         })
         .sort((a, b) => b.count - a.count);
   }, [leaderOrdersData, role, todayDateIdentifier]);

   // For assignment modal: sort by least load first
   const sortedPickersForAssignment = useMemo(() => {
      if (!leaderStats) return pickersList;
      return [...pickersList].sort((a, b) => {
         const loadA = leaderStats.pickerMap[a.name]?.count || 0;
         const loadB = leaderStats.pickerMap[b.name]?.count || 0;
         return loadA - loadB;
      });
   }, [pickersList, leaderStats]);

   const todayCount = todayItems.length;
   const pendingCount = todayItems.filter(i => i.status === 'PENDING').length;
   const failedCount = failedItems.length;

   const targetPercent = dailyTarget > 0 ? Math.min(100, Math.round((todayCount / dailyTarget) * 100)) : 0;

   const todayDate = useMemo(() => {
      try {
         return new Date().toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
         });
      } catch (e) {
         return new Date().toLocaleDateString();
      }
   }, []);

   // --- PRE-CALCULATE LISTS TO AVOID CONDITIONAL HOOKS ---
   // Fix for Minified React Error #300
   const filteredList = useMemo(() => {
      let result = [...displayedItems];

      // Special Logic for SORTIR: Always put [CANCEL] items at the top
      // Special Logic for SORTIR: Always put [CANCEL] items at the top
      if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH)) {
         result.sort((a, b) => {
            const bca = (a.barcode || '').trim().toUpperCase();
            const bcb = (b.barcode || '').trim().toUpperCase();
            const aCancel = (bca && cancelledSet.has(bca)) || (a.description || '').toUpperCase().includes('[CANCEL]') || a.priority === 'HIGH';
            const bCancel = (bcb && cancelledSet.has(bcb)) || (b.description || '').toUpperCase().includes('[CANCEL]') || b.priority === 'HIGH';
            if (aCancel && !bCancel) return -1;
            if (!aCancel && bCancel) return 1;
            return Number(b.timestamp) - Number(a.timestamp);
         });
      }

      if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && isHistoryView) {
         if (showOnlyCancel) {
            // For Sortir History: ONLY show items that were actually moved/eliminated
            return result.filter(item => item.menu_context === 'HISTORY_MOVED');
         } else {
            // For Sortir History "Semua" tab: ONLY show normal items (exclude moved cancels and high priority/cancel tagged)
            return result.filter(item => 
               item.menu_context !== 'HISTORY_MOVED' && 
               !cancelledSet.has((item.barcode || '').trim().toUpperCase()) &&
               !(item.description || '').toUpperCase().includes('[CANCEL]')
            );
         }
      }

      // STRICT MIDNIGHT RESET FOR ACTIVE LIST (Avoid slow DB filtrations)
      if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && !isHistoryView) {
         const mid = new Date();
         mid.setHours(0, 0, 0, 0);
         const midTs = mid.getTime();
         result = result.filter(item => Number(item.timestamp) >= midTs);
      }

      if (showOnlyCancel) {
         return result.filter(item =>
            cancelledSet.has((item.barcode || '').trim().toUpperCase()) ||
            item.description?.toUpperCase().includes('[CANCEL]') ||
            (item.priority === 'HIGH' && ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) || (role === UserRole.PACKING || role === UserRole.PACKING_2 || role === UserRole.ADMIN)))
         );
      }

      // Filter by Search Term
      const lower = listSearchTerm.toLowerCase();
      if (lower) {
         result = result.filter(item =>
            item.barcode.toLowerCase().includes(lower) ||
            item.destination?.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower)
         );
      }

      // SORTIR: Exclude moved items from active scan list
      if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && !isHistoryView) {
         result = result.filter(item => item.menu_context !== 'HISTORY_MOVED');
      }

      return result;
   }, [displayedItems, listSearchTerm, showOnlyCancel, role, cancelledSet, isHistoryView]);


   const groupedList = useMemo(() => {
      if (isHistoryView) return groupItemsByDate(filteredList);
      return null;
   }, [filteredList, isHistoryView]);

   const renderSidebar = () => {
      const isScanActive = currentView === 'SCAN' || currentView === 'SCAN_HISTORY';
      const isScan2Active = currentView === 'SCAN_2' || currentView === 'SCAN_2_HISTORY';
      const isPendingActive = currentView === 'PENDING' || currentView === 'PENDING_HISTORY';
      const isReadyActive = currentView === 'READY' || currentView === 'READY_HISTORY';
      const isReportActive = currentView === 'REPORT' || currentView === 'REPORT_HISTORY';

      return (
         <>
            {isSidebarOpen && (
               <div
                  className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity"
                  onClick={() => setIsSidebarOpen(false)}
               />
            )}

            <div className={`
        fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-950 z-[70] shadow-2xl transform transition-transform duration-300 ease-out border-r border-gray-100 dark:border-gray-800
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
               <div className={`h-32 ${theme.gradient} p-6 flex flex-col justify-end relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <h2 className="text-white text-2xl font-bold relative z-10">{isLeader ? 'Menu Leader' : 'Menu Gudang'}</h2>
                  <p className="text-white/80 text-sm relative z-10">{employeeName}</p>
               </div>

               <div className="p-4 space-y-2">
                  {isLeader && (
                     <>
                        <button
                           onClick={() => { setCurrentView('LEADER_DASHBOARD'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'LEADER_DASHBOARD' || currentView === 'HISTORY'
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <Monitor size={20} />
                           <span className="font-medium">Dashboard Overview</span>
                        </button>
                        {devMode && (
                         <button
                            onClick={() => { setCurrentView('SCAN'); setIsSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isScanActive
                               ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                               }`}
                         >
                            <ScanLine size={20} />
                            <span className="font-medium">Scan Leader ORI</span>
                            <span className="ml-auto text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">DEV</span>
                         </button>
                        )}
                        <button
                           onClick={() => { setCurrentView('SCAN_2'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isScan2Active
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <ScanLine size={20} />
                           <span className="font-medium">Scan Leader</span>
                        </button>
                        <button
                           onClick={() => { setCurrentView('LEADER_PENDING'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'LEADER_PENDING' || currentView === 'LEADER_PENDING_HISTORY'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 font-bold'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <Clock size={20} />
                           <span className="font-medium">Pending Scan (LT3)</span>
                        </button>
                        <button
                           onClick={() => { setCurrentView('LEADER_GLOBAL'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'LEADER_GLOBAL'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <Users size={20} />
                           <span className="font-medium">Global Leader Monitor</span>
                        </button>
                        <button
                           onClick={() => { setCurrentView('LEADER_ORDERS'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'LEADER_ORDERS'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <FileText size={20} />
                           <span className="font-medium">Semua Orderan Leader</span>
                        </button>
                        <button
                           onClick={() => { setCurrentView('LEADER_SUMMARY'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'LEADER_SUMMARY'
                              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <ListOrdered size={20} />
                           <span className="font-medium">Rekap Total Leader</span>
                        </button>

                        {/* Profile Indicator */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                           <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Profil Aktif Hari Ini</p>
                              <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{selectedLeaderProfile || 'Belum Dipilih'}</p>
                              <button
                                 onClick={() => setShowLeaderProfileModal(true)}
                                 className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                 Ganti Profil
                              </button>
                           </div>
                        </div>
                     </>
                  )}

                  {isGudang && (
                     <>
                        <button
                           onClick={() => {
                              if (isGudang) return;
                              setCurrentView('SCAN');
                              setIsSidebarOpen(false);
                           }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isScanActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-gudang-900/40 dark:text-emerald-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              } ${isGudang ? 'opacity-40 cursor-not-allowed select-none' : ''}`}
                        >
                           <ScanLine size={20} />
                           <div className="flex flex-col items-start leading-tight">
                              <span className="font-medium">Potong Stok</span>
                              {isGudang && <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Coming Soon</span>}
                           </div>
                        </button>

                        <button
                           onClick={() => { setCurrentView('PENDING'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isPendingActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-gudang-900/40 dark:text-emerald-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <Clock size={20} />
                           <span className="font-medium">Pending Scans (LT3)</span>
                        </button>

                        <button
                           onClick={() => { setCurrentView('READY'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isReadyActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-gudang-900/40 dark:text-emerald-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <CheckCircle2 size={20} />
                           <span className="font-medium">Resi Ready (LT3)</span>
                        </button>

                        <button
                           onClick={() => { setCurrentView('REPORT'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isReportActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-gudang-900/40 dark:text-emerald-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <FileText size={20} />
                           <span className="font-medium">Gudang Report</span>
                        </button>

                        <button
                           onClick={() => { setCurrentView('BUNDLING'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'BUNDLING' || currentView === 'BUNDLING_HISTORY'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-gudang-900/40 dark:text-emerald-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <Layers size={20} />
                           <span className="font-medium">Scan Bundling</span>
                        </button>

                        <button
                           onClick={() => { setCurrentView('CANCEL'); setIsSidebarOpen(false); }}
                           className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === 'CANCEL' || currentView === 'CANCEL_HISTORY'
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                              }`}
                        >
                           <XCircle size={20} />
                           <span className="font-medium">Scan Cancel (LT3)</span>
                        </button>
                     </>
                  )}
               </div>

               <div className="absolute bottom-8 left-0 right-0 px-6">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                     <p className="text-xs text-gray-500">System Version</p>
                     <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{isLeader ? 'LEADER SCAN' : 'v2.4 GUDANG'}</p>
                  </div>
               </div>
            </div>
         </>
      );
   };

   const renderLeaderSummary = () => {
      // Aggregation logic
      const leaderDataMap = {
         'RICKY': { pretelan: 0, satuan: 0 },
         'AKMAL': { pretelan: 0, satuan: 0 }
      };

      leaderOrdersData.forEach(order => {
         const leader = order.leader_name?.toUpperCase() as 'RICKY' | 'AKMAL';
         if (leaderDataMap[leader]) {
            const count = (barcode: string) => {
               const m = barcode.match(/\d+\.(\d+)/);
               return m ? parseInt(m[1], 10) : 1; 
            };
            
            if (order.scan_type === 'SATUAN') {
               leaderDataMap[leader].satuan += count(order.barcode);
            } else {
               leaderDataMap[leader].pretelan += count(order.barcode);
            }
         }
      });

      const formatBatch = (resis: number) => (resis / 50).toLocaleString('id-ID', { maximumFractionDigits: 2 });

      return (
         <div className="flex-1 overflow-y-auto p-4 md:p-10 pb-36 no-scrollbar bg-gray-50 dark:bg-gray-950">
            <div className="max-w-6xl lg:max-w-7xl mx-auto space-y-10">
               <div className="bg-white dark:bg-gray-900 rounded-[2rem] md:rounded-[4rem] p-4 sm:p-8 md:p-16 shadow-sm border border-gray-100 dark:border-gray-800">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                     <div className="flex items-center gap-6">
                        <div className="p-5 bg-indigo-100 dark:bg-indigo-900/40 rounded-[2rem] shadow-inner">
                           <ListOrdered size={40} className="text-indigo-600" />
                        </div>
                        <div>
                           <h3 className="text-2xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-gray-100 tracking-tighter">Rekap Total Leader</h3>
                           <p className="text-lg text-gray-500 font-medium">Monitoring performa harian gabungan</p>
                        </div>
                     </div>
                     <div className="hidden lg:block">
                        <div className="bg-white dark:bg-gray-800 px-8 py-4 rounded-[1.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                           <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                           <div>
                              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Sistem Online</p>
                              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">1 Batch = 50 Resi</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
                     {(['RICKY', 'AKMAL'] as const).map(leader => {
                        const data = leaderDataMap[leader];
                        const totalResi = data.pretelan + data.satuan;
                        const totalBatch = totalResi / 50;

                        return (
                           <div key={leader} className="bg-gray-50/50 dark:bg-gray-800/20 rounded-[1.5rem] sm:rounded-[3rem] md:rounded-[3.5rem] p-4 sm:p-8 md:p-12 border border-gray-100 dark:border-gray-800/60 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group relative overflow-hidden">
                              {/* Background highlight */}
                              <div className={`absolute -top-24 -right-24 w-64 h-64 opacity-[0.03] pointer-events-none rounded-full blur-3xl ${leader === 'RICKY' ? 'bg-blue-600' : 'bg-green-600'}`}></div>

                              <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
                                 <div className={`w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center font-black text-2xl sm:text-3xl md:text-4xl shadow-xl transform transition-transform group-hover:scale-105 ${
                                    leader === 'RICKY' ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-green-600 text-white shadow-green-500/20'
                                 }`}>
                                    {leader.charAt(0)}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h4 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">{leader}</h4>
                                    <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                                       <span className={`px-2 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest ${leader === 'RICKY' ? 'bg-blue-500/80' : 'bg-green-500/80'}`}>
                                          Leader
                                       </span>
                                       <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">Produksi</p>
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-6">
                                 {/* Pretelan Metric */}
                                 <div className="group/item flex justify-between items-center p-4 sm:p-6 md:p-8 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="flex items-center gap-3 sm:gap-5">
                                       <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 transition-colors group-hover/item:bg-purple-600 group-hover/item:text-white shrink-0">
                                          <Layers size={28} className="w-5 h-5 sm:w-7 sm:h-7" />
                                       </div>
                                       <div className="min-w-0">
                                          <span className="text-base sm:text-lg md:text-xl font-black text-gray-700 dark:text-gray-300">Pretelan</span>
                                          <p className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Single Scans</p>
                                       </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                       <div className="text-lg sm:text-2xl md:text-3xl font-black text-purple-600 tracking-tighter">{formatBatch(data.pretelan)} <span className="text-xs sm:text-sm font-bold opacity-60">Batch</span></div>
                                       <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase">{data.pretelan} Resi</div>
                                    </div>
                                 </div>

                                 {/* Satuan Metric */}
                                 <div className="group/item flex justify-between items-center p-4 sm:p-6 md:p-8 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                    <div className="flex items-center gap-3 sm:gap-5">
                                       <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 transition-colors group-hover/item:bg-indigo-600 group-hover/item:text-white shrink-0">
                                          <Package size={28} className="w-5 h-5 sm:w-7 sm:h-7" />
                                       </div>
                                       <div className="min-w-0">
                                          <span className="text-base sm:text-lg md:text-xl font-black text-gray-700 dark:text-gray-300">Satuan</span>
                                          <p className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Box Units</p>
                                       </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                       <div className="text-lg sm:text-2xl md:text-3xl font-black text-indigo-600 tracking-tighter">{formatBatch(data.satuan)} <span className="text-xs sm:text-sm font-bold opacity-60">Batch</span></div>
                                       <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase">{data.satuan} Resi</div>
                                    </div>
                                 </div>

                                 {/* TOTAL GABUNGAN PREMIUM CARD */}
                                 <div className={`mt-6 sm:mt-10 p-5 sm:p-10 md:p-14 rounded-2xl sm:rounded-[3rem] md:rounded-[3.5rem] bg-gradient-to-br transition-all hover:scale-[1.02] ${
                                    leader === 'RICKY' 
                                       ? 'from-blue-600 via-indigo-600 to-indigo-700' 
                                       : 'from-green-600 via-emerald-600 to-emerald-700'
                                 } text-white shadow-2xl shadow-indigo-500/10 dark:shadow-none relative isolate overflow-hidden`}>
                                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                                       <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                          <pattern id={`grid-${leader}`} width="40" height="40" patternUnits="userSpaceOnUse">
                                             <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                          </pattern>
                                          <rect width="100%" height="100%" fill={`url(#grid-${leader})`} />
                                       </svg>
                                    </div>
                                    
                                    <div className="relative z-10 flex flex-col items-center sm:items-start lg:flex-row justify-between lg:items-center gap-5 sm:gap-10">
                                       <div className="w-full sm:w-auto text-center sm:text-left">
                                          <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                             <Zap size={18} className="text-yellow-300 sm:w-5 sm:h-5" fill="currentColor" />
                                             <p className="text-[10px] sm:text-xs font-black text-white/80 uppercase tracking-[0.2em] sm:tracking-[0.4em]">TOTAL GABUNGAN</p>
                                          </div>
                                          <div className="flex items-baseline justify-center sm:justify-start gap-2 sm:gap-4">
                                             <p className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-none">
                                                {totalBatch.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                             </p>
                                             <p className="text-lg sm:text-2xl font-bold text-white/60">Batch</p>
                                          </div>
                                       </div>
                                       <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] px-6 sm:px-8 py-4 sm:py-6 border border-white/20 text-center min-w-[120px] sm:min-w-[160px] self-stretch flex flex-col justify-center">
                                          <p className="text-3xl sm:text-4xl md:text-5xl font-black leading-none mb-1 sm:mb-2 tabular-nums">{totalResi}</p>
                                          <p className="text-[10px] sm:text-xs font-black text-white/50 uppercase tracking-[0.2em] sm:tracking-[0.3em]">TOTAL RESI</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>
         </div>
      );
   };

   const renderGlobalLeaderActivity = () => {
      const totalGlobalBatch = globalLeaderStats.reduce((acc, curr) => acc + curr.count, 0);
      return (
         <div className="flex-1 overflow-y-auto p-5 pb-36 no-scrollbar bg-gray-50 dark:bg-gray-950">
            <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6">
               <div className={`${theme.gradient} rounded-[2.5rem] p-8 shadow-xl border border-white/10 overflow-hidden relative group`}>
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                     <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                           <pattern id="globalGrid" width="40" height="23" patternUnits="userSpaceOnUse" patternTransform="scale(1.2)">
                              <path d="M0 23 L20 11.5 L40 23 M20 0 L20 11.5" fill="none" stroke="white" strokeWidth="0.5" />
                           </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#globalGrid)" />
                     </svg>
                  </div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                     <div className="flex items-center gap-6">
                        <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md shadow-inner border border-white/20">
                           <Users size={40} className="text-white" />
                        </div>
                        <div>
                           <h2 className="text-white text-3xl font-black tracking-tight leading-none mb-2">Global Leader Monitor</h2>
                           <p className="text-purple-100/80 font-medium">Rekap penugasan semua Leader hari ini</p>
                        </div>
                     </div>
                     <div className="bg-black/20 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 shadow-lg">
                        <div className="text-purple-200/60 text-xs font-bold uppercase tracking-widest mb-1">Total Global Scan</div>
                        <div className="text-4xl font-black text-white leading-none">{totalGlobalBatch.toLocaleString('id-ID', { maximumFractionDigits: 2 })} <span className="text-lg font-medium opacity-60">Batch</span></div>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
                           <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                              <Star size={24} className="text-yellow-600 fill-yellow-600" />
                           </div>
                           Leader Performance
                        </h3>
                     </div>
                     <div className="space-y-4">
                        {globalLeaderStats.length === 0 ? (
                           <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                              <Package size={48} className="opacity-20 mb-4" />
                              <p className="italic font-medium">Belum ada aktivitas leader hari ini</p>
                           </div>
                        ) : (
                           globalLeaderStats.map((leader, idx) => (
                              <div key={leader.name} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/40 rounded-3xl border border-gray-100 dark:border-gray-800 transition-all hover:border-purple-200 dark:hover:border-purple-900 group">
                                 <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl relative shadow-sm ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'}`}>
                                       {leader.name.charAt(0)}
                                       {idx === 0 && <span className="absolute -top-2 -right-2 text-2xl drop-shadow-md">👑</span>}
                                    </div>
                                    <div>
                                       <div className="font-black text-lg text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors uppercase">{leader.name}</div>
                                       <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{idx === 0 ? 'Top Performer' : 'Leader'}</div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{leader.count.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Batch</div>
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
                           <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                              <Zap size={24} className="text-purple-600 fill-purple-600" />
                           </div>
                           Global Picker Load
                        </h3>
                     </div>
                     <div className="space-y-3 max-h-[520px] overflow-y-auto pr-3 custom-scrollbar">
                        {leaderStats?.pickerLeaderboard.map((picker, idx) => (
                           <div key={picker.name} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-gray-600 capitalize">
                                    {picker.name.charAt(0)}
                                 </div>
                                 <div className="font-bold text-gray-700 dark:text-gray-200 capitalize">{picker.name}</div>
                              </div>
                              <div className={`px-5 py-2 rounded-2xl font-black text-sm shadow-sm ${picker.count > 10 ? 'bg-red-50 text-red-600' : picker.count > 5 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                                 {picker.count} <span className="text-[10px] font-bold opacity-60">PL</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      );
   };

   // Helper function to group items
   function groupItemsByDate(items: ScannedItem[]) {
      const groups: Record<string, ScannedItem[]> = {};
      items.forEach(item => {
         try {
            const dateKey = new Date(item.timestamp).toLocaleDateString('id-ID', {
               weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(item);
         } catch (e) {
            // Fallback
         }
      });
      return groups;
   }

   const toggleDateExpansion = (date: string) => {
      setExpandedDates(prev =>
         prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
      );
   };

   // --- RESEND LOGIC ---
   const handleSelectFailed = (id: string) => {
      setSelectedFailedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
   };

   const handleSelectAllFailed = () => {
      if (selectedFailedIds.length === failedItems.length) setSelectedFailedIds([]);
      else setSelectedFailedIds(failedItems.map(i => i.id));
   };

   const handleResendSelected = async () => {
      if (selectedFailedIds.length === 0) return;

      // Strict Check again
      if (!navigator.onLine) {
         playError();
         setCriticalNetworkError("Internet masih mati. Tidak bisa resend.\nSilahkan scan ulang lagi data yang gagal scan tsb.");
         return;
      }

      setIsResending(true);
      setConsolidatedAlerts([]); // Clear previous alerts

      const itemsToResend = failedItems.filter(i => selectedFailedIds.includes(i.id));
      const newAlerts: string[] = [];
      const successfulIds: string[] = [];

      for (const item of itemsToResend) {
         // Only resend Network/Other items. Duplicate/Forbidden are ignored logic-wise but we process the loop
         if (item.failReason === 'DUPLICATE' || item.failReason === 'FORBIDDEN') {
            // We do nothing for these except maybe remove them if user wanted? 
            // For now we just skip resending them.
            continue;
         }

         // Try Resend to Supabase
         try {
            // Check duplicate again just in case
            const { data: duplicate } = await supabase
               .from('scanned_items')
               .select('employee_name')
               .eq('barcode', item.barcode)
               .eq('role', role)
               .limit(1)
               .maybeSingle();

            if (duplicate) {
               newAlerts.push(`${item.barcode} - Sudah ada (${duplicate.employee_name})`);
               // Update fail reason locally to Duplicate so user knows
               setFailedItems(prev => prev.map(i => i.id === item.id ? { ...i, failReason: 'DUPLICATE', failMessage: `Duplicate: ${duplicate.employee_name}` } : i));
            } else {
               // Generate new ID for resend
               const newId = generateUniqueScanId();

               // Insert
               const { error } = await supabase.from('scanned_items').insert([
                  {
                     // IMPORTANT: Send new unique ID
                     id: newId,
                     timestamp: Date.now(),
                     barcode: item.barcode,
                     role: item.role,
                     user_email: userEmail,
                     employee_name: item.employee_name,
                     destination: item.destination,
                     description: item.description,
                     priority: item.priority,
                     status: item.status === 'ERROR' ? 'COMPLETED' : item.status,
                     scan_mode: item.scan_mode || 'INDIVIDU',
                     team_members: item.team_members || [],
                     report_keterangan: item.report_keterangan || null,
                     report_msku: item.report_msku || null,
                     report_qty: item.report_qty || null,
                     order_id: item.order_id || null
                  }
               ]);

               if (error) throw error;
               successfulIds.push(item.id);

               // Dual-write ke Supabase Cadangan
               replicateBackupInsert('scanned_items', {
                  id: newId,
                  timestamp: Date.now(),
                  barcode: item.barcode,
                  role: item.role,
                  user_email: userEmail,
                  employee_name: item.employee_name,
                  destination: item.destination,
                  description: item.description,
                  priority: item.priority,
                  status: item.status === 'ERROR' ? 'COMPLETED' : item.status,
                  scan_mode: item.scan_mode || 'INDIVIDU',
                  team_members: item.team_members || [],
                  report_keterangan: item.report_keterangan || null,
                  report_msku: item.report_msku || null,
                  report_qty: item.report_qty || null,
                  order_id: item.order_id || null
               });
               replicateBackupDelete('failed_scans', { column: 'id', value: item.id });

               // Remove from failed_scans table if it was persisted
               await supabase.from('failed_scans').delete().eq('id', item.id);

               // Add to main list
               const successItem: ScannedItem = {
                  ...item,
                  status: 'COMPLETED',
                  syncStatus: 'SYNCED',
                  id: newId
               };
               setItems(prev => [successItem, ...prev]);
            }
         } catch (err: any) {
            newAlerts.push(`${item.barcode} - Error: ${err.message}`);
         }
      }

      // Remove successful ones from Failed List
      if (successfulIds.length > 0) {
         setFailedItems(prev => prev.filter(i => !successfulIds.includes(i.id)));
         setSelectedFailedIds(prev => prev.filter(id => !successfulIds.includes(id)));
      }

      if (newAlerts.length > 0) {
         setConsolidatedAlerts(newAlerts);
         playError();
      } else if (successfulIds.length > 0) {
         playSuccess();
         triggerCameraToast(`Resend ${successfulIds.length} items berhasil!`, 'success');
      }

      setIsResending(false);
   };

   const renderItemList = (emptyMsg: string, titleOverride?: string) => {
      // Uses filteredList and groupedList from parent scope
      const handleScanItemClick = (item: ScannedItem) => {
         const isCancel = cancelledSet.has((item.barcode || '').trim().toUpperCase()) || (item.description || '').toUpperCase().includes('[CANCEL]') || item.priority === 'HIGH';
         
         if ((role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && isCancel && !isHistoryView) {
            setPendingMoveCancelItem(item);
            setIsMoveCancelModalOpen(true);
         }
      };

      const renderTema2ScanCard = (item: ScannedItem, index: number, isActuallyCancelled?: boolean) => {
         const isCancel = isActuallyCancelled || cancelledSet.has((item.barcode || '').trim().toUpperCase()) || (item.description || '').toUpperCase().includes('[CANCEL]') || item.priority === 'HIGH';
         const isFailed = (item.status as string) === 'FAILED' || item.status === 'ERROR';
         const isOk = !isFailed && !isCancel;
         const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
         return (
            <div
               key={item.id || index}
               onClick={() => handleScanItemClick(item)}
               className="pk-surface pk-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
               <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                     <p className="pk-mono truncate text-sm font-medium text-[#16191D] dark:text-[#ECEEF0]">{item.barcode}</p>
                     {item.order_id && (
                        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                           {item.order_id}
                        </span>
                     )}
                  </div>
                  <p className="pk-muted text-xs mt-0.5">
                     {timeStr}
                     {item.destination && <span className="mx-1">• {item.destination}</span>}
                     {item.employee_name && <span className="mx-1">• {item.employee_name}</span>}
                  </p>
               </div>
               <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                     isCancel
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : isOk
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
               >
                  {isCancel ? "Cancel" : isOk ? "Selesai" : "Gagal"}
               </span>
            </div>
         );
      };

      const renderHistoryGroups = () => {
         if (!groupedList) return null;
         const dates = Object.keys(groupedList);

         if (dates.length === 0) return renderEmptyState();

         return dates.map(date => {
            const itemsInDate = groupedList[date];
            const isExpanded = expandedDates.includes(date);
            const LIMIT = 5;
            const showSeeMore = itemsInDate.length > 6 && !isExpanded;

            const displayedItems = showSeeMore ? itemsInDate.slice(0, LIMIT) : itemsInDate;
            const remainingCount = itemsInDate.length - LIMIT;

            return (
               <div key={date} className="mb-8 animate-[fadeIn_0.3s_ease-out]">
                  <div className="sticky top-0 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md z-20 py-3 mb-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                     <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
                     <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm md:text-base">{date}</h4>
                     <span className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-mono">
                        {itemsInDate.length} items
                     </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                     {displayedItems.map((item, index) => (
                        <ScanCard 
                           key={item.id} 
                           item={item} 
                           theme={theme} 
                           index={index} 
                           onClick={() => handleScanItemClick(item)} 
                           isActuallyCancelled={cancelledSet.has(item.barcode.trim().toUpperCase())}
                           role={role}
                        />
                     ))}

                     {showSeeMore && (
                        <button
                           onClick={() => toggleDateExpansion(date)}
                           className="hidden md:flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group h-full min-h-[100px]"
                        >
                           <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                              <ChevronDown size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
                           </div>
                           <span className="font-bold text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                              Lihat Lainnya (+{remainingCount})
                           </span>
                        </button>
                     )}

                     {showSeeMore && (
                        <button
                           onClick={() => toggleDateExpansion(date)}
                           className="md:hidden w-full py-3 mt-2 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl"
                        >
                           <span>Lihat {remainingCount} item lainnya</span>
                           <ChevronDown size={16} />
                        </button>
                     )}
                  </div>

                  {isExpanded && itemsInDate.length > 6 && (
                     <div className="mt-4 flex justify-center">
                        <button
                           onClick={() => toggleDateExpansion(date)}
                           className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-wider py-2"
                        >
                           <ChevronUp size={14} /> Tutup Detail
                        </button>
                     </div>
                  )}
               </div>
            );
         });
      };


      const renderEmptyState = () => (
         <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 h-full">
            <div className="w-24 h-24 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
               <Package size={40} className="opacity-20 text-gray-900 dark:text-gray-100" />
            </div>
            <p className="font-medium text-gray-500 dark:text-gray-500">{listSearchTerm ? 'No matching items found' : emptyMsg}</p>
            {['SCAN', 'PENDING', 'READY', 'REPORT', 'CANCEL'].includes(currentView) && !listSearchTerm && (<p className="text-xs mt-1 max-w-[200px] text-center opacity-60">Start processing by scanning a label</p>)}
         </div>
      );

      return (
         <div className="flex-1 overflow-y-auto p-5 pb-36 no-scrollbar">
            {/* SORTIR MODE SWITCHER */}
            {(role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && currentView === 'SCAN' && (
               <div className="max-w-5xl mx-auto w-full mb-6 animate-[slideDown_0.3s_ease-out]">
                  <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
                     <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl w-full md:w-auto h-14 relative">
                        <div
                           className={`absolute inset-1.5 w-[calc(50%-6px)] bg-white dark:bg-gray-700 rounded-xl shadow-sm transition-all duration-300 ease-out ${scanMode === 'TIM' ? 'translate-x-full' : 'translate-x-0'}`}
                        />
                        <button
                           onClick={() => handleModeToggle('INDIVIDU')}
                           className={`flex-1 flex items-center justify-center gap-2 px-6 relative z-10 transition-colors ${scanMode === 'INDIVIDU' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}
                        >
                           <User size={18} />
                           <span className="text-sm">Individu</span>
                        </button>
                        <button
                           onClick={() => handleModeToggle('TIM')}
                           className={`flex-1 flex items-center justify-center gap-2 px-6 relative z-10 transition-colors ${scanMode === 'TIM' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}
                        >
                           <Users size={18} />
                           <span className="text-sm">Tim</span>
                        </button>
                     </div>

                     {scanMode === 'TIM' && (
                        <div className="flex flex-wrap items-center justify-center gap-2 flex-1">
                           {teamMembers.length > 0 ? (
                              teamMembers.map(name => (
                                 <div key={name} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold animate-[popIn_0.2s_ease-out] border border-blue-100 dark:border-blue-800">
                                    <span>{name}</span>
                                    <button onClick={() => toggleTeamMember(name)} className="hover:text-red-500">
                                       <X size={12} />
                                    </button>
                                 </div>
                              ))
                           ) : (
                              <p className="text-xs text-gray-400 font-medium italic">Belum ada anggota tim yang dipilih</p>
                           )}
                           <button
                              onClick={() => setIsTeamManagementOpen(true)}
                              className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl transition-all"
                           >
                              <UserPlus size={14} />
                              Pilih Anggota
                           </button>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* SORTIR HISTORY TABS */}
            {(role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) && isHistoryView && (
               <div className="max-w-5xl mx-auto w-full mb-6">
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full md:w-80 h-12 relative">
                     <div
                        className={`absolute inset-1 w-[calc(50%-4px)] bg-white dark:bg-gray-700 rounded-xl shadow-sm transition-all duration-300 ease-out ${showOnlyCancel ? 'translate-x-full' : 'translate-x-0'}`}
                     />
                     <button
                        onClick={() => setShowOnlyCancel(false)}
                        className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors ${!showOnlyCancel ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}
                     >
                        <FileText size={16} />
                        <span className="text-sm">Semua</span>
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">
                           {displayedItems.filter(i => 
                              (role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) 
                                 ? (i.menu_context !== 'HISTORY_MOVED' && !cancelledSet.has(i.barcode.trim().toUpperCase()) && !(i.description || '').toUpperCase().includes('[CANCEL]'))
                                 : true
                           ).length}
                        </span>
                     </button>
                     <button
                        onClick={() => setShowOnlyCancel(true)}
                        className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors ${showOnlyCancel ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}
                     >
                        <AlertTriangle size={16} />
                        <span className="text-sm">Cancel</span>
                        <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md">
                           {displayedItems.filter(i => 
                              (role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH) 
                                 ? i.menu_context === 'HISTORY_MOVED' 
                                 : (cancelledSet.has(i.barcode.trim().toUpperCase()) || i.description?.toUpperCase().includes('[CANCEL]'))
                           ).length}
                        </span>
                     </button>
                  </div>
               </div>
            )}

            <div className="flex items-center justify-between mb-4 px-1 max-w-5xl mx-auto w-full gap-2">
               <h3 className={`text-gray-800 dark:text-gray-100 font-bold text-lg items-center gap-2 ${isSearchFocused ? 'hidden md:flex' : 'flex'} whitespace-nowrap transition-all duration-300`}>
                  {titleOverride || "Today's Scan"}
                  {!isOnline && (
                     <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200">
                        <WifiOff size={10} /> OFFLINE MODE
                     </span>
                  )}
               </h3>

               <div className="flex items-center gap-2 flex-1 md:flex-none justify-end">
                  {(role === UserRole.PACKING || role === UserRole.PACKING_2 || role === UserRole.ADMIN) && (
                     <button
                        onClick={() => setShowOnlyCancel(!showOnlyCancel)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showOnlyCancel
                           ? 'bg-red-500 border-red-500 text-white shadow-lg'
                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-300'
                           }`}
                     >
                        <AlertTriangle size={14} />
                        <span>{showOnlyCancel ? 'Tampilkan Semua' : 'Hanya Cancel'}</span>
                     </button>
                  )}

                  <div className={`relative transition-all duration-300 ease-in-out ${isSearchFocused ? 'flex-1 w-full' : 'w-40'} md:w-56 md:flex-none`}>
                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                     <input
                        type="text"
                        value={listSearchTerm}
                        onChange={(e) => setListSearchTerm(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => !listSearchTerm && setIsSearchFocused(false)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        placeholder="Search list..."
                     />
                     {listSearchTerm && (
                        <button
                           onClick={() => { setListSearchTerm(''); setIsSearchFocused(false); }}
                           className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                           <X size={14} />
                        </button>
                     )}
                  </div>
               </div>
            </div>

            <div className="max-w-5xl mx-auto w-full">
               {isHistoryView ? renderHistoryGroups() : (
                  filteredList.length === 0 ? renderEmptyState() : (
                     <>
                        <div className={isTema2 ? "mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"}>
                           {filteredList.slice((scanListPage - 1) * ITEMS_PER_PAGE, scanListPage * ITEMS_PER_PAGE).map((item, index) => (
                              isTema2 ? renderTema2ScanCard(item, (scanListPage - 1) * ITEMS_PER_PAGE + index, cancelledSet.has(item.barcode.trim().toUpperCase())) : (
                                 <ScanCard 
                                    key={item.id} 
                                    item={item} 
                                    theme={theme} 
                                    index={(scanListPage - 1) * ITEMS_PER_PAGE + index} 
                                    onClick={() => handleScanItemClick(item)} 
                                    isActuallyCancelled={cancelledSet.has(item.barcode.trim().toUpperCase())}
                                    role={role}
                                 />
                              )
                           ))}
                        </div>
                        {/* Pagination Controls */}
                        {filteredList.length > ITEMS_PER_PAGE && (
                           <div className="flex items-center justify-center gap-3 mt-4 mb-2">
                              <button
                                 onClick={() => { setScanListPage(p => Math.max(1, p - 1)); listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                 disabled={scanListPage <= 1}
                                 className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${scanListPage <= 1 ? (isTema2 ? 'pk-surface pk-muted border border-dashed opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed') : (isTema2 ? 'pk-surface pk-border border shadow-sm hover:opacity-80 active:scale-95' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-md hover:shadow-lg active:scale-95 border border-gray-200 dark:border-gray-600')}`}
                              >
                                 ← Prev
                              </button>
                              <span className={`text-xs ${isTema2 ? 'font-mono pk-muted px-3 py-1.5 rounded-lg pk-surface border' : 'font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg'}`}>
                                 {scanListPage} / {Math.ceil(filteredList.length / ITEMS_PER_PAGE)} ({filteredList.length} items)
                              </span>
                              <button
                                 onClick={() => { setScanListPage(p => Math.min(Math.ceil(filteredList.length / ITEMS_PER_PAGE), p + 1)); listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                 disabled={scanListPage >= Math.ceil(filteredList.length / ITEMS_PER_PAGE)}
                                 className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${scanListPage >= Math.ceil(filteredList.length / ITEMS_PER_PAGE) ? (isTema2 ? 'pk-surface pk-muted border border-dashed opacity-50 cursor-not-allowed' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed') : (isTema2 ? 'pk-surface pk-border border shadow-sm hover:opacity-80 active:scale-95' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-md hover:shadow-lg active:scale-95 border border-gray-200 dark:border-gray-600')}`}
                              >
                                 Next →
                              </button>
                           </div>
                        )}
                     </>
                  )
               )}
            </div>

            <div ref={listEndRef} />
         </div>
      );
   };

   const renderFailedList = () => {
      if (failedItems.length === 0) return (
         <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600 h-full">
            <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4 shadow-sm border border-green-100 dark:border-green-800/50">
               <CheckCircle2 size={40} className="text-green-300 dark:text-green-700" />
            </div>
            <p className="font-medium text-gray-500">Semua Scan Berhasil!</p>
         </div>
      );

      return (
         <div className="flex-1 overflow-y-auto p-5 pb-44 no-scrollbar">
            <div className="max-w-5xl mx-auto w-full">
               {/* CONSOLIDATED ALERT BOX */}
               {consolidatedAlerts.length > 0 && (
                  <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 animate-[slideDown_0.3s_ease-out]">
                     <h4 className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300 mb-2">
                        <AlertCircle size={18} /> Error Report ({consolidatedAlerts.length})
                     </h4>
                     <div className="max-h-40 overflow-y-auto text-xs text-red-600 dark:text-red-400 font-mono space-y-1 pr-2 custom-scrollbar">
                        {consolidatedAlerts.map((msg, i) => (
                           <div key={i} className="border-b border-red-100 dark:border-red-800/50 pb-1 last:border-0">{msg}</div>
                        ))}
                     </div>
                     <button
                        onClick={() => setConsolidatedAlerts([])}
                        className="mt-3 text-xs font-bold text-red-500 hover:text-red-700 underline"
                     >
                        Tutup Alert
                     </button>
                  </div>
               )}

               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">Failed Items ({failedItems.length})</h3>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={handleSelectAllFailed}
                        className="text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1 bg-white dark:bg-gray-800 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700"
                     >
                        {selectedFailedIds.length === failedItems.length ? <CheckSquare size={14} /> : <Square size={14} />} Select All
                     </button>
                     {selectedFailedIds.length > 0 && (
                        <button
                           onClick={() => setFailedItems(prev => prev.filter(i => !selectedFailedIds.includes(i.id)))}
                           className="text-xs font-bold text-red-500 hover:bg-red-50 py-2 px-3 rounded-lg border border-transparent hover:border-red-100 flex items-center gap-1"
                        >
                           <Trash2 size={14} /> Delete
                        </button>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {failedItems.map((item) => {
                     const isSelected = selectedFailedIds.includes(item.id);
                     return (
                        <div key={item.id} className={`relative p-4 rounded-2xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-white/20 dark:bg-gray-800 dark:border-gray-700'}`}>
                           <div className="flex justify-between items-start mb-2">
                              <div className="flex items-start gap-3">
                                 <button onClick={() => handleSelectFailed(item.id)} className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {isSelected && <CheckSquare size={12} />}
                                 </button>
                                 <div>
                                    <div className="font-mono font-bold text-gray-800 dark:text-gray-200">{item.barcode}</div>
                                    <div className="flex flex-col">
                                       <span className="text-[10px] text-gray-400">{new Date(item.timestamp).toLocaleString()}</span>
                                       {item.excel_filename && <span className="text-[10px] text-indigo-500 font-bold truncate max-w-[150px]">File: {item.excel_filename}</span>}
                                    </div>
                                 </div>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${item.failReason === 'NETWORK' ? 'bg-orange-100 text-orange-600' :
                                 item.failReason === 'DUPLICATE' ? 'bg-purple-100 text-purple-600' :
                                    'bg-red-100 text-red-600'
                                 }`}>
                                 {item.failReason}
                              </span>
                           </div>
                           <p className="text-xs text-red-500 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                              {item.failMessage}
                           </p>
                           {item.failReason === 'NETWORK' && (
                              <p className="text-[10px] text-gray-400 mt-1 italic">
                                 Klik tombol resend saat internet stabil.
                              </p>
                           )}
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* Floating Resend Button */}
            {selectedFailedIds.length > 0 && (
               <div className="fixed bottom-24 left-0 right-0 flex justify-center z-30 pointer-events-none">
                  <button
                     onClick={handleResendSelected}
                     disabled={isResending}
                     className="pointer-events-auto shadow-xl shadow-blue-500/30 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 animate-[slideUp_0.3s_ease-out]"
                  >
                     {isResending ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                     Resend {selectedFailedIds.length} Items
                  </button>
               </div>
            )}
         </div>
      );
   };

   const getHistoryTitle = () => {
      if (currentView === 'SCAN_HISTORY') return 'History: Potong Stok';
      if (currentView === 'PENDING_HISTORY') return 'History: Pending Scans (LT3)';
      if (currentView === 'LEADER_PENDING_HISTORY') return 'History: Pending Scan Leader (LT3)';
      if (currentView === 'READY_HISTORY') return 'History: Resi Ready (LT3)';
      if (currentView === 'CANCEL_HISTORY') return 'History: Scan Cancel (LT3)';
      if (currentView === 'REPORT_HISTORY') return 'History: Gudang Report';
      if (currentView === 'BUNDLING_HISTORY') return 'History: Scan Bundling';
      if (currentView === 'FAILED_HISTORY') return 'History: Failed Scans';
      if (currentView === 'SCAN_2_HISTORY') return 'History: Scan Leader 2';
      return 'History';
   };

   const currentTitle = useMemo(() => {
      if (currentView === 'SCAN') return role === UserRole.GUDANG ? 'Potong Stok' : role;
      if (currentView === 'SCAN_2') return 'Scan Leader';
      if (currentView === 'LEADER_PENDING') return 'Pending Scan Leader (LT3)';
      if (currentView === 'PENDING') return 'Pending Scans (LT3)';
      if (currentView === 'READY') return 'Resi Ready (LT3)';
      if (currentView === 'REPORT') return 'Gudang Report';
      if (currentView === 'BUNDLING') return 'Scan Bundling';
      if (currentView === 'CANCEL') return 'Scan Cancel (LT3)';
      if (currentView === 'FAILED_HISTORY') return 'Failed Items';
      if (currentView === 'LEADER_ORDERS') return 'Semua Orderan Leader';
      if (currentView === 'LEADER_SUMMARY') return 'Rekap Total Leader';
      if (isHistoryView) return getHistoryTitle();
      if (currentView === 'SPECIAL_SCAN') return 'Special Scan';
      return role || 'Dashboard';
   }, [currentView, role, isHistoryView]);

   const currentSubtitle = useMemo(() => {
      return theme?.title || 'Warehouse Management System';
   }, [theme]);

   const handleHistoryClick = () => {
      if (currentView === 'SCAN') {
         if (isGudang) setCurrentView('SCAN_HISTORY');
         else setCurrentView('HISTORY');
      }
      if (currentView === 'SCAN_2') setCurrentView('SCAN_2_HISTORY');
      if (currentView === 'LEADER_PENDING') setCurrentView('LEADER_PENDING_HISTORY');
      if (currentView === 'PENDING') setCurrentView('PENDING_HISTORY');
      if (currentView === 'READY') setCurrentView('READY_HISTORY');
      if (currentView === 'CANCEL') setCurrentView('CANCEL_HISTORY');
      if (currentView === 'REPORT') setCurrentView('REPORT_HISTORY');
      if (currentView === 'BUNDLING') setCurrentView('BUNDLING_HISTORY');
   }

   const handleHistoryBack = () => {
      if (currentView === 'SCAN_HISTORY') setCurrentView('SCAN');
      if (currentView === 'PENDING_HISTORY') setCurrentView('PENDING');
      if (currentView === 'LEADER_PENDING_HISTORY') setCurrentView('LEADER_PENDING');
      if (currentView === 'READY_HISTORY') setCurrentView('READY');
      if (currentView === 'CANCEL_HISTORY') setCurrentView('CANCEL');
      if (currentView === 'REPORT_HISTORY') setCurrentView('REPORT');
      if (currentView === 'BUNDLING_HISTORY') setCurrentView('BUNDLING');
      if (currentView === 'HISTORY') setCurrentView('SCAN');
      if (currentView === 'SCAN_2_HISTORY') setCurrentView('SCAN_2');
      if (currentView === 'FAILED_HISTORY') setCurrentView('SCAN');
   }

   const renderBottomBar = () => {
      const scanBtn = (
         <button
            key="scan-btn"
            onClick={() => {
               setRecentScans([]);
               setIsCameraOpen(true);
            }}
            className={`${theme.btn} text-white h-14 w-16 rounded-xl shadow-lg flex items-center justify-center transition-transform active:scale-90 shrink-0 z-50 flex h-14`}
         >
            <ScanLine size={24} strokeWidth={2.5} />
         </button>
      );

      const searchInput = (
         <form key="search-form" onSubmit={handleManualSubmit} className={`flex-1 relative h-14 flex items-center bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden shadow-sm ${!allowManualInput ? 'opacity-70 cursor-not-allowed bg-gray-200 dark:bg-gray-800' : ''}`}>
            {!allowManualInput ? (
               <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 z-10" />
            ) : (
               <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            )}
            <input
               type="text"
               value={manualInput}
               onChange={(e) => setManualInput(e.target.value)}
               placeholder={allowManualInput ? "Ketik Barcode..." : "Input Manual Terkunci"}
               disabled={!allowManualInput}
               readOnly={!allowManualInput}
               tabIndex={!allowManualInput ? -1 : 0}
               className={`w-full h-full bg-transparent text-gray-800 dark:text-gray-100 pl-10 pr-4 text-base font-medium focus:outline-none transition-all font-mono placeholder:font-sans placeholder:text-gray-400 dark:placeholder:text-gray-500 ${!allowManualInput ? 'cursor-not-allowed select-none pointer-events-none text-gray-400' : ''}`}
            />
            {allowManualInput && (
               <button
                  type="submit"
                  disabled={isManualSubmitting}
                  className="absolute right-0 top-0 h-full px-4 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
               >
                  {isManualSubmitting ? (
                     <Loader2 size={16} className="animate-spin text-blue-500" />
                  ) : (
                     'ENTER'
                  )}
               </button>
            )}
         </form>
      );

      const solidShape = (
         <div className="flex-1 h-14 bg-gray-100 dark:bg-gray-700/50 rounded-xl border-2 border-gray-100 dark:border-gray-700/50 border-dashed opacity-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gray-200/50 dark:bg-gray-600/20 skew-x-12 w-1/2"></div>
         </div>
      );

      if (scanButtonPosition === 'left') {
         return (
            <>
               {scanBtn}
               {searchInput}
            </>
         );
      }

      if (scanButtonPosition === 'center') {
         return (
            <div className="relative w-full flex items-center justify-center h-14">
               <div className="absolute inset-0 flex gap-2">
                  {solidShape}
                  <div className="w-16 h-14 shrink-0"></div>
                  {solidShape}
               </div>
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  {scanBtn}
               </div>
            </div>
         );
      }

      return (
         <>
            {searchInput}
            {scanBtn}
         </>
      );
   };

   return (
      <div className={`flex flex-col h-full w-full overflow-hidden ${isTema2 ? 'pk-root' : 'bg-gray-50 dark:bg-gray-950'} relative transition-colors duration-500 ease-in-out`} data-theme={isDarkMode ? 'dark' : 'light'}>
         {isTema2 && (
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
              .pk-root{--page:#F3F4F2;--surface:#fff;--text:#16191D;--muted:#5B636B;--line:#D5D9DC;--ring:#B8860B;
                font-family:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--page);color:var(--text)}
              .pk-root[data-theme=dark]{--page:#0F1114;--surface:#181B1F;--text:#ECEEF0;--muted:#9AA3AB;--line:#2B3036;--ring:#F2B705}
              .pk-surface{background:var(--surface)} .pk-muted{color:var(--muted)} .pk-border{border-color:var(--line)}
              .pk-field{background:var(--surface);border-color:var(--line);color:var(--text)}
              .pk-field::placeholder{color:var(--muted)}
              .pk-focus:focus-visible,.pk-field:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
              .pk-mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace}
              @media (min-width:1024px){html{font-size:clamp(14px,min(2.2vh,1.1vw),17px)}}
            `}</style>
         )}
         <RunningTextBanner role={role} />

         {/* CRITICAL NETWORK ERROR MODAL */}
         {criticalNetworkError && (
            <div className="fixed inset-0 z-[100] bg-red-600/90 dark:bg-red-950/95 backdrop-blur-md flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border-4 border-red-500/50 animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                  <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-500 animate-pulse">
                     <WifiOff size={48} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Koneksi Terputus!</h2>
                  <p className="text-red-600 dark:text-red-400 font-bold text-lg mb-6 whitespace-pre-line leading-relaxed">
                     {criticalNetworkError}
                  </p>
                  <button
                     onClick={() => setCriticalNetworkError(null)}
                     className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/30 active:scale-95 transition-all text-lg"
                  >
                     SAYA MENGERTI
                  </button>
               </div>
            </div>
         )}

         {/* CANCEL ORDER WARNING MODAL */}
         {showCancelWarning && pendingCancelScan && (
            <div className="fixed inset-0 z-[100] bg-orange-600 dark:bg-orange-900 flex flex-col items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
               <div className="absolute inset-0 bg-gradient-to-b from-red-600/30 to-orange-600/10 pointer-events-none"></div>

               <div className="relative z-10 flex flex-col items-center text-center max-w-md">
                  <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce border-4 border-white/30">
                     <AlertTriangle size={64} className="text-white" />
                  </div>

                  <h1 className="text-4xl md:text-5xl font-black text-white mb-4 uppercase tracking-tight animate-pulse">
                     DATA CANCEL
                  </h1>

                  <p className="text-xl md:text-2xl font-bold text-white/95 mb-4">
                     Order ini sudah di-CANCEL!
                  </p>

                  <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-8 border border-white/30">
                     <p className="text-white font-mono font-bold text-lg mb-2">{pendingCancelScan.item.barcode}</p>
                     <p className="text-white/80 text-base">
                        {role === UserRole.CHECKER
                           ? 'PISAHKAN barang ini ke area KHUSUS CANCEL (Data TIDAK masuk sistem)!'
                           : (role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH)
                           ? 'PISAHKAN orderan ini ke area KHUSUS CANCEL untuk dikembalikan/diproses terpisah!'
                           : (role === UserRole.ADMIN ? 'PISAHKAN data admin ini ke area KHUSUS CANCEL untuk dikembalikan/diproses terpisah!' : 'PISAHKAN packing ini ke area KHUSUS CANCEL untuk dikembalikan/diproses terpisah!')}
                     </p>
                  </div>

                  <button
                     onClick={handleCancelWarningAcknowledge}
                     className="w-full max-w-xs py-5 bg-white hover:bg-gray-100 text-orange-600 font-black rounded-2xl shadow-2xl shadow-black/30 active:scale-95 transition-all text-xl uppercase tracking-wider"
                  >
                     {role === UserRole.CHECKER ? 'TUTUP' : 'MENGERTI, LANJUTKAN'}
                  </button>

                  <p className="text-white/70 text-sm mt-4 italic">
                     {role === UserRole.CHECKER ? 'Data TIDAK akan disimpan' : 'Data akan tetap tersimpan dengan label [CANCEL]'}
                  </p>
               </div>
            </div>
         )}

         {/* SIDEBAR */}
         {hasSidebar && renderSidebar()}

         {/* REGULAR TOAST (For Duplicate/Validation Only) */}
         {errorToast && !criticalNetworkError && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-[shake_0.4s_ease-in-out] w-[90%] max-w-sm flex justify-center pointer-events-none">
               <div className="bg-red-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-white/20 shadow-red-500/30">
                  <AlertCircle size={24} className="shrink-0" />
                  <span className="font-bold text-sm text-center whitespace-pre-line leading-tight">{errorToast}</span>
               </div>
            </div>
         )}

         {/* SUCCESS TOAST */}
         {successToast && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-[slideDown_0.3s_ease-out] w-[90%] max-w-sm flex justify-center pointer-events-none">
               <div className="bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-white/20 shadow-emerald-500/30">
                  <CheckCircle2 size={24} className="shrink-0" />
                  <span className="font-bold text-sm text-center whitespace-pre-line leading-tight">{successToast}</span>
               </div>
            </div>
         )}

         {/* Header Area */}
         {isTema2 ? (
            <header className="relative overflow-hidden rounded-b-[1.75rem] bg-[#0E1B2E] text-white lg:rounded-b-[2.25rem] z-10 shrink-0 shadow-lg">
               <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <IllustrationTema2 className="absolute -bottom-10 -right-6 block w-[16rem] max-w-none opacity-20 sm:w-[20rem] sm:opacity-30 md:w-[24rem] md:opacity-40 lg:right-[1%] lg:w-[26rem] lg:opacity-50 xl:w-[30rem] xl:opacity-70 pointer-events-none z-0" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0E1B2E] via-[#0E1B2E]/80 to-transparent" />
               </div>
               <div className="relative mx-auto w-full max-w-6xl px-4 pb-4 sm:pb-6 pt-3 sm:pt-4 lg:px-8 lg:pb-7 lg:pt-5 z-10">
                  <div className="flex items-start justify-between gap-3">
                     <div className="flex items-center gap-2.5">
                        {hasSidebar && (
                           <button
                              onClick={() => setIsSidebarOpen(true)}
                              aria-label="Buka menu navigasi"
                              className="pk-focus grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                           >
                              <Menu size={18} />
                           </button>
                        )}
                        <Monitor size={19} className="text-white/90" />
                        <span className="text-base font-bold tracking-tight text-white">Kalindo Scan</span>
                     </div>
                     <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                           {!isOnline && (
                              <div className="p-2 bg-red-500/20 rounded-full animate-pulse mr-1" title="Offline Mode">
                                 <WifiOff size={16} className="text-white" />
                              </div>
                           )}
                           {isMainView && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_DASHBOARD' && (
                              <button
                                 onClick={handleHistoryClick}
                                 aria-label="Riwayat"
                                 className="pk-focus grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                              >
                                 <History size={17} />
                              </button>
                           )}
                           <button
                              onClick={() => setIsSettingsOpen(true)}
                              aria-label="Pengaturan"
                              className="pk-focus grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                           >
                              <Settings size={17} />
                           </button>
                           <button
                              onClick={isHistoryView || isFailedView ? handleHistoryBack : onBack}
                              aria-label="Kembali ke menu utama"
                              className="pk-focus grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                           >
                              <ArrowRight size={17} />
                           </button>
                        </div>
                        <p className="pk-mono mt-3 sm:mt-4 text-xs text-[#8FA0B8] text-right font-medium">
                           {todayDate}
                        </p>
                     </div>
                  </div>

                  <div className="mt-3 sm:mt-4">
                     <h1 className="text-2xl sm:text-3xl lg:text-3xl font-extrabold tracking-tight text-white uppercase">
                        {currentTitle}
                     </h1>
                     <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-[#8FA0B8]">{currentSubtitle}</p>
                     <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                           <User size={13} />
                           {employeeName || role}
                        </span>
                        {userEmail && (
                           <span className="pk-mono max-w-full truncate rounded-full bg-black/25 px-3 py-1 text-xs text-[#C8D3E3]">
                              {userEmail}
                           </span>
                        )}
                        {isLeader && selectedLeaderProfile && (
                           <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Profil: {selectedLeaderProfile}
                           </span>
                        )}
                     </div>
                  </div>

                  {/* DATE FILTER (Leader Reports Only) */}
                  {isLeader && (currentView === 'LEADER_ORDERS' || currentView === 'LEADER_GLOBAL' || currentView === 'LEADER_SUMMARY') && (
                     <div 
                        onClick={() => dateInputRef.current?.showPicker()}
                        className="flex items-center gap-4 mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg group hover:bg-white/20 transition-all cursor-pointer overflow-hidden relative"
                     >
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1.5">
                              <p className="text-[9px] font-black text-indigo-100 uppercase tracking-[0.2em] leading-none text-shadow-sm">DATA TANGGAL PILIHAN</p>
                           </div>
                           <div className="relative">
                              <input
                                 ref={dateInputRef}
                                 type="date"
                                 value={leaderOrdersDate}
                                 onChange={(e) => setLeaderOrdersDate(e.target.value)}
                                 className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <p className="text-xl font-black text-white p-0">
                                 {new Date(leaderOrdersDate).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                 })}
                              </p>
                           </div>
                        </div>
                        <div className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase px-4 py-2.5 rounded-xl border border-white/20 active:scale-95 transition-all shadow-sm flex-shrink-0 animate-pulse">
                           TAP UNTUK UBAH
                        </div>
                     </div>
                  )}

                  {/* PRETELAN / SATUAN Toggle for SCAN_2 */}
                  {isLeader && currentView === 'SCAN_2' && (
                     <div className="flex items-center gap-2 mt-3">
                        <button
                           onClick={() => setLeaderScanType('PRETELAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderScanType === 'PRETELAN'
                                 ? 'bg-white text-purple-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Layers size={16} className={leaderScanType === 'PRETELAN' ? 'text-purple-600' : ''} />
                           PRETELAN
                        </button>
                        <button
                           onClick={() => setLeaderScanType('SATUAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderScanType === 'SATUAN'
                                 ? 'bg-white text-indigo-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Package size={16} className={leaderScanType === 'SATUAN' ? 'text-indigo-600' : ''} />
                           SATUAN
                        </button>
                     </div>
                  )}

                  {/* PRETELAN / SATUAN Toggle for LEADER_ORDERS */}
                  {isLeader && currentView === 'LEADER_ORDERS' && (
                     <div className="flex items-center gap-2 mt-3">
                        <button
                           onClick={() => setLeaderOrdersTypeFilter('PRETELAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderOrdersTypeFilter === 'PRETELAN'
                                 ? 'bg-white text-purple-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Layers size={16} className={leaderOrdersTypeFilter === 'PRETELAN' ? 'text-purple-600' : ''} />
                           PRETELAN
                        </button>
                        <button
                           onClick={() => setLeaderOrdersTypeFilter('SATUAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderOrdersTypeFilter === 'SATUAN'
                                 ? 'bg-white text-indigo-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Package size={16} className={leaderOrdersTypeFilter === 'SATUAN' ? 'text-indigo-600' : ''} />
                           SATUAN
                        </button>
                     </div>
                  )}

                  {/* HEADER STATS CARDS */}
                  {isMainView && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_DASHBOARD' && (
                     <div className="mt-2.5 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:max-w-md">
                        <div className="rounded-xl sm:rounded-2xl border border-white/15 bg-white/10 p-2 sm:p-3">
                           <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#C8D3E3]">COMPLETED</p>
                           <p className="mt-1.5 sm:mt-2 flex items-baseline gap-2">
                              <span className="text-2xl sm:text-3xl font-semibold tabular-nums">
                                 {isLeader && currentView === 'LEADER_PENDING' ? todayItems.length : todayCount}
                              </span>
                              <span className="text-xs sm:text-sm text-[#8FA0B8]">label</span>
                           </p>
                        </div>
                        {(isGudang || (isLeader && currentView === 'LEADER_PENDING')) ? (
                           <div className="rounded-xl sm:rounded-2xl border border-white/15 bg-white/10 p-2 sm:p-3">
                              <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#C8D3E3]">PENDING</p>
                              <p className="mt-1.5 sm:mt-2 flex items-baseline gap-2">
                                 <span className="text-2xl sm:text-3xl font-semibold tabular-nums">
                                    {isLeader && currentView === 'LEADER_PENDING' ? todayItems.length : pendingCount}
                                 </span>
                                 <span className="text-xs sm:text-sm text-[#8FA0B8]">items</span>
                              </p>
                           </div>
                        ) : (
                           <button
                              onClick={() => setCurrentView('FAILED_HISTORY')}
                              className="pk-focus rounded-xl sm:rounded-2xl border border-white/15 bg-white/10 p-2 sm:p-3 text-left transition-colors hover:bg-white/15"
                           >
                              <p className="flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#C8D3E3]">
                                 FAILED <ChevronRight size={14} />
                              </p>
                              <p className="mt-1.5 sm:mt-2 flex items-baseline gap-2">
                                 <span className="text-2xl sm:text-3xl font-semibold tabular-nums">{failedCount}</span>
                                 <span className="text-xs sm:text-sm text-[#8FA0B8]">errors</span>
                              </p>
                           </button>
                        )}
                     </div>
                  )}

                  {/* TAB TOGGLE ADMIN */}
                  {role === UserRole.ADMIN && (currentView === 'SCAN' || currentView === 'SPECIAL_SCAN') && (
                     <div className="mt-4 max-w-xl">
                        <div className="flex bg-white/10 p-1.5 rounded-2xl w-full relative border border-white/20 backdrop-blur-md">
                           <div className={`absolute inset-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${currentView === 'SPECIAL_SCAN' ? 'translate-x-full' : 'translate-x-0'}`} />
                           <button
                              onClick={() => setCurrentView('SCAN')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 relative z-10 transition-colors ${currentView === 'SCAN' ? 'text-blue-900 font-bold' : 'text-white/80 font-medium'}`}
                           >
                              <ListOrdered size={16} />
                              <span className="text-sm">Scan List</span>
                           </button>
                           <button
                              onClick={() => setCurrentView('SPECIAL_SCAN')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 relative z-10 transition-colors ${currentView === 'SPECIAL_SCAN' ? 'text-blue-900 font-bold' : 'text-white/80 font-medium'}`}
                           >
                              <ScanLine size={16} />
                              <span className="text-sm">Special Scan</span>
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </header>
         ) : (
         <div className={`${theme.gradient} pt-safe-top pb-8 rounded-b-[2.5rem] md:rounded-b-[3rem] shadow-xl shadow-gray-200 dark:shadow-none z-10 flex flex-col relative overflow-hidden shrink-0 transition-all duration-500`}>

            {/* Role WebP Background Asset - Full Width Left to Right */}
            {ROLE_BG_IMAGES[role] && (
               <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-35 sm:opacity-45">
                  <img
                     src={ROLE_BG_IMAGES[role]}
                     alt={`${role} Background`}
                     className="w-full h-full object-cover object-right"
                     referrerPolicy="no-referrer"
                     onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                     }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50 pointer-events-none" />
               </div>
            )}

            <div className="px-6 pt-8 flex justify-between items-start text-white mb-6 relative z-10">

               <div className="flex items-center gap-2 mt-2">
                  {hasSidebar ? (
                     <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex items-center gap-2 hover:bg-white/10 p-2 -ml-2 rounded-full transition-all"
                     >
                        <Menu size={24} />
                     </button>
                  ) : (
                     <div className="w-6"></div>
                  )}
                  <Monitor size={18} className="opacity-80 ml-1" />
                  <span className="font-bold tracking-wide">Kalindo Scan</span>
               </div>

               <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-1 -mr-2">
                     {!isOnline && (
                        <div className="p-2 bg-red-500/20 rounded-full mr-1 animate-pulse" title="Offline Mode">
                           <WifiOff size={18} className="text-white" />
                        </div>
                     )}

                     {isMainView && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_DASHBOARD' && (
                        <button
                           onClick={handleHistoryClick}
                           className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm mr-1"
                           title="View History"
                        >
                           <History size={20} />
                        </button>
                     )}

                     <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm"
                     >
                        <Settings size={20} />
                     </button>

                     {(isHistoryView || isFailedView) && (
                        <button
                           onClick={handleHistoryBack}
                           className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm ml-1 bg-white/10"
                        >
                           <ArrowLeft size={20} />
                        </button>
                     )}

                     {isMainView && (
                        <button
                           onClick={onBack}
                           className="p-2 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm ml-1 bg-white/10"
                        >
                           <ArrowRight size={20} />
                        </button>
                     )}
                  </div>
                  <div className="text-[10px] font-medium text-white/80 mr-1 font-mono tracking-wide mt-1">
                     {todayDate}
                  </div>
               </div>
            </div>

            <div className="px-6 mb-4 relative z-10">
               <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold text-white leading-tight">
                     {currentView === 'SCAN' ? (role === UserRole.GUDANG ? 'Potong Stok' : role) : ''}
                     {currentView === 'SCAN_2' && 'Scan Leader'}
                     {currentView === 'LEADER_PENDING' && 'Pending Scan Leader (LT3)'}
                     {currentView === 'PENDING' && 'Pending Scans (LT3)'}
                     {currentView === 'READY' && 'Resi Ready (LT3)'}
                     {currentView === 'REPORT' && 'Gudang Report'}
                     {currentView === 'BUNDLING' && 'Scan Bundling'}
                     {currentView === 'CANCEL' && 'Scan Cancel (LT3)'}
                     {currentView === 'FAILED_HISTORY' && 'Failed Items'}
                     {currentView === 'LEADER_ORDERS' && 'Semua Orderan Leader'}
                     {currentView === 'LEADER_SUMMARY' && 'Rekap Total Leader'}
                     {isHistoryView && getHistoryTitle()}
                     {currentView === 'SPECIAL_SCAN' && 'Special Scan'}
                  </h1>
                  <p className="text-white/80 text-sm font-medium">{theme.title}</p>
                  <div className="flex items-center gap-2 text-white opacity-90 mt-1 flex-wrap">
                     <div className="flex items-center gap-1.5">
                        <User size={14} className="text-white" />
                        <span className="text-sm font-medium text-white">{employeeName}</span>
                     </div>
                     {userEmail && (
                        <span className="text-[11px] font-mono font-medium bg-black/25 text-white/90 px-2 py-0.5 rounded-full border border-white/10" title="Akun Email Login">
                           {userEmail}
                        </span>
                     )}
                     {isLeader && selectedLeaderProfile && (
                        <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                           Profil: {selectedLeaderProfile}
                        </span>
                     )}
                  </div>

                  {/* DATE FILTER (Leader Reports Only) */}
                  {isLeader && (currentView === 'LEADER_ORDERS' || currentView === 'LEADER_GLOBAL' || currentView === 'LEADER_SUMMARY') && (
                     <div 
                        onClick={() => dateInputRef.current?.showPicker()}
                        className="flex items-center gap-4 mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg group hover:bg-white/20 transition-all cursor-pointer overflow-hidden relative"
                     >
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1.5">
                              <p className="text-[9px] font-black text-indigo-100 uppercase tracking-[0.2em] leading-none text-shadow-sm">DATA TANGGAL PILIHAN</p>
                           </div>
                           <div className="relative">
                              <input
                                 ref={dateInputRef}
                                 type="date"
                                 value={leaderOrdersDate}
                                 onChange={(e) => setLeaderOrdersDate(e.target.value)}
                                 className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <p className="text-xl font-black text-white p-0">
                                 {new Date(leaderOrdersDate).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                 })}
                              </p>
                           </div>
                        </div>
                        
                        <div className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase px-4 py-2.5 rounded-xl border border-white/20 active:scale-95 transition-all shadow-sm flex-shrink-0 animate-pulse">
                           TAP UNTUK UBAH
                        </div>
                     </div>
                  )}

                  {/* PRETELAN / SATUAN Toggle for SCAN_2 */}
                  {isLeader && currentView === 'SCAN_2' && (
                     <div className="flex items-center gap-2 mt-3">
                        <button
                           onClick={() => setLeaderScanType('PRETELAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderScanType === 'PRETELAN'
                                 ? 'bg-white text-purple-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Layers size={16} className={leaderScanType === 'PRETELAN' ? 'text-purple-600' : ''} />
                           PRETELAN
                        </button>
                        <button
                           onClick={() => setLeaderScanType('SATUAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderScanType === 'SATUAN'
                                 ? 'bg-white text-indigo-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Package size={16} className={leaderScanType === 'SATUAN' ? 'text-indigo-600' : ''} />
                           SATUAN
                        </button>
                     </div>
                  )}

                  {/* PRETELAN / SATUAN Toggle for LEADER_ORDERS (Inside the Purple Header) */}
                  {isLeader && currentView === 'LEADER_ORDERS' && (
                     <div className="flex items-center gap-2 mt-3">
                        <button
                           onClick={() => setLeaderOrdersTypeFilter('PRETELAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderOrdersTypeFilter === 'PRETELAN'
                                 ? 'bg-white text-purple-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Layers size={16} className={leaderOrdersTypeFilter === 'PRETELAN' ? 'text-purple-600' : ''} />
                           PRETELAN
                        </button>
                        <button
                           onClick={() => setLeaderOrdersTypeFilter('SATUAN')}
                           className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center gap-2 ${
                              leaderOrdersTypeFilter === 'SATUAN'
                                 ? 'bg-white text-indigo-700 border-white shadow-lg shadow-white/20'
                                 : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                           }`}
                        >
                           <Package size={16} className={leaderOrdersTypeFilter === 'SATUAN' ? 'text-indigo-600' : ''} />
                           SATUAN
                        </button>
                     </div>
                  )}
               </div>
            </div>

            {/* HEADER STATS CARDS - Hidden for LEADER_GLOBAL and LEADER_ORDERS */}
            {isMainView && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_DASHBOARD' && (
               <div className="px-6 grid grid-cols-2 gap-4 relative z-10 md:max-w-2xl">
                  {/* CARD 1: COMPLETED */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex flex-col justify-between h-20">
                     <div className="text-white/90 text-xs font-bold uppercase tracking-wide">Completed</div>
                     <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                        {isLeader && currentView === 'LEADER_PENDING' ? todayItems.length : todayCount} <span className="text-xs font-normal opacity-60">label</span>
                     </div>
                  </div>

                  {/* CARD 2: FAILED/PENDING */}
                  {(isGudang || (isLeader && currentView === 'LEADER_PENDING')) ? (
                     // GUDANG & LEADER PENDING STATS
                     <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex flex-col justify-between h-20">
                        <div className="text-white/90 text-xs font-bold uppercase tracking-wide">Pending</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                           {isLeader && currentView === 'LEADER_PENDING' ? todayItems.length : pendingCount}
                           <span className="text-xs font-normal opacity-60">items</span>
                        </div>
                     </div>
                  ) : (
                     // OTHERS: FAILED CARD (Replaces Target)
                     <button
                        onClick={() => setCurrentView('FAILED_HISTORY')}
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex flex-col justify-between h-20 relative overflow-hidden transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                     >
                        <div className="flex justify-between items-start relative z-10 w-full">
                           <div className="text-red-100 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                              FAILED <ChevronRight size={12} />
                           </div>
                        </div>

                        <div className="relative z-10 mt-1">
                           <div className="text-2xl font-bold text-white flex items-center gap-2">
                              {failedCount}
                              <span className="text-xs font-normal opacity-60">errors</span>
                           </div>
                        </div>
                     </button>
                  )}
               </div>
            )}

            {/* TAB TOGGLE ADMIN */}
            {role === UserRole.ADMIN && (currentView === 'SCAN' || currentView === 'SPECIAL_SCAN') && (
               <div className="px-6 mt-4 relative z-10 md:max-w-2xl pb-6">
                  <div className="flex bg-white/10 p-1.5 rounded-2xl w-full relative border border-white/20 backdrop-blur-md">
                     <div className={`absolute inset-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${currentView === 'SPECIAL_SCAN' ? 'translate-x-full' : 'translate-x-0'}`} />
                     <button
                        onClick={() => setCurrentView('SCAN')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 relative z-10 transition-colors ${currentView === 'SCAN' ? 'text-pink-600 font-bold' : 'text-white/80 font-medium'}`}
                     >
                        <ListOrdered size={16} />
                        <span className="text-sm">Scan List</span>
                     </button>
                     <button
                        onClick={() => setCurrentView('SPECIAL_SCAN')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 relative z-10 transition-colors ${currentView === 'SPECIAL_SCAN' ? 'text-pink-600 font-bold' : 'text-white/80 font-medium'}`}
                     >
                        <ScanLine size={16} />
                        <span className="text-sm">Special Scan</span>
                     </button>
                  </div>
               </div>
            )}
         </div>
         )}



         {currentView === 'LEADER_GLOBAL' && renderGlobalLeaderActivity()}
         {currentView === 'LEADER_ORDERS' && (
            <div className="flex-1 overflow-y-auto p-5 pb-36 no-scrollbar bg-gray-50 dark:bg-gray-950">
               <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6">
                  {/* Summary Footer (Moved to top) ! */}
                  {(() => {
                     const getResi = (barcode: string) => {
                        const match = barcode.match(/\d+\.(\d+)/);
                        return match ? parseInt(match[1], 10) : 0;
                     };

                     // Filter leaderOrdersData based on the type filter first!
                     const currentData = leaderOrdersData.filter(o => {
                        if (leaderOrdersTypeFilter === 'PRETELAN' && o.scan_type !== 'PRETELAN') return false;
                        if (leaderOrdersTypeFilter === 'SATUAN' && o.scan_type !== 'SATUAN') return false;
                        return true;
                     });

                     const calcTotal = (data: any[]) => data.reduce((sum, o) => sum + getResi(o.barcode || ''), 0);

                     const rickyData = currentData.filter(o => o.leader_name?.toUpperCase() === 'RICKY');
                     const akmalData = currentData.filter(o => o.leader_name?.toUpperCase() === 'AKMAL');

                     const formatBatch = (resi: number) => {
                        const batch = resi / 50;
                        return batch.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                     };

                     return (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                           <div className="grid grid-cols-2 gap-4">
                              {/* RICKY */}
                              <div className="text-center md:border-r border-r border-gray-100 dark:border-gray-700/50">
                                 <p className="text-2xl md:text-3xl font-black text-blue-600 leading-none">
                                    {formatBatch(calcTotal(rickyData))} <span className="text-[10px] md:text-xs font-bold text-blue-400/50">Batch</span>
                                 </p>
                                 <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase mt-1">Ricky</p>
                                 <p className="text-[9px] font-bold text-gray-400/60 uppercase">{calcTotal(rickyData)} Resi</p>
                              </div>

                              {/* AKMAL */}
                              <div className="text-center">
                                 <p className="text-2xl md:text-3xl font-black text-green-600 leading-none">
                                    {formatBatch(calcTotal(akmalData))} <span className="text-[10px] md:text-xs font-bold text-green-400/50">Batch</span>
                                 </p>
                                 <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase mt-1">Akmal</p>
                                 <p className="text-[9px] font-bold text-gray-400/60 uppercase">{calcTotal(akmalData)} Resi</p>
                              </div>
                           </div>
                        </div>
                     );
                  })()}

                  {/* Filter Tabs (RICKY/AKMAL) */}
                  <div className="flex gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                     {(['RICKY', 'AKMAL'] as const).map(filter => (
                        <button
                           key={filter}
                           onClick={() => setLeaderOrdersFilter(filter)}
                           className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                              leaderOrdersFilter === filter
                                 ? 'bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#1e1b4b] text-white shadow-lg shadow-purple-900/30'
                                 : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                           }`}
                        >
                           <User size={15} className={leaderOrdersFilter === filter ? 'text-white' : ''} />
                           <span>{filter === 'RICKY' ? 'Ricky' : 'Akmal'}</span>
                        </button>
                     ))}
                  </div>

                  {/* Search & Time Filter */}
                  <div className="flex flex-col sm:flex-row gap-3">
                     <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Cari barcode/nama..."
                           value={leaderOrdersSearch}
                           onChange={(e) => setLeaderOrdersSearch(e.target.value)}
                           className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pl-11 pr-10 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none dark:text-white shadow-sm"
                        />
                        {leaderOrdersSearch && (
                           <button onClick={() => setLeaderOrdersSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <XCircle size={16} />
                           </button>
                        )}
                     </div>
                     <div className="sm:w-48 shrink-0">
                        <select
                           value={leaderOrdersTimeFilter || ''}
                           onChange={(e) => setLeaderOrdersTimeFilter(e.target.value)}
                           className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none dark:text-white shadow-sm appearance-none font-bold text-gray-700 dark:text-gray-200 cursor-pointer"
                        >
                           <option value="">Semua Jam Tarik</option>
                           <option value="09">09:00 - 09:59</option>
                           <option value="10">10:00 - 10:59</option>
                           <option value="11">11:00 - 11:59</option>
                           <option value="12">12:00 - 12:59</option>
                           <option value="13">13:00 - 13:59</option>
                           <option value="14">14:00 - 14:59</option>
                           <option value="15">15:00 - 15:59</option>
                           <option value="16">16:00 - 16:59</option>
                           <option value="17">17:00 - 17:59</option>
                           <option value="18">18:00 - 18:59</option>
                           <option value="19">19:00 - 19:59</option>
                           <option value="20">20:00 - 20:59</option>
                           <option value="21">21:00 - 21:59</option>
                           <option value="22">22:00 - 22:59</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-3">
                     {leaderOrdersData
                        .filter(order => {
                           if (order.leader_name?.toUpperCase() !== leaderOrdersFilter) return false;
                           // Apply PRETELAN/SATUAN filter
                           if (leaderOrdersTypeFilter === 'PRETELAN' && order.scan_type !== 'PRETELAN') return false;
                           if (leaderOrdersTypeFilter === 'SATUAN' && order.scan_type !== 'SATUAN') return false;

                           if (leaderOrdersTimeFilter) {
                              const orderHour = new Date(order.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit' });
                              if (orderHour !== leaderOrdersTimeFilter) return false;
                           }
                           
                           if (leaderOrdersSearch) {
                              const lower = leaderOrdersSearch.toLowerCase();
                              return order.barcode?.toLowerCase().includes(lower) ||
                                 order.leader_name?.toLowerCase().includes(lower) ||
                                 order.assignees?.some((a: string) => a.toLowerCase().includes(lower));
                           }
                           return true;
                        })
                        .length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                           <Package size={48} className="opacity-20 mb-4" />
                           <p className="font-medium">Belum ada orderan</p>
                           <p className="text-xs mt-1">Scan data di menu Scan Leader untuk menambah orderan</p>
                        </div>
                     ) : (
                        leaderOrdersData
                           .filter(order => {
                              if (order.leader_name?.toUpperCase() !== leaderOrdersFilter) return false;
                              if (leaderOrdersTypeFilter === 'PRETELAN' && order.scan_type !== 'PRETELAN') return false;
                              if (leaderOrdersTypeFilter === 'SATUAN' && order.scan_type !== 'SATUAN') return false;
                              if (leaderOrdersTimeFilter) {
                                 const orderHour = new Date(order.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit' });
                                 if (orderHour !== leaderOrdersTimeFilter) return false;
                              }

                              if (leaderOrdersSearch) {
                                 const lower = leaderOrdersSearch.toLowerCase();
                                 return order.barcode?.toLowerCase().includes(lower) ||
                                    order.leader_name?.toLowerCase().includes(lower) ||
                                    order.assignees?.some((a: string) => a.toLowerCase().includes(lower));
                              }
                              return true;
                           })
                           .map((order, idx) => {
                              // Sub Total calculation
                              const resiCount = (() => {
                                 const match = order.barcode?.match(/\d+\.(\d+)/);
                                 return match ? parseInt(match[1], 10) : 0;
                              })();
                              const batchCount = resiCount / 50;

                              return (
                              <div key={order.id || idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex flex-col">
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                       <div className="flex flex-col md:flex-row md:items-center gap-2">
                                          <span className="font-mono font-bold text-lg text-gray-800 dark:text-gray-200 leading-tight break-all">{order.barcode}</span>
                                          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-xl self-start shrink-0">
                                             <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{batchCount.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                             <span className="text-[10px] font-bold text-indigo-400/80 uppercase">Batch</span>
                                             <span className="text-indigo-200 dark:text-indigo-800">|</span>
                                             <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{resiCount}</span>
                                             <span className="text-[10px] font-bold text-indigo-400/80 uppercase">Resi</span>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2 mt-1.5">
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow-sm ${
                                             order.leader_name?.toUpperCase() === 'RICKY'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                          }`}>
                                             {order.leader_name || 'Unknown'}
                                          </span>
                                          {order.scan_type && (
                                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                                                order.scan_type === 'SATUAN'
                                                   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                   : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                             }`}>
                                                {order.scan_type}
                                             </span>
                                          )}
                                       </div>
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-lg shrink-0 ml-2">
                                       {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                                 <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div>
                                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Assign ke:</p>
                                       <div className="flex flex-wrap gap-1">
                                          {(order.assignees || []).map((a: string, i: number) => (
                                             <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1.5 rounded-lg font-bold text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600 shadow-sm">{a}</span>
                                          ))}
                                          {(!order.assignees || order.assignees.length === 0) && (
                                             <span className="text-xs text-gray-400 italic">Belum di-assign</span>
                                          )}
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 dark:border-gray-700 pl-3">
                                       <button 
                                          onClick={() => handleAssignmentSwitchConfirm(order.barcode)}
                                          className="p-2 text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/50 shadow-sm flex items-center justify-center min-w-[32px] min-h-[32px] active:scale-95"
                                          title={`Pindah ke ${order.scan_type === 'PRETELAN' ? 'SATUAN' : 'PRETELAN'}`}
                                       >
                                          <RefreshCw size={14} className={isSwitchingType && pendingSwitchBarcode === order.barcode ? "animate-spin" : ""} />
                                       </button>
                                       <button 
                                          onClick={() => handleAssignmentDeleteConfirm(order.barcode)}
                                          className="p-2 text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors border border-red-200 dark:border-red-800/50 shadow-sm flex items-center justify-center min-w-[32px] min-h-[32px] active:scale-95"
                                          title="Batalkan/Hapus Penugasan"
                                       >
                                          <Trash2 size={14} className={isDeleting && pendingDeleteBarcode === order.barcode ? "animate-pulse" : ""} />
                                       </button>
                                    </div>
                                 </div>
                              </div>
                              );
                           })
                     )}
                  </div>


               </div>
            </div>
         )}
         {currentView === 'LEADER_SUMMARY' && renderLeaderSummary()}
         {currentView === 'LEADER_DASHBOARD' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 custom-scrollbar pb-24">
               <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6">


                  {/* HERO HEADER */}
                  <div className={`${theme.gradient} rounded-3xl p-6 shadow-lg border border-white/10 dark:border-white/5 overflow-hidden relative group`}>
                     {/* Decorative grid pattern matching header */}
                     <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                           <defs>
                              <pattern id="heroGrid" width="40" height="23" patternUnits="userSpaceOnUse" patternTransform="scale(1.2)">
                                 <path d="M0 23 L20 11.5 L40 23 M20 0 L20 11.5" fill="none" stroke="white" strokeWidth="0.5" />
                              </pattern>
                           </defs>
                           <rect width="100%" height="100%" fill="url(#heroGrid)" />
                        </svg>
                     </div>

                     <div className="absolute top-0 right-0 w-full h-full bg-black/10 backdrop-blur-[1px]"></div>
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-all group-hover:bg-white/10"></div>

                     <svg className="absolute top-1/2 left-1/2 w-48 h-48 text-white/5 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40" viewBox="0 0 100 100" fill="currentColor">
                        <polygon points="50,0 100,25 100,75 50,100 0,75 0,25" />
                     </svg>

                     <div className="relative z-10 flex justify-between flex-wrap gap-4">
                        <div>
                           <div className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center mb-4 backdrop-blur-sm border border-white/20 shadow-inner">
                              <Monitor size={24} />
                           </div>
                           <h3 className="text-2xl font-black text-white mb-1 tracking-tight">Halo, {employeeName}!</h3>
                           <p className="text-sm text-indigo-100/80 max-w-sm">
                              Pantau kinerja Picker dan jumlah Packing List (PL) yang telah Anda tugaskan hari ini.
                           </p>
                        </div>
                        <div className="flex gap-3 text-left">
                           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 min-w-[120px]">
                              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">PL Di-assign</p>
                              <p className="text-3xl font-black text-white">{leaderStats?.totalAssignments || 0}</p>
                           </div>
                           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 min-w-[120px]">
                              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Total Scan</p>
                              <p className="text-3xl font-black text-white">{leaderStats?.regularScans || 0}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* PICKER ANALYTICS */}
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-[slideDown_0.3s_ease-out]">

                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                           <h4 className="text-lg font-bold text-gray-900 dark:text-white">Picker Analytics</h4>
                           <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status penugasan PL hari ini (Scan Leader)</p>
                        </div>
                        <div className="relative w-full md:w-64">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search size={14} className="text-gray-400" />
                           </div>
                           <input
                              type="text"
                              placeholder="Cari picker/barcode PL..."
                              value={leaderDashboardSearch}
                              onChange={(e) => setLeaderDashboardSearch(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-9 pr-10 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all dark:text-white"
                           />
                           {leaderDashboardSearch && (
                              <button
                                 onClick={() => setLeaderDashboardSearch('')}
                                 className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              >
                                 <XCircle size={16} />
                              </button>
                           )}
                        </div>
                     </div>

                     <div className="space-y-3">
                        {leaderStats?.pickerLeaderboard.filter(p =>
                           p.name.toLowerCase().includes(leaderDashboardSearch.toLowerCase()) ||
                           p.barcodes.some(c => c.toLowerCase().includes(leaderDashboardSearch.toLowerCase()))
                        ).length === 0 ? (
                           <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                 <FileText size={20} className="text-gray-400" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada penugasan</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Coba assign di menu Scan Leader</p>
                           </div>
                        ) : (
                           leaderStats?.pickerLeaderboard
                              .filter(p =>
                                 p.name.toLowerCase().includes(leaderDashboardSearch.toLowerCase()) ||
                                 p.barcodes.some(c => c.toLowerCase().includes(leaderDashboardSearch.toLowerCase()))
                              )
                              .map((picker, index) => {
                                 const isExpanded = expandedPicker === picker.name || (leaderDashboardSearch.length > 0 && picker.barcodes.some(c => c.toLowerCase().includes(leaderDashboardSearch.toLowerCase())));

                                 return (
                                    <div key={picker.name} className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 transition-all">
                                       <button
                                          onClick={() => setExpandedPicker(isExpanded ? null : picker.name)}
                                          className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                       >
                                          <div className="flex items-center gap-4">
                                             <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                {index + 1}
                                             </div>
                                             <div className="text-left">
                                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                   {picker.name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">{picker.count} Packing List</div>
                                             </div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                             <div className="text-right hidden sm:block">
                                                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{picker.count} Batch</div>
                                             </div>
                                             <div className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180 dark:bg-indigo-900/50' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}>
                                                <ChevronDown size={16} />
                                             </div>
                                          </div>
                                       </button>

                                       {isExpanded && (
                                          <div className="p-4 pt-0 bg-indigo-50/50 dark:bg-indigo-900/10 border-t border-indigo-100 dark:border-indigo-800/30">
                                             <p className="text-xs font-bold text-indigo-800/60 dark:text-indigo-300 uppercase tracking-widest mb-3 mt-4">Detail PL yang di-assign</p>
                                             <div className="flex flex-wrap gap-2">
                                                {picker.barcodes.map((barcode, idx) => (
                                                   <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-700 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-indigo-900 dark:text-indigo-100 shadow-sm">
                                                      <Package size={12} className="text-indigo-400" />
                                                      {barcode}
                                                   </div>
                                                ))}
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 );
                              })
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}
         {currentView !== 'LEADER_DASHBOARD' && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_SUMMARY' && (isFailedView ? renderFailedList() : renderItemList("No items found", isHistoryView ? getHistoryTitle() : (currentView === 'SPECIAL_SCAN' ? "Special Scan" : (role === UserRole.GUDANG ? (currentView === 'SCAN' ? "Potong Stok List" : currentView === 'PENDING' ? "Pending Scans" : currentView === 'READY' ? "Resi Ready" : currentView === 'CANCEL' ? "Scan Cancel List" : currentView === 'BUNDLING' ? "Scan Bundling" : currentView === 'REPORT' ? "Gudang Report" : "Scan List") : (role === UserRole.LEADER && currentView === 'LEADER_PENDING' ? "Pending Scan Leader List" : "Scan List")))))}

         {isMainView && currentView !== 'LEADER_GLOBAL' && currentView !== 'LEADER_ORDERS' && currentView !== 'LEADER_DASHBOARD' && currentView !== 'LEADER_SUMMARY' && (
            <div className="fixed bottom-0 left-0 right-0 p-5 z-50 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-950 dark:via-gray-950/90 pt-10 transition-all flex justify-center pointer-events-none">
               <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700 p-2 flex gap-2 items-center transition-colors relative pointer-events-auto">
                  {renderBottomBar()}
               </div>
            </div>
         )}

         {/* UPDATED SCANNER MODAL WITH TOGGLE PROP AND SPEED */}
         <ScannerModal
            isOpen={isCameraOpen}
            onClose={() => setIsCameraOpen(false)}
            onCapture={handleCameraCapture}
            isProcessing={isProcessing}
            isContinuousScan={isContinuousScan}
            onToggleContinuous={toggleContinuousScan} // Passed function
            recentScans={recentScans}
            toastMessage={cameraToast}
            scanSpeed={scanSpeed} // Pass Scan Speed
            isPaused={!!sequenceAlertModal}
         />

         {/* AUTO-PAUSE & WAJIB ACKNOWLEDGE MODAL (UNTUK CHECKER & PACKING) */}
         {sequenceAlertModal && (
            <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-gray-900 border-2 border-red-500 rounded-2xl sm:rounded-3xl max-w-md w-full my-auto max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_60px_rgba(239,68,68,0.5)] animate-[popIn_0.25s_ease-out]">
                  {/* Danger Header */}
                  <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-3.5 sm:p-5 text-white text-center relative overflow-hidden shrink-0">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
                     <div className="inline-flex p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl mb-1.5 sm:mb-2 shadow-inner border border-white/20 animate-bounce">
                        <AlertOctagon className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
                     </div>
                     <div className="inline-block px-2.5 py-0.5 bg-black/30 rounded-full text-[10px] sm:text-[11px] font-black tracking-widest uppercase mb-1">
                        PERINGATAN RESI DITOLAK
                     </div>
                     <h2 className="text-lg sm:text-2xl font-black tracking-tight uppercase">
                        ⛔ Urutan Belum Lengkap!
                     </h2>
                  </div>

                  {/* Modal Content - Scrollable if screen height is very small */}
                  <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 overscroll-contain">
                     {/* Barcode Display Box */}
                     <div className="bg-black/50 border border-gray-700 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-center">
                        <div className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                           Barcode Resi Ditolak
                        </div>
                        <div className="font-mono text-lg sm:text-2xl font-black text-red-400 break-all select-all tracking-wider">
                           {sequenceAlertModal.barcode}
                        </div>
                     </div>

                     {/* Rejection Detail */}
                     <div className="bg-red-950/40 border border-red-500/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-2.5 sm:gap-3">
                        <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm">
                           <div className="font-black text-red-200 uppercase tracking-wide">
                              Belum Discan Oleh {sequenceAlertModal.targetRole}
                           </div>
                           <div className="text-red-300/80 text-[11px] sm:text-xs mt-1 leading-relaxed">
                              Sebagai <span className="font-bold text-white">{sequenceAlertModal.role}</span>, Anda dilarang memproses paket ini sebelum tahap <span className="font-bold text-amber-300">{sequenceAlertModal.targetRole}</span> selesai discan.
                           </div>
                        </div>
                     </div>

                     {/* Action Required Box */}
                     <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                           <Package className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-400" />
                        </div>
                        <div className="text-[11px] sm:text-xs text-amber-200 leading-snug">
                           <strong className="block text-amber-300 font-bold uppercase mb-0.5">Tindakan Wajib Staf:</strong>
                           Pisahkan paket ini sekarang dan serahkan ke tim <span className="font-bold underline">{sequenceAlertModal.targetRole}</span>!
                        </div>
                     </div>

                     {/* Mandatory Acknowledge Button */}
                     <button
                        type="button"
                        onClick={handleAcknowledgeSequenceAlert}
                        className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white font-black text-sm sm:text-base rounded-xl sm:rounded-2xl shadow-lg shadow-red-600/40 transition-all flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-wider border border-red-400/30 cursor-pointer"
                     >
                        <CheckCircle2 className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-white" />
                        <span>Saya Mengerti & Pisahkan Paket</span>
                     </button>

                     <p className="text-[10px] sm:text-[11px] text-center text-gray-400 italic">
                        Kamera otomatis dijeda. Tekan tombol di atas (atau Enter/Spasi) untuk melanjutkan scan berikutnya.
                     </p>
                  </div>
               </div>
            </div>
         )}

         <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            isSoundEnabled={isSoundEnabled}
            toggleSound={toggleSound}
            // New Props
            isVibrationEnabled={isVibrationEnabled}
            toggleVibration={toggleVibration}
            scanSpeed={scanSpeed}
            setScanSpeed={handleSetScanSpeed}
            //
            userEmail={userEmail}
            employeeName={employeeName}
            scanButtonPosition={scanButtonPosition}
            setScanButtonPosition={setScanButtonPosition}
            role={role}
            isContinuousScan={isContinuousScan}
            toggleContinuousScan={toggleContinuousScan}
            successSoundKey={successSoundKey}
            setSuccessSoundKey={setSuccessSoundKey}
            errorSoundKey={errorSoundKey}
            setErrorSoundKey={setErrorSoundKey}
            soundLibrary={SOUND_LIBRARY}
            devMode={devMode}
            onToggleDevMode={() => setDevMode(prev => !prev)}
         />


         <PinModal
            isOpen={isDeletePinModalOpen}
            onClose={() => {
               setIsDeletePinModalOpen(false);
               setPendingDeleteBarcode(null);
            }}
            onSuccess={handleAssignmentDeleteSubmit}
            userEmail={userEmail}
            accentColor="red"
         />

         <PinModal
            isOpen={isSwitchPinModalOpen}
            onClose={() => {
               setIsSwitchPinModalOpen(false);
               setPendingSwitchBarcode(null);
            }}
            onSuccess={handleAssignmentSwitchSubmit}
            userEmail={userEmail}
            accentColor="blue"
         />

         {isAssignmentModalOpen && (
            <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 md:bg-black/60 md:backdrop-blur-sm flex flex-col justify-start md:justify-center md:items-center p-0 md:p-6 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-950 rounded-none md:rounded-[2.5rem] shadow-2xl w-full md:max-w-lg h-full md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] border-0 md:border border-gray-200 dark:border-gray-800">
                  {/* Modal Header */}
                  <div className="bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#1e1b4b] p-8 pb-10 relative overflow-hidden flex-shrink-0">
                     <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                     <button
                        onClick={() => {
                           setIsAssignmentModalOpen(false);
                           setPendingAssignmentBarcode('');
                           setAssignmentSearchTerm('');
                        }}
                        className="absolute right-4 top-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                     >
                        <X size={24} />
                     </button>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-xl">
                           <Layers size={24} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Assign Packing List</h3>
                     </div>
                     <p className="text-purple-100 text-sm">Scan by: {employeeName} (Leader)</p>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto flex-1">

                     <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-2xl mb-6 border border-purple-100 dark:border-purple-800">
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Barcode Packing List</p>
                        <p className="text-lg font-mono font-bold text-purple-950 dark:text-purple-100">{pendingAssignmentBarcode}</p>
                     </div>

                     <div className="space-y-6">
                        {/* Assignment Mode Toggle */}
                        <div>
                           <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 block">Mode Penugasan</label>
                           <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                              <button
                                 onClick={() => setAssignmentMode('INDIVIDU')}
                                 className={`py-2 rounded-lg text-sm font-bold transition-all ${assignmentMode === 'INDIVIDU'
                                    ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                              >
                                 INDIVIDU
                              </button>
                              <button
                                 onClick={() => setAssignmentMode('TIM')}
                                 className={`py-2 rounded-lg text-sm font-bold transition-all ${assignmentMode === 'TIM'
                                    ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                    }`}
                              >
                                 TIM (GROUP)
                              </button>
                           </div>
                        </div>

                        {/* Picker Selection Logic */}
                        <div>
                           <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex justify-between items-center">
                              <span>Pilih Picker</span>
                              {assignmentMode === 'TIM' && (
                                 <button
                                    onClick={selectAllAssignmentTeam}
                                    className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full active:scale-95 transition-all"
                                 >
                                    {assignmentTeam.length === pickersList.length ? 'Deselect All' : 'Select All'}
                                 </button>
                              )}
                           </label>
                           {/* Search Picker */}
                           <div className="relative mb-3 mt-2">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                 <Search size={16} className="text-gray-400" />
                              </div>
                              <input
                                 type="text"
                                 placeholder="Cari nama picker..."
                                 value={assignmentSearchTerm}
                                 onChange={(e) => setAssignmentSearchTerm(e.target.value)}
                                 className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-2 pl-9 pr-10 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all dark:text-white"
                              />
                              {assignmentSearchTerm && (
                                 <button
                                    onClick={() => setAssignmentSearchTerm('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                 >
                                    <XCircle size={16} />
                                 </button>
                              )}
                           </div>

                           <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1" style={{ minHeight: '20vh' }}>
                              {/* Empty State */}
                              {pickersList.length === 0 && (
                                 <div className="text-center p-4 bg-gray-50 border border-gray-100 dark:bg-gray-800 dark:border-gray-700 rounded-xl">
                                    <p className="text-sm text-gray-500">Tidak ada Picker yang aktif.</p>
                                 </div>
                              )}

                              {sortedPickersForAssignment.filter(p => p.name.toLowerCase().includes(assignmentSearchTerm.toLowerCase())).map(picker => {
                                 const isSelected = assignmentMode === 'INDIVIDU'
                                    ? assignmentPicker === picker.name
                                    : assignmentTeam.includes(picker.name);

                                 const load = leaderStats?.pickerMap[picker.name]?.count || 0;

                                 return (
                                    <button
                                       key={picker.id}
                                       onClick={() => {
                                          if (assignmentMode === 'INDIVIDU') {
                                             setAssignmentPicker(picker.name);
                                          } else {
                                             toggleAssignmentTeam(picker.name);
                                          }
                                       }}
                                       className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${isSelected
                                          ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700'
                                          : 'bg-white border-gray-200 hover:border-purple-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-purple-600'
                                          }`}
                                    >
                                       <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                             {isSelected ? <Check size={16} /> : <User size={16} />}
                                          </div>
                                          <div>
                                             <div className={`font-bold ${isSelected ? 'text-purple-900 dark:text-purple-100' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {picker.name}
                                             </div>
                                             {picker.shift && <div className="text-[10px] text-gray-500 opacity-80 mt-0.5">{picker.shift}</div>}
                                          </div>
                                       </div>
                                       <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${load === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'}`}>
                                          {load} PL
                                       </div>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3 flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
                     <button
                        onClick={() => {
                           setIsAssignmentModalOpen(false);
                           setPendingAssignmentBarcode('');
                           setAssignmentSearchTerm('');
                        }}
                        className="flex-1 py-4 font-bold rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition-all text-lg"
                     >
                        BATAL
                     </button>
                     <button
                        onClick={handleAssignmentSubmit}
                        disabled={isAssigning}
                        className="flex-[2] py-4 bg-purple-600 hover:bg-purple-700 border-2 border-transparent text-white font-bold rounded-2xl shadow-xl shadow-purple-600/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-2 disabled:opacity-70"
                     >
                        {isAssigning ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} />}
                        {isAssigning ? 'MENYIMPAN...' : 'SIMPAN ASSIGN'}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MODAL KONFIRMASI SCAN PICKER */}
         {isPickerModalOpen && pendingPickerScan && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[popIn_0.3s_ease-out] border border-gray-200 dark:border-gray-700">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-picker-600 to-picker-500 dark:from-picker-800 dark:to-picker-700 px-6 py-5">
                     <h3 className="text-xl font-bold text-white">Konfirmasi Scan</h3>
                     <p className="text-white/80 text-sm mt-1">Tentukan halaman untuk data ini</p>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                     {/* Data Scan */}
                     <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 mb-4">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Data Scan</p>
                        <div className="flex items-center justify-between">
                           <p className="font-mono font-bold text-xl text-gray-800 dark:text-gray-200 break-all leading-tight">
                              {pendingPickerScan.barcode}
                           </p>
                           <p className="text-xs text-gray-400 dark:text-gray-500 ml-3 whitespace-nowrap">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </p>
                        </div>
                     </div>

                     {/* Pilih Nomor Halaman - Custom Button */}
                     <div className="bg-blue-50 dark:bg-blue-900/30 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">Pilih Nomor Halaman</p>

                        {/* Both Mobile & Desktop: Button that opens page picker modal */}
                        <button
                           onClick={() => {
                              setIsPagePickerOpen(true);
                              setPageSearchTerm('');
                           }}
                           className="w-full h-14 px-4 bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 rounded-xl text-xl font-bold text-center text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 active:scale-[0.98] hover:border-blue-400 transition-all cursor-pointer"
                        >
                           <span>Page {selectedPage}</span>
                           <ChevronDown size={20} className="text-gray-500" />
                        </button>
                     </div>

                     {/* Preview */}
                     <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview di Scan List:</p>
                        <p className="font-medium text-gray-700 dark:text-gray-300">
                           <span className="text-blue-600 dark:text-blue-400 font-bold">Page {selectedPage}</span>
                           <span className="mx-2">€¢</span>
                           <span className="font-mono">{pendingPickerScan.barcode}</span>
                        </p>
                     </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="px-5 pb-5 flex gap-3">
                     <button
                        onClick={handlePickerCancel}
                        className="flex-1 py-3.5 px-6 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all active:scale-[0.98] border border-gray-200 dark:border-gray-700"
                     >
                        Batal
                     </button>
                     <button
                        onClick={handlePickerConfirm}
                        className="flex-1 py-3.5 px-6 bg-gradient-to-r from-picker-600 to-picker-500 text-white font-bold rounded-xl shadow-lg shadow-picker-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                     >
                        <CheckCircle2 size={20} />
                        Tambah
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* MODAL PILIH NOMOR HALAMAN (Same size as Konfirmasi Scan) */}
         {isPagePickerOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
               {/* Same size as Konfirmasi Scan modal */}
               <div className="bg-white dark:bg-gray-900 w-full max-w-md max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[popIn_0.3s_ease-out] border border-gray-200 dark:border-gray-700">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 flex items-center gap-3 flex-shrink-0">
                     <button
                        onClick={() => setIsPagePickerOpen(false)}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                     >
                        <X size={20} />
                     </button>
                     <div>
                        <h3 className="text-xl font-bold text-white">Pilih Nomor Halaman</h3>
                        <p className="text-white/80 text-sm">Tap untuk memilih</p>
                     </div>
                  </div>

                  {/* Search Input */}
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                     <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Cari nomor halaman..."
                           value={pageSearchTerm}
                           onChange={(e) => setPageSearchTerm(e.target.value)}
                           className="w-full h-12 pl-10 pr-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
                        />
                        {pageSearchTerm && (
                           <button
                              onClick={() => setPageSearchTerm('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                           >
                              <X size={14} />
                           </button>
                        )}
                     </div>
                  </div>

                  {/* Page Grid - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-4">
                     <div className="grid grid-cols-5 gap-2 md:gap-3">
                        {Array.from({ length: 50 }, (_, i) => i + 1)
                           .filter(page => pageSearchTerm === '' || page.toString().includes(pageSearchTerm))
                           .map(page => (
                              <button
                                 key={page}
                                 onClick={() => {
                                    setSelectedPage(page);
                                    setIsPagePickerOpen(false);
                                    setPageSearchTerm('');
                                 }}
                                 className="aspect-square rounded-xl font-bold text-lg transition-all active:scale-95 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white hover:shadow-lg hover:shadow-blue-500/30 hover:border-transparent"
                              >
                                 {page}
                              </button>
                           ))}
                     </div>
                     {pageSearchTerm && !Array.from({ length: 50 }, (_, i) => i + 1).some(p => p.toString().includes(pageSearchTerm)) && (
                        <p className="text-center text-gray-400 py-8">Tidak ditemukan</p>
                     )}
                  </div>

                  {/* Selected Info - Footer */}
                  <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                     <p className="text-center text-gray-600 dark:text-gray-400">
                        Halaman terpilih: <span className="font-bold text-blue-600 dark:text-blue-400 text-xl">Page {selectedPage}</span>
                     </p>
                  </div>
               </div>
            </div>
         )}

         {/* SORTIR: Pin Modal for Mode Switch */}
         <PinModal
            isOpen={isModePinModalOpen}
            expectedPin={(() => {
               // Get pin for CURRENT logged in user
               const savedPins = JSON.parse(localStorage.getItem('kalindo_user_pins') || '{}');
               return savedPins[userEmail] || '123456';
            })()}
            onSuccess={handleModePinSuccess}
            onClose={() => {
               setIsModePinModalOpen(false);
               setPendingModeChange(null);
            }}
            accentColor="purple"
         />

         {/* SORTIR: Team Management Modal (Purple Theme) */}
         {isTeamManagementOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-900 w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[popIn_0.3s_ease-out] border border-gray-200 dark:border-gray-700">
                  <div className="bg-gradient-to-r from-purple-700 to-purple-600 px-6 py-5 flex items-center justify-between flex-shrink-0">
                     <div>
                        <h3 className="text-xl font-bold text-white">Kelola Tim</h3>
                        <p className="text-white/80 text-sm">Pilih anggota Sortir & Packing</p>
                     </div>
                     <button
                        onClick={() => setIsTeamManagementOpen(false)}
                        className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                     >
                        <X size={20} />
                     </button>
                  </div>

                  {/* Search Box */}
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                     <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Cari nama anggota..."
                           value={teamSearchTerm}
                           onChange={(e) => setTeamSearchTerm(e.target.value)}
                           className="w-full h-11 pl-10 pr-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-200"
                        />
                        {teamSearchTerm && (
                           <button
                              onClick={() => setTeamSearchTerm('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                           >
                              <X size={14} />
                           </button>
                        )}
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     <div className="space-y-2">
                        {employees
                           .filter(emp => {
                              // Only show SORTIR and PACKING roles
                              const roles = emp.allowed_roles || [];
                              const isCorrectRole = roles.includes('SORTIR') || roles.includes('PACKING') || roles.includes('PACKING_2') || roles.includes('ADMIN');
                              const matchesSearch = emp.name.toLowerCase().includes(teamSearchTerm.toLowerCase());
                              return isCorrectRole && matchesSearch;
                           })
                           .map(emp => (
                              <button
                                 key={emp.id}
                                 onClick={() => toggleTeamMember(emp.name)}
                                 className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${teamMembers.includes(emp.name)
                                    ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
                                    : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:border-purple-200'
                                    }`}
                              >
                                 <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${teamMembers.includes(emp.name) ? 'bg-purple-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                       {emp.name.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                       <p className={`font-bold ${teamMembers.includes(emp.name) ? 'text-purple-700 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>{emp.name}</p>
                                       <p className="text-xs text-gray-400">
                                          {emp.shift || 'No Shift'} • {(emp.allowed_roles || []).join(', ')}
                                       </p>
                                    </div>
                                 </div>
                                 {teamMembers.includes(emp.name) ? (
                                    <div className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center text-white">
                                       <CheckCircle2 size={16} />
                                    </div>
                                 ) : (
                                    <div className="w-6 h-6 border-2 border-gray-200 dark:border-gray-700 rounded-full" />
                                 )}
                              </button>
                           ))}
                        {employees.filter(emp => {
                           const roles = emp.allowed_roles || [];
                           const isCorrectRole = roles.includes('SORTIR') || roles.includes('PACKING') || roles.includes('PACKING_2') || roles.includes('ADMIN');
                           return isCorrectRole && emp.name.toLowerCase().includes(teamSearchTerm.toLowerCase());
                        }).length === 0 && (
                              <div className="py-12 text-center text-gray-400">
                                 <Users size={48} className="mx-auto mb-3 opacity-20" />
                                 <p>Anggota tidak ditemukan</p>
                              </div>
                           )}
                     </div>
                  </div>

                  <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
                     <button
                        onClick={() => setIsTeamManagementOpen(false)}
                        className="w-full py-4 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-2xl shadow-lg shadow-purple-700/30 transition-all active:scale-[0.98]"
                     >
                        Selesai ({teamMembers.length} Anggota)
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* LEADER PROFILE SELECTION MODAL */}
         {showLeaderProfileModal && isLeader && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] border border-gray-200 dark:border-gray-800">
                  {/* Header */}
                  <div className="bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#1e1b4b] p-8 pb-10 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                     <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mb-10"></div>
                     <div className="relative z-10 flex items-center gap-3 mb-3">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                           <ShieldCheck size={28} className="text-white" />
                        </div>
                        <div>
                           <h3 className="text-xl font-black text-white tracking-tight">Pilih Profil Leader</h3>
                           <p className="text-purple-200/80 text-sm">Wajib dipilih setiap hari</p>
                        </div>
                     </div>
                     <p className="text-purple-200/60 text-xs mt-2">
                        Semua data scan hari ini akan direkam atas nama profil yang dipilih.
                     </p>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-4">
                     <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2">
                        Scanner: <span className="font-bold text-gray-700 dark:text-gray-200">{employeeName}</span>
                     </p>

                     {LEADER_PROFILES.map(profile => (
                        <button
                           key={profile}
                           onClick={() => handleLeaderProfileSelect(profile)}
                           className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                              selectedLeaderProfile === profile
                                 ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-600'
                                 : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'
                           }`}
                        >
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${
                              profile === 'RICKY'
                                 ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                                 : 'bg-gradient-to-br from-green-500 to-green-700 text-white'
                           }`}>
                              {profile.charAt(0)}
                           </div>
                           <div className="text-left flex-1">
                              <p className="font-black text-lg text-gray-800 dark:text-gray-100">{profile}</p>
                              <p className="text-xs text-gray-400">Scan sebagai Leader {profile}</p>
                           </div>
                           {selectedLeaderProfile === profile && (
                              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                                 <Check size={18} className="text-white" />
                              </div>
                           )}
                        </button>
                     ))}
                  </div>

                  {/* Footer note */}
                  <div className="px-6 pb-6">
                     <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
                        Profil akan tersimpan untuk hari ini. Bisa diganti melalui sidebar.
                     </p>
                  </div>
               </div>
            </div>
         )}

         {/* SORTIR: Move Cancel to History Modal */}
         {isMoveCancelModalOpen && pendingMoveCancelItem && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
               <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-[popIn_0.3s_ease-out] border border-gray-200 dark:border-gray-700">
                  <div className="bg-red-600 p-8 text-center relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                     <AlertTriangle size={56} className="text-white mx-auto mb-4 animate-bounce" />
                     <h3 className="text-xl font-black text-white uppercase tracking-tight">Pindah Data Cancel</h3>
                     <p className="text-red-100 text-sm mt-1">Eliminasi resi dari scan list aktif</p>
                  </div>
                  
                  <div className="p-6">
                     <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 mb-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Barcode Resi</p>
                        <p className="font-mono font-bold text-lg text-gray-800 dark:text-gray-100">{pendingMoveCancelItem.barcode}</p>
                     </div>
                     
                     <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                        Data ini akan dipindahkan ke <span className="font-bold text-gray-900 dark:text-gray-200">Riwayat Satuan (Staff Admin)</span> untuk eliminasi. Serahkan resi fisik ke admin setelah memindahkan data ini.
                     </p>
                     
                     <div className="flex gap-3">
                        <button
                           onClick={() => {
                              setIsMoveCancelModalOpen(false);
                              setPendingMoveCancelItem(null);
                           }}
                           className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl active:scale-95 transition-all"
                        >
                           BATAL
                        </button>
                        <button
                           onClick={handleMoveCancelToSatuan}
                           disabled={isMovingCancel}
                           className="flex-[2] py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                           {isMovingCancel ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                           {isMovingCancel ? 'MEMINDAHKAN...' : 'PINDAHKAN'}
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Gudang Report Input Modal */}
         {pendingReportScan && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
               <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl" style={{ animation: 'popIn 0.3s ease-out' }}>
                  <div className="p-4 rounded-t-2xl border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                     <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 text-center">Input Keterangan Report</h3>
                     <p className="text-xs text-center text-gray-500 mt-1">Barcode: <span className="font-mono text-blue-600 dark:text-blue-400">{pendingReportScan}</span></p>
                  </div>
                  <form onSubmit={submitReportScan} className="p-5 space-y-4">
                     <div className="relative">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Keterangan</label>
                        <div 
                           onClick={() => setShowKeteranganDropdown(true)}
                           className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 cursor-pointer flex justify-between items-center focus:ring-2 focus:ring-gudang-500"
                        >
                           <span className={!reportKeterangan ? 'text-gray-400 dark:text-gray-500' : ''}>{reportKeterangan || 'Pilih Keterangan...'}</span>
                           <ChevronDown size={16} className="text-gray-500" />
                        </div>
                        
                        {/* Desktop Dropdown */}
                        {showKeteranganDropdown && (
                           <>
                              <div className="hidden md:block fixed inset-0 z-0" onClick={() => setShowKeteranganDropdown(false)}></div>
                              <ul className="hidden md:block absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto">
                                 {["Kirim seadanya", "Batal barang kosong", "Rusak / Reject", "Lainnya"].map((ket) => (
                                    <li 
                                       key={ket}
                                       onClick={() => {
                                          setReportKeterangan(ket);
                                          setShowKeteranganDropdown(false);
                                       }}
                                       className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gudang-50 dark:hover:bg-gudang-900/30 cursor-pointer"
                                    >
                                       {ket}
                                    </li>
                                 ))}
                              </ul>
                           </>
                        )}

                        {/* Mobile Fullscreen Selection */}
                        {showKeteranganDropdown && (
                           <div className="md:hidden fixed inset-0 z-[120] bg-gray-50 dark:bg-gray-900 flex flex-col">
                              <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                                 <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg ml-2">Pilih Keterangan</h3>
                                 <button 
                                    type="button" 
                                    onClick={() => setShowKeteranganDropdown(false)}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
                                 >
                                    <X size={20} />
                                 </button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-3">
                                 {["Kirim seadanya", "Batal barang kosong", "Rusak / Reject", "Lainnya"].map((ket) => (
                                    <div 
                                       key={ket}
                                       onClick={() => {
                                          setReportKeterangan(ket);
                                          setShowKeteranganDropdown(false);
                                       }}
                                       className={`p-4 mb-2 rounded-xl shadow-sm border text-gray-800 dark:text-gray-200 active:scale-95 transition-transform ${reportKeterangan === ket ? 'bg-gudang-50 border-gudang-500 dark:bg-gudang-900/50' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}
                                    >
                                       <div className="flex justify-between items-center">
                                          <span>{ket}</span>
                                          {reportKeterangan === ket && <CheckCircle2 size={18} className="text-gudang-600 dark:text-gudang-400" />}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                     <div className="relative">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nama Barang (MSKU)</label>
                        <input 
                           type="text" 
                           value={reportNamaBarang} 
                           onChange={(e) => {
                              setReportNamaBarang(e.target.value);
                              setShowSkuDropdown(true);
                           }}
                           onFocus={() => setShowSkuDropdown(true)}
                           onBlur={() => {
                              if (window.innerWidth >= 768) {
                                 setTimeout(() => setShowSkuDropdown(false), 200);
                              }
                           }}
                           className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-gudang-500"
                           placeholder="Contoh: MSKU-12345"
                           autoComplete="off"
                        />
                        {isFetchingSkus && (
                           <div className="absolute right-3 top-[38px] w-4 h-4 border-2 border-gudang-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        
                        {/* Desktop Dropdown */}
                        {showSkuDropdown && skuOptions.length > 0 && (
                           <ul className="hidden md:block absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {skuOptions.filter(s => s.toLowerCase().includes(reportNamaBarang.toLowerCase())).slice(0, 50).map((sku) => (
                                 <li 
                                    key={sku}
                                    onClick={() => {
                                       setReportNamaBarang(sku);
                                       setShowSkuDropdown(false);
                                    }}
                                    className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gudang-50 dark:hover:bg-gudang-900/30 cursor-pointer"
                                 >
                                    {sku}
                                 </li>
                              ))}
                              {skuOptions.filter(s => s.toLowerCase().includes(reportNamaBarang.toLowerCase())).length === 0 && (
                                 <li className="px-3 py-2 text-sm text-gray-500 italic">MSKU tidak ditemukan</li>
                              )}
                           </ul>
                        )}

                        {/* Mobile Fullscreen Search */}
                        {showSkuDropdown && (
                           <div className="md:hidden fixed inset-0 z-[120] bg-gray-50 dark:bg-gray-900 flex flex-col">
                              <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
                                 <div className="flex-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                       <Search size={18} className="text-gray-400" />
                                    </div>
                                    <input 
                                       type="text"
                                       value={reportNamaBarang}
                                       onChange={(e) => setReportNamaBarang(e.target.value)}
                                       className="w-full bg-gray-100 dark:bg-gray-700 border-transparent focus:bg-white focus:border-gudang-500 focus:ring-2 focus:ring-gudang-200 dark:focus:ring-gudang-800 rounded-xl py-2.5 pl-10 pr-4 text-gray-800 dark:text-gray-200 transition-all text-sm"
                                       placeholder="Cari MSKU..."
                                       autoFocus
                                    />
                                 </div>
                                 <button 
                                    type="button" 
                                    onClick={() => setShowSkuDropdown(false)}
                                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
                                 >
                                    <X size={20} />
                                 </button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-3">
                                 {skuOptions.filter(s => s.toLowerCase().includes(reportNamaBarang.toLowerCase())).length === 0 && (
                                    <div className="p-4 text-center text-gray-500 italic">MSKU tidak ditemukan</div>
                                 )}
                                 {skuOptions.filter(s => s.toLowerCase().includes(reportNamaBarang.toLowerCase())).slice(0, 100).map((sku) => (
                                    <div 
                                       key={sku}
                                       onClick={() => {
                                          setReportNamaBarang(sku);
                                          setShowSkuDropdown(false);
                                       }}
                                       className="p-4 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
                                    >
                                       {sku}
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                     <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Qty</label>
                        <input 
                           type="number" 
                           min="1"
                           value={reportQty} 
                           onChange={(e) => setReportQty(e.target.value)}
                           className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                           placeholder="Contoh: 5"
                        />
                     </div>
                     <div className="flex gap-3 pt-2">
                        <button 
                           type="button" 
                           onClick={() => setPendingReportScan(null)}
                           className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200"
                        >
                           Batal
                        </button>
                        <button 
                           type="submit" 
                           className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gudang-600 text-white hover:bg-gudang-700 shadow-md transition-colors"
                        >
                           Simpan Data
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(-50%); }
            25% { transform: translateX(calc(-50% - 5px)); }
            75% { transform: translateX(calc(-50% + 5px)); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      </div>
   );
};


