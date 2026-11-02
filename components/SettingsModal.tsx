
import React, { useState, useEffect, useCallback } from 'react';
import { X, Moon, Sun, Volume2, VolumeX, Monitor, AlignLeft, AlignCenter, AlignRight, ScanLine, Lock, KeyRound, ChevronRight, ArrowLeft, Delete, Loader2, CheckCircle, ShieldCheck, Repeat, Infinity, Music, Play, Smartphone, Gauge, Zap, CheckSquare, Save } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';

interface SettingsModalProps {
   isOpen: boolean;
   onClose: () => void;
   isDarkMode: boolean;
   toggleTheme: () => void;
   isSoundEnabled: boolean;
   toggleSound: () => void;
   // Vibration Prop
   isVibrationEnabled: boolean;
   toggleVibration: () => void;
   // Scan Speed Prop
   scanSpeed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO';
   setScanSpeed: (speed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO') => void;

   userEmail?: string;
   employeeName?: string; // Need employee name to change their pin
   scanButtonPosition?: 'left' | 'center' | 'right';
   setScanButtonPosition?: (pos: 'left' | 'center' | 'right') => void;
   role?: UserRole; // Add role for dynamic theming
   isContinuousScan?: boolean;
   toggleContinuousScan?: () => void;
   // Sound Props
   successSoundKey?: string;
   setSuccessSoundKey?: (key: string) => void;
   errorSoundKey?: string;
   setErrorSoundKey?: (key: string) => void;
   soundLibrary?: any;
   // Dev Mode Props
   devMode?: boolean;
   onToggleDevMode?: () => void;
}

type SettingsView = 'MAIN' | 'CHANGE_PIN' | 'SOUND_SETTINGS' | 'SUPABASE_CONFIG';
type ChangePinStep = 'ENTER_OLD' | 'ENTER_NEW' | 'CONFIRM_NEW';

// --- Helper Components Moved Outside to fix TS issues and for better performance ---

const playPreview = (url: string) => {
   const audio = new Audio(url);
   audio.play().catch(e => console.log(e));
};

const PositionOption = ({ pos, label, icon: Icon, currentPos, onClick }: {
   pos: 'left' | 'center' | 'right',
   label: string,
   icon: any,
   currentPos: 'left' | 'center' | 'right',
   onClick: (pos: 'left' | 'center' | 'right') => void
}) => (
   <button
      onClick={() => onClick(pos)}
      className={`flex-1 min-w-[80px] sm:min-w-0 flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${currentPos === pos
         ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 ring-1 ring-blue-500'
         : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
         }`}
   >
      <div className={`p-2 rounded-full ${currentPos === pos ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
         <Icon size={18} />
      </div>
      <span className="text-xs font-bold text-center leading-tight">{label}</span>
   </button>
);

const SpeedOption = ({ speed, label, icon: Icon, colorClass, currentSpeed, onClick }: {
   speed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO',
   label: string,
   icon: any,
   colorClass: string,
   currentSpeed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO',
   onClick: (speed: 'SLOW' | 'NORMAL' | 'FAST' | 'TURBO') => void
}) => (
   <button
      onClick={() => onClick(speed)}
      className={`flex-1 min-w-[110px] sm:min-w-0 flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all shrink-0 snap-start ${currentSpeed === speed
         ? `bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 ring-1 ring-blue-500`
         : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
         }`}
   >
      <div className={`p-2 rounded-full ${currentSpeed === speed ? colorClass : 'bg-gray-100 dark:bg-gray-700'}`}>
         <Icon size={18} />
      </div>
      <span className="text-xs font-bold text-center leading-tight">{label}</span>
   </button>
);

const SoundOption = ({ label, selected, onClick, url, onPlay }: {
   label: string,
   selected: boolean,
   onClick: () => void,
   url: string,
   onPlay: (url: string) => void,
   key?: any
}) => (
   <button
      onClick={() => { onClick(); onPlay(url); }}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all active:scale-[0.98] ${selected
         ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
         : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
         }`}
   >
      <span className="text-sm font-bold">{label}</span>
      <div className={`p-1.5 rounded-full ${selected ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
         <Play size={12} fill="currentColor" />
      </div>
   </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
   isOpen, onClose, isDarkMode, toggleTheme, isSoundEnabled, toggleSound,
   isVibrationEnabled, toggleVibration, scanSpeed, setScanSpeed,
   userEmail, employeeName, scanButtonPosition = 'right', setScanButtonPosition, role, isContinuousScan = false, toggleContinuousScan,
   successSoundKey = 'BEEP2', setSuccessSoundKey, errorSoundKey = 'DOWN', setErrorSoundKey, soundLibrary,
   devMode = false, onToggleDevMode
}) => {
   const [view, setView] = useState<SettingsView>('MAIN');

   // PIN Change State
   const [pinStep, setPinStep] = useState<ChangePinStep>('ENTER_OLD');
   const [inputPin, setInputPin] = useState('');
   const [newPinTemp, setNewPinTemp] = useState('');
   const [pinError, setPinError] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [showSuccessToast, setShowSuccessToast] = useState(false);

   // Supabase Config State
   const [supaUrl, setSupaUrl] = useState('');
   const [supaKey, setSupaKey] = useState('');
   const [supaNewUrl, setSupaNewUrl] = useState('');
   const [supaNewKey, setSupaNewKey] = useState('');

   useEffect(() => {
      if (!isOpen) return;

      // Initialize Supabase Config State from localStorage
      setSupaUrl(localStorage.getItem('supabase_url') || '');
      setSupaKey(localStorage.getItem('supabase_key') || '');
      setSupaNewUrl(localStorage.getItem('supabase_new_url') || '');
      setSupaNewKey(localStorage.getItem('supabase_new_key') || '');
   }, [isOpen]);

   // Secret Dev Mode Toggle Counters
   const [versionClickCount, setVersionClickCount] = useState(0);
   const handleVersionClick = () => {
      setVersionClickCount(prev => {
         const next = prev + 1;
         if (next >= 7) {
            onToggleDevMode?.();
            const isNowDev = !devMode;
            alert(isNowDev ? "Developer Mode Aktif" : "Developer Mode Mati");
            return 0;
         }
         return next;
      });
      // Reset count after 2 seconds of inactivity
      setTimeout(() => setVersionClickCount(0), 2000);
   };

   useEffect(() => {
      if (!isOpen) return;
      // Reset state on open
      return () => {
         // Optional cleanup
      };
   }, [isOpen]);

   const handleClose = () => {
      setView('MAIN');
      setPinStep('ENTER_OLD');
      setInputPin('');
      setPinError(null);
      setShowSuccessToast(false);
      onClose();
   }

   const handleSaveSupabaseConfig = async () => {
      setIsLoading(true);
      try {
         if (supaUrl) localStorage.setItem('supabase_url', supaUrl.trim());
         else localStorage.removeItem('supabase_url');

         if (supaKey) localStorage.setItem('supabase_key', supaKey.trim());
         else localStorage.removeItem('supabase_key');

         if (supaNewUrl) localStorage.setItem('supabase_new_url', supaNewUrl.trim());
         else localStorage.removeItem('supabase_new_url');

         if (supaNewKey) localStorage.setItem('supabase_new_key', supaNewKey.trim());
         else localStorage.removeItem('supabase_new_key');

         // Dynamic import to avoid circular dependency if possible, but we already import it
         const { refreshSupabaseClients } = await import('../services/supabaseClient');
         refreshSupabaseClients();

         setShowSuccessToast(true);
         setTimeout(() => {
            setShowSuccessToast(false);
            setView('MAIN');
         }, 1500);
      } catch (err) {
         console.error("Failed to save supabase config:", err);
         alert("Gagal menyimpan konfigurasi Supabase");
      } finally {
         setIsLoading(false);
      }
   };

   // --- PIN LOGIC ---
   const handlePinInput = useCallback((num: string) => {
      setInputPin(prev => {
         if (prev.length < 6) {
            const newVal = prev + num;
            setPinError(null);
            return newVal;
         }
         return prev;
      });
   }, []);

   // Trigger PIN processing when length reaches 6
   useEffect(() => {
      if (inputPin.length === 6) {
         const timer = setTimeout(() => processPinStep(inputPin), 200);
         return () => clearTimeout(timer);
      }
   }, [inputPin]);

   const handlePinDelete = useCallback(() => {
      setInputPin(prev => prev.slice(0, -1));
      setPinError(null);
   }, []);

   // Keyboard Listener
   useEffect(() => {
      if (!isOpen || view !== 'CHANGE_PIN') return;

      const handleKeyDown = (e: KeyboardEvent) => {
         if (/^[0-9]$/.test(e.key)) {
            handlePinInput(e.key);
         } else if (e.key === 'Backspace') {
            handlePinDelete();
         } else if (e.key === 'Escape') {
            handleClose();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isOpen, view, handlePinInput, handlePinDelete]);

   const processPinStep = async (val: string) => {
      if (!employeeName) return;

      if (pinStep === 'ENTER_OLD') {
         setIsLoading(true);
         try {
            const { data, error } = await supabase
               .from('employees')
               .select('pin')
               .eq('name', employeeName)
               .single();

            if (error || !data) throw new Error('Auth failed');

            if (data.pin === val) {
               setPinStep('ENTER_NEW');
               setInputPin('');
            } else {
               setPinError("PIN Salah. Silahkan coba lagi");
               setInputPin('');
            }
         } catch (err) {
            setPinError("Error verifikasi PIN");
            setInputPin('');
         } finally {
            setIsLoading(false);
         }
      }
      else if (pinStep === 'ENTER_NEW') {
         setNewPinTemp(val);
         setPinStep('CONFIRM_NEW');
         setInputPin('');
      }
      else if (pinStep === 'CONFIRM_NEW') {
         if (val === newPinTemp) {
            setIsLoading(true);
            try {
               const { error } = await supabase
                  .from('employees')
                  .update({ pin: val })
                  .eq('name', employeeName);

               if (error) throw error;

               // Success Flow
               setShowSuccessToast(true);
               setTimeout(() => {
                  handleClose();
               }, 2000); // Close after 2 seconds

            } catch (err) {
               setPinError("Gagal update PIN");
               setPinStep('ENTER_NEW'); // Retry from start of new pin
               setInputPin('');
            } finally {
               setIsLoading(false);
            }
         } else {
            setPinError("PIN Salah. Silahkan coba lagi");
            setPinStep('ENTER_NEW');
            setInputPin('');
         }
      }
   };

   const getThemeGradient = () => {
      switch (role) {
         case UserRole.PICKER: return 'from-blue-600 to-blue-800';
         case UserRole.SORTIR:
            return 'from-purple-600 to-purple-800';
         case UserRole.SORTIR_BATCH:
            return 'from-teal-600 to-teal-800';
         //
          return 'from-purple-600 to-purple-800';
         case UserRole.PACKING: return 'from-orange-500 to-red-600';
         case UserRole.GUDANG: return 'from-emerald-600 to-teal-800';
         default: return 'from-blue-600 to-blue-800';
      }
   };

   const testVibration = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.navigator && typeof window.navigator.vibrate === 'function') {
         // Standard pattern: 200ms vibrate
         const success = window.navigator.vibrate([200]);
         if (!success) {
            console.warn("Vibration failed or not supported by device/browser context");
         }
      }
   };

   const renderPinPad = () => {
      const isOld = pinStep === 'ENTER_OLD';
      const isNew = pinStep === 'ENTER_NEW';
      const isConfirm = pinStep === 'CONFIRM_NEW';

      const gradientClass = getThemeGradient();

      return (
         <div className="w-full flex flex-col md:flex-row h-full relative">

            {/* SUCCESS TOAST OVERLAY */}
            {showSuccessToast && (
               <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[70] animate-[slideDown_0.5s_ease-out] w-[90%] max-w-sm flex justify-center">
                  <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20 shadow-emerald-500/30 backdrop-blur-md">
                     <CheckCircle size={24} className="shrink-0" />
                     <span className="font-bold text-lg">PIN Berhasil Diubah!</span>
                  </div>
               </div>
            )}

            {/* DESKTOP LEFT (Visuals) */}
            <div className={`hidden md:flex md:w-1/2 bg-gradient-to-br ${gradientClass} p-10 flex-col items-center justify-center text-center text-white relative overflow-hidden transition-colors duration-500`}>
               <div className="absolute inset-0 bg-gradient-to-br opacity-80"></div>
               <div className="relative z-10 text-center">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
                     {isOld && <ShieldCheck size={40} />}
                     {isNew && <KeyRound size={40} />}
                     {isConfirm && <CheckCircle size={40} />}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                     {isOld && 'Verifikasi Keamanan'}
                     {isNew && 'PIN Baru'}
                     {isConfirm && 'Konfirmasi'}
                  </h3>
                  <p className="text-blue-100 text-sm max-w-[200px] mx-auto">
                     {isOld && 'Demi keamanan, masukkan PIN lama Anda terlebih dahulu.'}
                     {isNew && 'Enter your 6-digit personal code.'}
                     {isConfirm && 'Enter your 6-digit personal code.'}
                  </p>
               </div>
               {/* Decor Shapes */}
               <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
               <div className="absolute bottom-[-20px] right-[-20px] w-40 h-40 bg-white opacity-20 rounded-full blur-2xl"></div>
            </div>

            {/* RIGHT / MOBILE (Input) */}
            <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col items-center justify-center bg-white dark:bg-gray-900">

               {/* Mobile Header Icon */}
               <div className="md:hidden text-center mb-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-600 dark:text-blue-400">
                     {isOld && <ShieldCheck size={24} />}
                     {isNew && <KeyRound size={24} />}
                     {isConfirm && <CheckCircle size={24} />}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                     {isOld && 'Verifikasi Keamanan'}
                     {isNew && 'PIN Baru'}
                     {isConfirm && 'Konfirmasi'}
                  </h3>
               </div>

               {/* Instruction Text (Mobile) */}
               <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 text-center px-8 md:px-0 md:hidden">
                  {isOld && 'Demi keamanan, masukkan PIN lama Anda terlebih dahulu.'}
                  {isNew && 'Enter your 6-digit personal code.'}
                  {isConfirm && 'Enter your 6-digit personal code.'}
               </p>

               {/* PIN Display */}
               <div className="flex gap-3 mb-4 md:mb-6 h-8 items-center justify-center w-full">
                  {[...Array(6)].map((_, i) => (
                     <div
                        key={i}
                        className={`
                    w-3.5 h-3.5 rounded-full transition-all duration-300 ease-out 
                    ${i < inputPin.length
                              ? (pinError ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-blue-600 dark:bg-blue-500 scale-110 shadow-blue-500/50')
                              : 'bg-gray-200 dark:bg-gray-700 scale-100'
                           }
                  `}
                     />
                  ))}
               </div>

               {/* Status Container */}
               <div className="h-8 mb-2 flex items-center justify-center w-full">
                  {pinError && (
                     <p className="text-red-500 text-xs font-bold animate-[shake_0.4s_ease-in-out] bg-red-50 px-3 py-1 rounded-full border border-red-100">{pinError}</p>
                  )}
                  {isLoading && (
                     <p className="text-blue-500 text-xs font-bold flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Memproses...</p>
                  )}
               </div>

               {/* Keypad - Matched Design */}
               <div className="grid grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-3.5 sm:gap-y-4.5 w-full max-w-[280px] sm:max-w-[320px] justify-items-center">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                     <button
                        key={num}
                        onClick={() => handlePinInput(num.toString())}
                        disabled={isLoading || showSuccessToast}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 select-none"
                     >
                        {num}
                     </button>
                  ))}
                  <div className="w-16 h-16 sm:w-20 sm:h-20"></div>
                  <button
                     onClick={() => handlePinInput('0')}
                     disabled={isLoading || showSuccessToast}
                     className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 select-none"
                  >
                     0
                  </button>
                  <button
                     onClick={handlePinDelete}
                     disabled={isLoading || showSuccessToast}
                     className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-all active:scale-90 active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer disabled:opacity-50 select-none"
                  >
                     <Delete size={26} />
                  </button>
               </div>

               <button 
                  onClick={() => { setPinStep('TAB'); setInputPin(''); setPinError(null); }} 
                  disabled={isLoading || showSuccessToast} 
                  className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-semibold px-6 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
               >
                  Batal
               </button>
            </div>
         </div>
      );
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:px-4">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>

         {/* 
        MODAL CONTAINER 
        - Full screen on Mobile
        - WIDER on Desktop
      */}
         <div className={`bg-white dark:bg-gray-900 w-full h-full md:h-auto md:max-h-[90dvh] ${view === 'CHANGE_PIN' ? 'md:max-w-4xl' : 'md:max-w-2xl'} rounded-none md:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden md:border border-gray-100 dark:border-gray-800 animate-[slideUp_0.3s_ease-out] flex flex-col transition-all duration-300`}>

            {view === 'MAIN' && (
               <div className="p-6 overflow-y-auto min-h-0 flex-1">
                  <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 md:hidden"></div>

                  {/* Header */}
                  <div className="flex justify-between items-center mb-6 shrink-0">
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pengaturan</h2>
                     <button onClick={handleClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                     </button>
                  </div>

                  {/* Account Info - Only on Main */}
                  <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl p-4 mb-6 flex items-center gap-4 border border-gray-100 dark:border-gray-700 shadow-sm shrink-0">
                     <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 border border-blue-200 dark:border-blue-800">
                        <Monitor size={24} />
                     </div>
                     <div className="overflow-hidden flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-0.5">Active Account</p>
                        <div className="flex justify-between items-center">
                           <div>
                              <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{employeeName || 'Unknown Employee'}</p>
                              <p className="text-xs text-gray-400 truncate font-mono">{userEmail}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Change PIN Button */}
                     {employeeName && (
                        <button
                           onClick={() => setView('CHANGE_PIN')}
                           className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm group hover:border-blue-300 dark:hover:border-blue-700 h-full"
                        >
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                                 <Lock size={20} />
                              </div>
                              <div className="text-left">
                                 <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Ganti PIN</p>
                                 <p className="text-xs text-gray-500">Ubah kode akses keamanan</p>
                              </div>
                           </div>
                           <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-500" />
                        </button>
                     )}

                     {/* Continuous Scan Toggle */}
                     {toggleContinuousScan && (
                        <button
                           onClick={toggleContinuousScan}
                           className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm h-full"
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isContinuousScan ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>
                                 <Infinity size={22} />
                              </div>
                              <div className="text-left">
                                 <p className="font-bold text-gray-900 dark:text-white">Scan Berkelanjutan</p>
                                 <p className="text-xs text-gray-500">{isContinuousScan ? 'Kamera tetap terbuka' : 'Kamera auto-tutup'}</p>
                              </div>
                           </div>
                           <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isContinuousScan ? 'bg-blue-600' : 'bg-gray-200'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isContinuousScan ? 'translate-x-6' : 'translate-x-0'}`}></div>
                           </div>
                        </button>
                     )}

