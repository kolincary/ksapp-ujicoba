
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Search, ChevronRight, Loader2, ArrowLeft, Filter, X, ShieldCheck, Lock, KeyRound, Delete, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';
import { getActiveLoginTheme, LoginThemeVariant } from '../services/themeSyncService';

interface NameSelectionModalProps {
  onSelect: (name: string) => void;
  onBack: () => void;
  userEmail: string;
  role: UserRole | null;
}

interface Employee {
  id: number;
  name: string;
  allowed_roles?: string[];
  shift?: string;
  pin?: string | null;
}

// Memoized Button Component
const EmployeeButton = React.memo(({ emp, role, onClick }: { emp: Employee, role: UserRole | null, onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between p-3 sm:p-3.5 lg:p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl sm:rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:border-blue-800 transition-all group active:scale-[0.99] shadow-sm text-left"
  >
    <div className="flex-1 min-w-0 pr-2">
      <div className="flex items-center gap-3 sm:gap-3.5">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-800 group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors shrink-0">
          <User size={20} className="sm:w-5 sm:h-5" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <span className="font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 text-sm sm:text-base block truncate">
            {emp.name}
          </span>
          {emp.shift && (
            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-md font-medium border truncate max-w-full ${emp.shift === 'Shift Suhel'
              ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
              : role === UserRole.ADMIN
              ? 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800'
              : 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
              }`}>
              {emp.shift}
            </span>
          )}
        </div>
      </div>
    </div>
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shrink-0">
      <ChevronRight size={16} className="text-gray-400 group-hover:text-white sm:w-4.5 sm:h-4.5" />
    </div>
  </button>
));

type PinStep = 'LIST' | 'CREATE' | 'CONFIRM' | 'VERIFY';

export const NameSelectionModal: React.FC<NameSelectionModalProps> = ({ onSelect, onBack, userEmail, role }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // PIN Logic State
  const [currentStep, setCurrentStep] = useState<PinStep>('LIST');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [tempCreatePin, setTempCreatePin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  // Active theme (Tema 1 vs Tema 2)
  const [activeTheme] = useState<LoginThemeVariant>(() => getActiveLoginTheme());
  const [isDarkMode] = useState<boolean>(() => {
    return (
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark'
    );
  });

  // Ref to prevent state updates on unmounted component
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchEmployees();
    return () => { isMounted.current = false; };
  }, []);

  const fetchEmployees = async () => {
    try {
      if (isMounted.current) setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      if (isMounted.current) setEmployees(data || []);
    } catch (err: any) {
      console.error("Error fetching employees:", err);
      if (isMounted.current) {
        if (err.code === '42P01') {
          setError("Table 'employees' missing. Please run SQL setup.");
        } else {
          setError(`Gagal memuat data karyawan: ${err.message || JSON.stringify(err)}`);
        }
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesRole = true;
      if (role === UserRole.SORTIR_BATCH) {
         // Khusus SORTIR_BATCH: abaikan allowed_roles, filter berdasarkan shift "Harian"
         matchesRole = !!emp.shift && emp.shift.toLowerCase().includes('harian');
      } else if (emp.allowed_roles === null || emp.allowed_roles === undefined) {
        matchesRole = true;
      } else if (Array.isArray(emp.allowed_roles)) {
        if (emp.allowed_roles.length === 0) matchesRole = false;
        else matchesRole = role ? emp.allowed_roles.includes(role) : true;
      }
      return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, role]);

  // --- PIN LOGIC HANDLERS ---

  const handleEmployeeClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setPinInput('');
    setPinError(null);
    setTempCreatePin('');
    setIsSuccess(false);

    if (emp.pin) {
      setCurrentStep('VERIFY');
    } else {
      setCurrentStep('CREATE');
    }
  };

  const handlePinInput = useCallback((num: string) => {
    if (isPinLoading || isSuccess) return;

    setPinInput(prev => {
      if (prev.length < 6) {
        const newPin = prev + num;
        setPinError(null);
        setShake(false);
        return newPin;
      }
      return prev;
    });
  }, [isPinLoading, isSuccess]);

  // Trigger submit when pin reaches 6
  useEffect(() => {
    if (pinInput.length === 6) {
      const timer = setTimeout(() => processPinSubmit(pinInput), 200);
      return () => clearTimeout(timer);
    }
  }, [pinInput]);

  const handlePinDelete = useCallback(() => {
    if (isPinLoading || isSuccess) return;
    setPinInput(prev => prev.slice(0, -1));
    setPinError(null);
    setShake(false);
  }, [isPinLoading, isSuccess]);

  // Keyboard Listener
  useEffect(() => {
    if (currentStep === 'LIST') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        handlePinDelete();
      } else if (e.key === 'Escape') {
        handleBackFromPin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, handlePinInput, handlePinDelete]);

  const processPinSubmit = async (finalPin: string) => {
    if (!selectedEmployee) return;

    if (currentStep === 'CREATE') {
      setTempCreatePin(finalPin);
      setPinInput('');
      setCurrentStep('CONFIRM');
    }
    else if (currentStep === 'CONFIRM') {
      if (finalPin === tempCreatePin) {
        // Save PIN to Supabase
        setIsPinLoading(true);
        try {
          // Use .select() to confirm the update actually happened and returns data
          const { data, error } = await supabase
            .from('employees')
            .update({ pin: finalPin })
            .eq('id', selectedEmployee.id)
            .select(); // Critical for verification

          if (error) throw error;

          if (!data || data.length === 0) {
            throw new Error("Data verification failed. Row not updated.");
          }

          if (!isMounted.current) return;

          // SHOW SUCCESS STATE
          setIsSuccess(true);

          // Wait 1.5s to show success checkmark before navigating
          // This ensures the user SEES that it worked and prevents immediate unmount race conditions
          setTimeout(() => {
            if (isMounted.current) {
              onSelect(selectedEmployee.name);
            }
          }, 1500);

        } catch (err: any) {
          console.error("PIN Save Error:", err);
          if (isMounted.current) {
            setPinError(err.message === "Failed to fetch" ? "Koneksi Internet Error." : "Gagal menyimpan PIN. Coba lagi.");
            setPinInput('');
            setTempCreatePin('');
            setCurrentStep('CREATE');
            setIsSuccess(false);
            setShake(true);
            setTimeout(() => setShake(false), 450);
          }
        } finally {
          if (isMounted.current) setIsPinLoading(false);
        }
      } else {
        setPinError("PIN Tidak Cocok. Ulangi.");
        setPinInput('');
        setTempCreatePin('');
        setCurrentStep('CREATE');
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    }
    else if (currentStep === 'VERIFY') {
      if (finalPin === selectedEmployee.pin) {
        setIsSuccess(true);
        setTimeout(() => {
          if (isMounted.current) {
            onSelect(selectedEmployee.name);
          }
        }, 800);
      } else {
        setPinError("PIN Salah. Coba lagi.");
        setPinInput('');
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    }
  };

  const handleBackFromPin = () => {
    if (isPinLoading || isSuccess) return;
    setCurrentStep('LIST');
    setSelectedEmployee(null);
    setPinInput('');
    setPinError(null);
    setShake(false);
  };

  const getThemeGradient = () => {
    switch (role) {
      case UserRole.ADMIN: return 'from-pink-600 to-rose-500';
      case UserRole.PICKER:
      case UserRole.PICKER_2: return 'from-blue-600 to-blue-800';
      case UserRole.SORTIR:
         return 'from-purple-600 to-purple-800';
      case UserRole.SORTIR_BATCH:
      case UserRole.CHECKER:
         return 'from-teal-600 to-teal-800';
      case UserRole.PACKING:
      case UserRole.PACKING_2: return 'from-orange-500 to-red-600';
      case UserRole.GUDANG: return 'from-emerald-600 to-teal-800';
      default: return 'from-blue-600 to-blue-800';
    }
  };

  const getPinDotColor = () => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-pink-600 dark:bg-pink-400';
      case UserRole.SORTIR:
         return 'bg-purple-600 dark:bg-purple-400';
      case UserRole.SORTIR_BATCH:
      case UserRole.CHECKER: 
         return 'bg-teal-600 dark:bg-teal-400';
      case UserRole.PACKING:
      case UserRole.PACKING_2: return 'bg-orange-500 dark:bg-orange-400';
      case UserRole.GUDANG: return 'bg-emerald-600 dark:bg-emerald-400';
      default: return 'bg-blue-600 dark:bg-blue-500';
    }
  };

  const renderPinModal = () => {
    const isCreating = currentStep === 'CREATE';
    const isConfirming = currentStep === 'CONFIRM';
    const isVerifying = currentStep === 'VERIFY';

    /* =========================================================================
       TEMA 2: SPLIT CARD (MIDNIGHT NAVY + MINIMALIST KEYPAD)
       ========================================================================= */
    if (activeTheme === 'tema_2') {
      const getTitle = () => {
        if (isCreating) return 'Buat PIN Baru';
        if (isConfirming) return 'Konfirmasi PIN';
        return 'Verifikasi keamanan';
      };

      const getLeftSubtitle = () => {
        if (isCreating) return 'Buat 6-digit PIN keamanan untuk akun Anda.';
        if (isConfirming) return 'Masukkan kembali PIN Anda untuk konfirmasi.';
        return `Masukkan PIN untuk mengakses akun ${selectedEmployee?.name || (role === UserRole.ADMIN ? 'Admin' : 'User')}.`;
      };

      const getRightInstruction = () => {
        if (isCreating) return 'Masukkan 6 digit PIN baru Anda.';
        if (isConfirming) return 'Masukkan kembali 6 digit PIN konfirmasi.';
        return 'Masukkan PIN 6 digit Anda.';
      };

      const getIcon = () => {
        if (isCreating) return <KeyRound size={26} />;
        if (isConfirming) return <CheckCircle size={26} />;
        return <ShieldCheck size={26} />;
      };

      return (
        <div
          className="pm-root fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-xs select-none"
          data-theme={isDarkMode ? 'dark' : 'light'}
          onMouseDown={handleBackFromPin}
        >
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
            .pm-root {
              --surface: #ffffff;
              --text: #16191D;
              --muted: #5B636B;
              --line: #D5D9DC;
              --hover: #F3F4F2;
              --ring: #B8860B;
              font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
            }
            .pm-root[data-theme='dark'] {
              --surface: #181B1F;
              --text: #ECEEF0;
              --muted: #9AA3AB;
              --line: #2B3036;
              --hover: #22262B;
              --ring: #F2B705;
            }
            .pm-surface { background: var(--surface); color: var(--text); }
            .pm-muted { color: var(--muted); }
            .pm-border { border-color: var(--line); }
            .pm-key { background: var(--surface); border-color: var(--line); color: var(--text); }
            .pm-key:hover:not(:disabled) { background: var(--hover); }
            .pm-dot-on { background: var(--text); border-color: var(--text); }
            .pm-focus:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

            @keyframes pm-shake {
              0%, 100% { transform: translateX(0); }
              25%, 75% { transform: translateX(-6px); }
              50% { transform: translateX(6px); }
            }
            .pm-shake { animation: pm-shake 0.4s ease-in-out; }
            @media (prefers-reduced-motion: reduce) {
              .pm-shake { animation: none; }
            }
          `}</style>

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-title"
            onMouseDown={(e) => e.stopPropagation()}
            className="pm-surface pm-border relative grid max-h-[calc(100dvh-2rem)] w-full max-w-[22rem] overflow-hidden rounded-3xl border shadow-2xl md:max-w-[50rem] md:grid-cols-2"
          >
            {/* SUCCESS OVERLAY */}
            {isSuccess && (
              <div className="absolute inset-0 z-50 pm-surface flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 animate-[popIn_0.4s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                  <CheckCircle size={40} />
                </div>
                <h3 className="text-xl font-bold mb-1">
                  {isCreating || isConfirming ? 'PIN Tersimpan!' : 'Berhasil Masuk'}
                </h3>
                <p className="pm-muted text-xs">
                  {isCreating || isConfirming ? 'Data telah diperbarui.' : 'Mengalihkan ke dashboard...'}
                </p>
              </div>
            )}

            {/* Sisi Kiri: Identitas Keamanan Dark Navy */}
            <div
              className="relative flex items-center gap-4 overflow-hidden bg-[#0E1B2E] p-5 text-white md:flex-col md:justify-center md:gap-0 md:p-10 md:text-center"
              style={{
                backgroundImage:
                  'radial-gradient(60% 50% at 12% 0%, rgba(90,130,210,0.24), transparent 70%), radial-gradient(55% 45% at 100% 100%, rgba(90,130,210,0.14), transparent 70%)'
              }}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F2B705] text-[#16191D] md:h-16 md:w-16 md:rounded-2xl shadow-sm">
                {getIcon()}
              </div>
              <div className="md:mt-6">
                <h2 id="pin-title" className="text-lg font-semibold md:text-2xl">
                  {getTitle()}
                </h2>
                <p className="mt-1 text-sm text-[#8FA0B8] md:mt-2 md:text-base">
                  {getLeftSubtitle()}
                </p>
              </div>
            </div>

            {/* Sisi Kanan: Keypad Interaktif */}
            <div className="flex flex-col items-center p-6 md:p-10">
              <p className="pm-muted text-sm">{getRightInstruction()}</p>

              {/* Dot Display */}
              <div
                role="status"
                aria-label={`${pinInput.length} dari 6 digit terisi`}
                className={`mt-5 flex gap-3 ${shake ? 'pm-shake' : ''}`}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                      i < pinInput.length
                        ? pinError
                          ? 'bg-red-500 border-red-500'
                          : 'pm-dot-on'
                        : 'pm-border'
                    }`}
                  />
                ))}
              </div>

              {/* Status / Alert Feedback */}
              <p className="mt-4 h-5 text-sm text-center" aria-live="polite">
                {pinError ? (
                  <span className="text-red-600 dark:text-red-400 font-semibold">{pinError}</span>
                ) : isPinLoading ? (
                  <span className="pm-muted inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Menyimpan ke Database…
                  </span>
                ) : null}
              </p>

              {/* Keypad Grid 3 Kolom */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handlePinInput(d)}
                    disabled={isPinLoading || isSuccess}
                    className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
                  >
                    {d}
                  </button>
                ))}
                <span />
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  disabled={isPinLoading || isSuccess}
                  className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinDelete}
                  disabled={isPinLoading || isSuccess}
                  aria-label="Hapus digit terakhir"
                  className="pm-focus pm-muted grid h-14 w-14 place-items-center rounded-full hover:opacity-70 disabled:opacity-40 md:h-16 md:w-16 cursor-pointer"
                >
                  <Delete size={22} />
                </button>
              </div>

              {/* Tombol Batal */}
              <button
                type="button"
                onClick={handleBackFromPin}
                disabled={isPinLoading || isSuccess}
                className="pm-focus pm-muted mt-5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-70 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      );
    }

    /* =========================================================================
       TEMA 1: DESAIN LAMA (GRADASI WARNA SESUAI ROLE)
       ========================================================================= */
    const gradientClass = getThemeGradient();
    const pinDotColor = getPinDotColor();

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={handleBackFromPin}></div>

        {/* Modal */}
        <div className="bg-white dark:bg-gray-900 w-full max-w-[380px] sm:max-w-md md:max-w-3xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-gray-100 dark:border-gray-800 animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] my-auto">

          <div className="flex flex-col md:flex-row h-full">

            {/* SUCCESS OVERLAY */}
            {isSuccess && (
              <div className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-500 mb-6 animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]">
                  <CheckCircle size={48} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {isCreating || isConfirming ? 'PIN Tersimpan!' : 'Berhasil Masuk'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {isCreating || isConfirming ? 'Data telah diperbarui.' : 'Mengalihkan ke dashboard...'}
                </p>
              </div>
            )}

            {/* Desktop Left Side */}
            <div className={`hidden md:flex md:w-1/2 bg-gradient-to-br ${gradientClass} items-center justify-center p-10 relative overflow-hidden transition-colors duration-500`}>
              {/* WebP Background Image */}
              <div className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
                <img
                  src={
                    role === UserRole.ADMIN ? '/assets/admin-bg.webp' :
                    role === UserRole.PACKING || role === UserRole.PACKING_2 ? '/assets/packing-bg.webp' :
                    role === UserRole.GUDANG ? '/assets/gudang-bg.webp' :
                    role === UserRole.OJOL ? '/assets/ojol-bg.webp' :
                    role === UserRole.LEADER ? '/assets/leader-bg.webp' :
                    role === UserRole.CHECKER ? '/assets/checker-bg.webp' :
                    role === UserRole.SORTIR || role === UserRole.SORTIR_BATCH ? '/assets/sortir-bg.webp' :
                    '/assets/picker-bg.webp'
                  }
                  alt="Role Background"
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/40 pointer-events-none" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br opacity-80"></div>
              <div className="relative z-10 text-center text-white">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
                  {isCreating && <KeyRound size={40} />}
                  {isConfirming && <CheckCircle size={40} />}
                  {isVerifying && <ShieldCheck size={40} />}
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {isCreating && 'Buat PIN Baru'}
                  {isConfirming && 'Konfirmasi PIN'}
                  {isVerifying && 'Verifikasi Keamanan'}
                </h3>
                <p className="text-white/80 text-sm max-w-[200px] mx-auto">
                  {isCreating && 'Buat 6-digit PIN keamanan untuk akun Anda.'}
                  {isConfirming && 'Masukkan kembali PIN Anda untuk konfirmasi.'}
                  {isVerifying && `Masukkan PIN untuk mengakses akun ${selectedEmployee?.name}.`}
                </p>
              </div>
              {/* Decor Shapes */}
              <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
              <div className="absolute bottom-[-20px] right-[-20px] w-40 h-40 bg-white opacity-20 rounded-full blur-2xl"></div>
            </div>

            {/* Input Area */}
            <div className="w-full md:w-1/2 pt-6 pb-5 px-4 sm:px-6 flex flex-col items-center justify-center bg-white dark:bg-gray-900">

              {/* Mobile Header Icon */}
              <div className="md:hidden text-center mb-3">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-2 text-blue-600 dark:text-blue-400">
                  {isCreating && <KeyRound size={28} />}
                  {isConfirming && <CheckCircle size={28} />}
                  {isVerifying && <ShieldCheck size={28} />}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isCreating && 'Buat PIN Baru'}
                  {isConfirming && 'Konfirmasi PIN'}
                  {isVerifying && 'Verifikasi Keamanan'}
                </h3>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center px-4 md:px-0">
                {isCreating && 'Buat 6-digit PIN keamanan untuk akun Anda.'}
                {isConfirming && 'Masukkan kembali PIN Anda untuk konfirmasi.'}
                {isVerifying && 'Masukkan 6-digit PIN Anda.'}
              </p>

              {/* PIN Display */}
              <div className="flex gap-2.5 sm:gap-3 mb-3 h-8 items-center justify-center w-full">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`
                        w-3.5 h-3.5 rounded-full transition-all duration-300 ease-out 
                        ${i < pinInput.length
                        ? (pinError ? 'bg-red-500 scale-110 shadow-red-500/50' : `${pinDotColor} scale-110`)
                        : 'bg-gray-200 dark:bg-gray-700 scale-100'
                      }
                      `}
                  />
                ))}
              </div>

              {/* Status Container */}
              <div className="h-6 mb-2 flex items-center justify-center w-full">
                {pinError && (
                  <p className="text-red-500 text-xs font-bold animate-[shake_0.4s_ease-in-out] bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 flex items-center gap-1">
                    <AlertCircle size={12} /> {pinError}
                  </p>
                )}
                {isPinLoading && (
                  <p className="text-blue-500 text-xs font-bold flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Menyimpan ke Database...
                  </p>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-3.5 sm:gap-y-4.5 w-full max-w-[280px] sm:max-w-[320px] justify-items-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinInput(num.toString())}
                    disabled={isPinLoading || isSuccess}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 select-none"
                  >
                    {num}
                  </button>
                ))}
                <div className="w-16 h-16 sm:w-20 sm:h-20"></div>
                <button
                  onClick={() => handlePinInput('0')}
                  disabled={isPinLoading || isSuccess}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 select-none"
                >
                  0
                </button>
                <button
                  onClick={handlePinDelete}
                  disabled={isPinLoading || isSuccess}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-all active:scale-90 active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer disabled:opacity-50 select-none"
                >
                  <Delete size={26} />
                </button>
              </div>

              <button 
                onClick={handleBackFromPin} 
                disabled={isPinLoading || isSuccess} 
                className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-semibold px-6 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (currentStep !== 'LIST') {
    return renderPinModal();
  }

  // --- RENDER EMPLOYEE LIST ---

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-900 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 sm:px-6 py-3.5 sm:py-5 border-b border-gray-200 dark:border-gray-700 shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <ArrowLeft size={22} className="sm:w-6 sm:h-6" />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Siapa Anda?</h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Pilih nama karyawan untuk melanjutkan.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama karyawan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded-xl pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-500 dark:text-gray-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0 custom-scrollbar">
        <div className="max-w-7xl mx-auto w-full">
          {/* Active Filters Display */}
          {(role || searchTerm) && (
            <div className="flex items-center gap-2 mb-3 sm:mb-4 overflow-x-auto no-scrollbar">
              {role && (
                <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold whitespace-nowrap border border-blue-100 dark:border-blue-800">
                  <Filter size={12} />
                  <span>Role: {role}</span>
                </div>
              )}
              <div className="flex-1"></div>
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {filteredEmployees.length} karyawan ditemukan
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
              <p className="text-sm font-medium">Memuat data karyawan...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-4">
                <User size={32} />
              </div>
              <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">Terjadi Kesalahan</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <button onClick={fetchEmployees} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300">Coba Lagi</button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 mb-4">
                <Search size={32} />
              </div>
              <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">Tidak Ditemukan</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tidak ada karyawan dengan nama "{searchTerm}" {role ? `di role ${role}` : ''}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 pb-20">
              {filteredEmployees.map((emp) => (
                <EmployeeButton
                    key={emp.id}
                    emp={emp}
                    role={role}
                    onClick={() => handleEmployeeClick(emp)}
                  />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
         }
      `}</style>
    </div>
  );
};