                     {/* Theme Toggle */}
                     <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm h-full"
                     >
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                              {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                           </div>
                           <div className="text-left">
                              <p className="font-bold text-gray-900 dark:text-white">Tampilan</p>
                              <p className="text-xs text-gray-500">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</p>
                           </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}>
                           <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                     </button>

                     {/* Sound Toggle */}
                     <button
                        onClick={toggleSound}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm h-full"
                     >
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSoundEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                              {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                           </div>
                           <div className="text-left">
                              <p className="font-bold text-gray-900 dark:text-white">Suara Efek</p>
                              <p className="text-xs text-gray-500">{isSoundEnabled ? 'Nyala' : 'Mati'}</p>
                           </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isSoundEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                           <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isSoundEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                     </button>

                     {/* Sound Selection Menu Entry */}
                     {isSoundEnabled && (
                        <button
                           onClick={() => setView('SOUND_SETTINGS')}
                           className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm group hover:border-pink-300 dark:hover:border-pink-700 h-full"
                        >
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 flex items-center justify-center group-hover:bg-pink-200 dark:group-hover:bg-pink-900/40 transition-colors">
                                 <Music size={20} />
                              </div>
                              <div className="text-left">
                                 <p className="font-bold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">Pilihan Suara</p>
                                 <p className="text-xs text-gray-500">Ganti nada success & error</p>
                              </div>
                           </div>
                           <ChevronRight size={20} className="text-gray-300 group-hover:text-pink-500" />
                        </button>
                     )}

                     {/* Vibration Toggle (NEW) */}
                     <button
                        onClick={toggleVibration}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm h-full"
                     >
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isVibrationEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                              {isVibrationEnabled ? <Smartphone size={20} /> : <Smartphone size={20} className="opacity-50" />}
                           </div>
                           <div className="text-left">
                              <p className="font-bold text-gray-900 dark:text-white">Mode Getar</p>
                              <p className="text-xs text-gray-500">{isVibrationEnabled ? 'Aktif' : 'Non-aktif'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           {/* Test Button - Only show if enabled */}
                           {isVibrationEnabled && (
                              <div
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    if (navigator.vibrate) {
                                       const success = navigator.vibrate([200]);
                                       if (!success) alert("Browser blocked vibration. Tap anywhere first.");
                                    } else {
                                       alert("Device does not support vibration API");
                                    }
                                 }}
                                 className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold cursor-pointer hover:bg-amber-200"
                                 title="Klik untuk tes getar & beri izin browser"
                              >
                                 Test Getar
                              </div>
                           )}
                           <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isVibrationEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isVibrationEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                           </div>
                        </div>
                     </button>

                     {/* Scan Speed Selector */}
                     <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm md:col-span-2 overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                                 <Gauge size={20} />
                              </div>
                              <div>
                                 <p className="font-bold text-gray-900 dark:text-white">Kecepatan Scanner</p>
                                 <p className="text-xs text-gray-500">Atur responsivitas kamera</p>
                              </div>
                           </div>
                           <span className="text-[10px] text-gray-400 font-medium sm:hidden">Geser &rarr;</span>
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 -mx-2 px-2 no-scrollbar snap-x touch-pan-x">
                           <SpeedOption speed="SLOW" label="Lambat (Akurat)" icon={CheckSquare} colorClass="bg-green-100 text-green-600" currentSpeed={scanSpeed} onClick={setScanSpeed} />
                           <SpeedOption speed="NORMAL" label="Normal (Stabil)" icon={ScanLine} colorClass="bg-blue-100 text-blue-600" currentSpeed={scanSpeed} onClick={setScanSpeed} />
                           <SpeedOption speed="FAST" label="Cepat (Responsif)" icon={Zap} colorClass="bg-orange-100 text-orange-600" currentSpeed={scanSpeed} onClick={setScanSpeed} />
                           <SpeedOption speed="TURBO" label="Kilat (Mode Balap)" icon={Infinity} colorClass="bg-red-100 text-red-600" currentSpeed={scanSpeed} onClick={setScanSpeed} />
                        </div>
                     </div>

                     {/* Scan Button Position */}
                     {setScanButtonPosition && (
                        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm md:col-span-2">
                           <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                 <AlignLeft size={20} />
                              </div>
                              <div>
                                 <p className="font-bold text-gray-900 dark:text-white">Posisi Tombol Scan</p>
                                 <p className="text-xs text-gray-500">Atur tata letak tombol</p>
                              </div>
                           </div>
                           <div className="grid grid-cols-3 gap-2">
                              <PositionOption pos="left" label="Kiri" icon={AlignLeft} currentPos={scanButtonPosition as any} onClick={setScanButtonPosition} />
                              <PositionOption pos="center" label="Tengah" icon={AlignCenter} currentPos={scanButtonPosition as any} onClick={setScanButtonPosition} />
                              <PositionOption pos="right" label="Kanan" icon={AlignRight} currentPos={scanButtonPosition as any} onClick={setScanButtonPosition} />
                           </div>
                        </div>
                     )}
                     {/* Supabase Dynamic Config Button (Admin Only or Hidden Dev Menu) */}
                     {devMode && role === UserRole.LEADER && (
                        <button
                           onClick={() => setView('SUPABASE_CONFIG')}
                           className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl active:scale-[0.98] transition-all shadow-sm group hover:border-blue-500 dark:hover:border-blue-400 h-full md:col-span-2"
                        >
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                                 <ShieldCheck size={20} />
                              </div>
                              <div className="text-left">
                                 <p className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Konfigurasi Database</p>
                                 <p className="text-xs text-gray-500">Atur Supabase URL & Anon Key</p>
                              </div>
                           </div>
                           <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500" />
                        </button>
                     )}
                  </div>

                  <div className="mt-8 text-center shrink-0">
                     <p 
                        onClick={handleVersionClick}
                        className="text-xs text-gray-400 font-mono cursor-pointer active:scale-95 transition-transform"
                     >
                        v2.3 Cloud • Secure {devMode && <span className="text-orange-500 font-bold ml-1">DEV</span>}
                     </p>
                  </div>
               </div>
            )}

            {/* SOUND SETTINGS VIEW - FIXED SCROLL ISSUE */}
            {view === 'SOUND_SETTINGS' && (
               <div className="flex flex-col h-full w-full max-h-[90vh]">
                  {/* Header */}
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                     <button onClick={() => setView('MAIN')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ArrowLeft size={16} /> <span className="text-xs font-bold">Kembali</span>
                     </button>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pilihan Suara</h3>
                     <button onClick={handleClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                     </button>
                  </div>

                  {/* Content - Added proper scrolling */}
                  <div className="p-6 flex-1 overflow-y-auto min-h-0">
                     {soundLibrary && setSuccessSoundKey && setErrorSoundKey && (
                        <div className="space-y-6 pb-6">
                           <div className="p-4 bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-900/30 rounded-2xl flex items-center gap-3">
                              <Music size={24} className="text-pink-500" />
                              <p className="text-sm text-pink-700 dark:text-pink-300">
                                 Pilih suara notifikasi yang sesuai dengan preferensi Anda. Klik untuk mendengarkan preview.
                              </p>
                           </div>

                           <div>
                              <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide px-1">Success Sound (Berhasil)</p>
                              <div className="grid grid-cols-1 gap-2">
                                 {Object.entries(soundLibrary.SUCCESS).map(([key, data]: any) => (
                                    <SoundOption
                                       key={key}
                                       label={data.label}
                                       url={data.url}
                                       selected={successSoundKey === key}
                                       onClick={() => setSuccessSoundKey(key)}
                                       onPlay={playPreview}
                                    />
                                 ))}
                              </div>
                           </div>

                           <div>
                              <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide px-1">Error Sound (Gagal/Duplikat)</p>
                              <div className="grid grid-cols-1 gap-2">
                                 {Object.entries(soundLibrary.ERROR).map(([key, data]: any) => (
                                    <SoundOption
                                       key={key}
                                       label={data.label}
                                       url={data.url}
                                       selected={errorSoundKey === key}
                                       onClick={() => setErrorSoundKey(key)}
                                       onPlay={playPreview}
                                    />
                                 ))}
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}

            {/* SUPABASE CONFIG VIEW */}
            {view === 'SUPABASE_CONFIG' && (
               <div className="flex flex-col h-full w-full max-h-[90vh]">
                  {/* Header */}
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                     <button onClick={() => setView('MAIN')} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ArrowLeft size={16} /> <span className="text-xs font-bold">Kembali</span>
                     </button>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">Supabase Config</h3>
                     <button onClick={handleClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                     </button>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 overflow-y-auto min-h-0 bg-gray-50 dark:bg-gray-950">
                     <div className="max-w-md mx-auto space-y-6 pb-6">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-start gap-3">
                           <ShieldCheck size={24} className="text-blue-500 shrink-0" />
                           <p className="text-xs text-blue-700 dark:text-blue-300">
                              Data kredensial akan disimpan secara lokal di browser ini. Gunakan untuk mengganti database jika database utama penuh. Kosongkan untuk menggunakan nilai default.
                           </p>
                        </div>

                        {/* Project 1 (Main) */}
                        <div className="space-y-4">
                           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Database Utama (Lama)</h4>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 ml-1">SUPABASE URL</label>
                              <input
                                 type="text"
                                 value={supaUrl}
                                 onChange={(e) => setSupaUrl(e.target.value)}
                                 placeholder="https://xxxx.supabase.co"
                                 className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono transition-all"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 ml-1">ANON KEY</label>
                              <textarea
                                 value={supaKey}
                                 onChange={(e) => setSupaKey(e.target.value)}
                                 placeholder="eyJhbGci..."
                                 rows={3}
                                 className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono transition-all resize-none"
                              />
                           </div>
                        </div>

                        {/* Project 2 (New) */}
                        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Database Baru (Target Search All)</h4>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 ml-1">SUPABASE URL NEW</label>
                              <input
                                 type="text"
                                 value={supaNewUrl}
                                 onChange={(e) => setSupaNewUrl(e.target.value)}
                                 placeholder="https://yyyy.supabase.co"
                                 className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono transition-all"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 ml-1">ANON KEY NEW</label>
                              <textarea
                                 value={supaNewKey}
                                 onChange={(e) => setSupaNewKey(e.target.value)}
                                 placeholder="eyJhbGci..."
                                 rows={3}
                                 className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono transition-all resize-none"
                              />
                           </div>
                        </div>

                        {/* Save Button */}
                        <button
                           onClick={handleSaveSupabaseConfig}
                           disabled={isLoading}
                           className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold font-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                           {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                           Simpan & Refresh Koneksi
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* CHANGE PIN VIEW */}
            {view === 'CHANGE_PIN' && (
               <div className="flex flex-col h-full w-full">
                  {/* Header for Change Pin - Only on Mobile or Top bar */}
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 md:hidden">
                     <button onClick={() => { setView('MAIN'); setInputPin(''); setPinStep('ENTER_OLD'); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ArrowLeft size={16} /> <span className="text-xs font-bold">Kembali</span>
                     </button>
                     <button onClick={handleClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                     </button>
                  </div>

                  {/* Desktop Close Button for Split View */}
                  <button
                     onClick={() => { setView('MAIN'); setInputPin(''); setPinStep('ENTER_OLD'); }}
                     className="hidden md:flex absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 dark:bg-gray-800/50 dark:hover:bg-gray-700 rounded-full transition-colors z-20 text-gray-500 dark:text-gray-400"
                  >
                     <X size={24} />
                  </button>

                  <div className="flex-1 min-h-0">
                     {renderPinPad()}
                  </div>
               </div>
            )}
         </div>

         <style>{`
         @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
         }
         @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
         }
         @keyframes slideDown {
            from { transform: translate(-50%, -20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
         }
      `}</style>
      </div>
   );
};
