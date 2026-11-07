import React, { useState, useEffect } from 'react';
import { Delete, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getActiveLoginTheme, LoginThemeVariant } from '../services/themeSyncService';

interface PinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
  userEmail?: string;
  expectedPin?: string;
  onValidate?: (pin: string) => Promise<boolean> | boolean;
  accentColor?: 'blue' | 'purple' | 'red';
  roleLabel?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  userEmail,
  expectedPin,
  onValidate,
  accentColor = 'blue',
  roleLabel
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Active theme (Tema 1 vs Tema 2)
  const [activeTheme] = useState<LoginThemeVariant>(() => getActiveLoginTheme());

  const [isDarkMode] = useState<boolean>(() => {
    return (
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark'
    );
  });

  const PIN_LENGTH = 6;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 60; // 60 seconds

  const storageKeyPrefix = userEmail ? `pin_lock_${userEmail}` : 'pin_lock_general';

  // Compute clean role label
  const getDerivedRoleLabel = (): string => {
    if (roleLabel) return roleLabel;
    if (!userEmail) return 'User';
    const lower = userEmail.toLowerCase();
    if (lower.includes('developer') || lower.includes('jgilbeth') || lower.includes('dev@'))
      return 'Developer';
    if (lower.includes('admin')) return 'Admin';
    if (lower.includes('leader')) return 'Leader';
    if (lower.includes('checker')) return 'Checker';
    if (lower.includes('gudang')) return 'Gudang';
    if (lower.includes('packing')) return 'Packing';
    if (lower.includes('picker')) return 'Picker';
    if (lower.includes('sortir')) return 'Sortir';
    if (lower.includes('ojol')) return 'Ojol';
    return 'User';
  };

  // Check existing lockout on modal open
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setShake(false);
      setIsValidating(false);

      try {
        const lockoutUntil = sessionStorage.getItem(`${storageKeyPrefix}_until`);
        if (lockoutUntil) {
          const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
          if (remaining > 0) {
            setLockoutSeconds(remaining);
          } else {
            sessionStorage.removeItem(`${storageKeyPrefix}_until`);
            sessionStorage.removeItem(`${storageKeyPrefix}_attempts`);
            setLockoutSeconds(0);
          }
        }
      } catch (e) {}
    }
  }, [isOpen, storageKeyPrefix]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          try {
            sessionStorage.removeItem(`${storageKeyPrefix}_until`);
            sessionStorage.removeItem(`${storageKeyPrefix}_attempts`);
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds, storageKeyPrefix]);

  // Color maps based on accentColor prop for Tema 1
  const colors =
    {
      blue: {
        leftBg: 'bg-blue-600',
        leftGradient: 'from-blue-600 to-blue-800',
        leftDecor: 'bg-blue-400',
        leftText: 'text-blue-100',
        mobileIcon: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-600 dark:bg-blue-500'
      },
      purple: {
        leftBg: 'bg-purple-700',
        leftGradient: 'from-purple-700 to-violet-800',
        leftDecor: 'bg-purple-400',
        leftText: 'text-purple-100',
        mobileIcon: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        dot: 'bg-purple-600 dark:bg-purple-400'
      },
      red: {
        leftBg: 'bg-red-700',
        leftGradient: 'from-red-700 to-rose-800',
        leftDecor: 'bg-red-400',
        leftText: 'text-red-100',
        mobileIcon: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        dot: 'bg-red-600 dark:bg-red-400'
      }
    }[accentColor] || {
      leftBg: 'bg-blue-600',
      leftGradient: 'from-blue-600 to-blue-800',
      leftDecor: 'bg-blue-400',
      leftText: 'text-blue-100',
      mobileIcon: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-600 dark:bg-blue-500'
    };

  // Handle Physical Keyboard Input
  useEffect(() => {
    if (!isOpen || isValidating || lockoutSeconds > 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, isValidating, lockoutSeconds]);

  const handleNumberClick = (num: string) => {
    if (isValidating || lockoutSeconds > 0) return;
    setPin((prev) => {
      if (prev.length < PIN_LENGTH) {
        const newPin = prev + num;
        setError(false);
        setShake(false);
        if (newPin.length === PIN_LENGTH) {
          setTimeout(() => validatePin(newPin), 200);
        }
        return newPin;
      }
      return prev;
    });
  };

  const handleDelete = () => {
    if (isValidating || lockoutSeconds > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setError(false);
    setShake(false);
  };

  const triggerErrorAnimation = () => {
    setError(true);
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 450);
  };

  const recordFailedAttempt = () => {
    triggerErrorAnimation();
    try {
      const currentAttempts =
        parseInt(sessionStorage.getItem(`${storageKeyPrefix}_attempts`) || '0', 10) + 1;
      sessionStorage.setItem(`${storageKeyPrefix}_attempts`, currentAttempts.toString());

      if (currentAttempts >= MAX_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_DURATION * 1000;
        sessionStorage.setItem(`${storageKeyPrefix}_until`, lockUntil.toString());
        setLockoutSeconds(LOCKOUT_DURATION);
      }
    } catch (e) {}
  };

  const clearFailedAttempts = () => {
    try {
      sessionStorage.removeItem(`${storageKeyPrefix}_attempts`);
      sessionStorage.removeItem(`${storageKeyPrefix}_until`);
    } catch (e) {}
  };

  const validatePin = async (inputPin: string) => {
    if (lockoutSeconds > 0) return;
    setIsValidating(true);
    try {
      if (onValidate) {
        const isValid = await onValidate(inputPin);
        if (isValid) {
          clearFailedAttempts();
          onSuccess();
          return;
        } else {
          recordFailedAttempt();
          return;
        }
      }

      if (userEmail) {
        // 1. Try secure Postgres RPC function verify_user_pin first
        try {
          const { data: rpcValid, error: rpcError } = await supabase.rpc('verify_user_pin', {
            p_email: userEmail,
            p_pin: inputPin
          });

          if (!rpcError && typeof rpcValid === 'boolean') {
            if (rpcValid) {
              clearFailedAttempts();
              onSuccess();
              return;
            } else {
              recordFailedAttempt();
              return;
            }
          }
        } catch (rpcErr) {
          // RPC may not exist yet, fallback to direct query
        }

        // 2. Direct query fallback for existing databases
        const { data, error } = await supabase
          .from('app_users')
          .select('id')
          .eq('email', userEmail)
          .eq('pin', inputPin)
          .maybeSingle();

        if (!error && data) {
          clearFailedAttempts();
          onSuccess();
          return;
        }

        // Fallback for default hardcoded dev credentials or offline
        if (expectedPin && inputPin === expectedPin) {
          clearFailedAttempts();
          onSuccess();
          return;
        }

        recordFailedAttempt();
        return;
      }

      if (expectedPin) {
        if (inputPin === expectedPin) {
          clearFailedAttempts();
          onSuccess();
        } else {
          recordFailedAttempt();
        }
      }
    } catch (err) {
      console.error('PIN validation error:', err);
      recordFailedAttempt();
    } finally {
      setIsValidating(false);
    }
  };

  if (!isOpen) return null;

  /* =========================================================================
     VIEW: TEMA 2 (DARK NAVY IDENTITY SIDE & CLEAN MINIMALIST KEYPAD)
     ========================================================================= */
  if (activeTheme === 'tema_2') {
    return (
      <div
        className="pm-root fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs select-none"
        data-theme={isDarkMode ? 'dark' : 'light'}
        onMouseDown={onClose}
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
          className="pm-surface pm-border grid max-h-[calc(100dvh-2rem)] w-full max-w-[22rem] overflow-y-auto rounded-3xl border shadow-2xl md:max-w-[50rem] md:grid-cols-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Sisi Kiri: Identitas Keamanan Dark Navy */}
          <div
            className="relative flex items-center gap-4 overflow-hidden bg-[#0E1B2E] p-5 text-white md:flex-col md:justify-center md:gap-0 md:p-10 md:text-center"
            style={{
              backgroundImage:
                'radial-gradient(60% 50% at 12% 0%, rgba(90,130,210,0.24), transparent 70%), radial-gradient(55% 45% at 100% 100%, rgba(90,130,210,0.14), transparent 70%)'
            }}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F2B705] text-[#16191D] md:h-16 md:w-16 md:rounded-2xl">
              <ShieldCheck size={26} />
            </div>
            <div className="md:mt-6">
              <h2 id="pin-title" className="text-lg font-semibold md:text-2xl">
                Verifikasi keamanan
              </h2>
              <p className="mt-1 text-sm text-[#8FA0B8] md:mt-2 md:text-base">
                Masukkan PIN untuk mengakses akun {getDerivedRoleLabel()}.
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Keypad Interaktif */}
          <div className="flex flex-col items-center p-6 md:p-10">
            <p className="pm-muted text-sm">
              Masukkan PIN {PIN_LENGTH} digit Anda.
            </p>

            {/* Dot Display */}
            <div
              role="status"
              aria-label={`${pin.length} dari ${PIN_LENGTH} digit terisi`}
              className={`mt-5 flex gap-3 ${shake ? 'pm-shake' : ''}`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                    i < pin.length ? 'pm-dot-on' : 'pm-border'
                  }`}
                />
              ))}
            </div>

            {/* Status / Alert Feedback */}
            <p className="mt-4 h-5 text-sm text-center" aria-live="polite">
              {lockoutSeconds > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1">
                  <AlertCircle size={13} />
                  Terlalu banyak percobaan. Tunggu <b>{lockoutSeconds}s</b>
                </span>
              ) : error ? (
                <span className="text-red-600 font-semibold">
                  PIN salah. Periksa lalu coba lagi.
                </span>
              ) : isValidating ? (
                <span className="pm-muted inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Memeriksa PIN…
                </span>
              ) : null}
            </p>

            {/* Keypad Grid 3 Kolom */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleNumberClick(d)}
                  disabled={isValidating || lockoutSeconds > 0}
                  className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <span />
              <button
                type="button"
                onClick={() => handleNumberClick('0')}
                disabled={isValidating || lockoutSeconds > 0}
                className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isValidating || lockoutSeconds > 0}
                aria-label="Hapus digit terakhir"
                className="pm-focus pm-muted grid h-14 w-14 place-items-center rounded-full hover:opacity-70 disabled:opacity-40 md:h-16 md:w-16 cursor-pointer"
              >
                <Delete size={22} />
              </button>
            </div>

            {/* Tombol Batal */}
            <button
              type="button"
              onClick={onClose}
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
     VIEW: TEMA 1 (DESAIN LAMA - BIRU KLASIK)
     ========================================================================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal - Wider on Desktop */}
      <div className="bg-white dark:bg-gray-900 w-full max-w-[380px] sm:max-w-md md:max-w-3xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-gray-100 dark:border-gray-800 animate-[popIn_0.3s_cubic-bezier(0.175,0.885,0.32,1.275)] my-auto">
        <div className="flex flex-col md:flex-row">
          {/* Desktop Left Side Decor */}
          <div
            className={`hidden md:flex md:w-1/2 ${colors.leftBg} items-center justify-center p-10 relative overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.leftGradient}`}></div>
            <div className="relative z-10 text-center text-white">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Security Verification</h3>
              <p className={`${colors.leftText} text-sm`}>
                Please enter your PIN to continue accessing the warehouse system.
              </p>
            </div>
            {/* Decor Shapes */}
            <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
            <div
              className={`absolute bottom-[-20px] right-[-20px] w-40 h-40 ${colors.leftDecor} opacity-20 rounded-full blur-2xl`}
            ></div>
          </div>

          {/* Input Area */}
          <div className="w-full md:w-1/2 pt-6 pb-5 px-4 sm:px-6 flex flex-col items-center justify-center bg-white dark:bg-gray-900">
            {/* Mobile Icon */}
            <div
              className={`md:hidden w-14 h-14 ${colors.mobileIcon} rounded-2xl flex items-center justify-center mb-3`}
            >
              <ShieldCheck size={28} />
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 md:hidden">
              Enter Security PIN
            </h3>
            <h3 className="hidden md:block text-xl font-bold text-gray-900 dark:text-white mb-1">
              User Access
            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center px-4 md:px-0">
              Enter your 6-digit personal code.
            </p>

            {/* PIN Display */}
            <div className="flex gap-2.5 sm:gap-3 mb-3 h-8 items-center justify-center w-full">
              {[...Array(PIN_LENGTH)].map((_, i) => (
                <div
                  key={i}
                  className={`
                    w-3.5 h-3.5 rounded-full transition-all duration-300
                    ${
                      i < pin.length
                        ? error
                          ? 'bg-red-500 scale-110'
                          : `${colors.dot} scale-110`
                        : 'bg-gray-200 dark:bg-gray-700'
                    }
                  `}
                />
              ))}
            </div>

            {/* Status Message Area */}
            <div className="min-h-6 mb-2 flex items-center justify-center w-full px-2">
              {lockoutSeconds > 0 ? (
                <p className="text-amber-600 dark:text-amber-400 text-xs font-bold bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 text-center animate-pulse">
                  Terlalu banyak percobaan. Tunggu{' '}
                  <span className="font-mono text-sm underline">{lockoutSeconds}s</span>
                </p>
              ) : isValidating ? (
                <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-800">
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                  Memverifikasi PIN...
                </p>
              ) : error ? (
                <p className="text-red-500 text-xs font-bold animate-pulse bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-800">
                  PIN salah. Silakan coba lagi.
                </p>
              ) : null}
            </div>

            {/* Custom Numpad */}
            <div
              className={`grid grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-3.5 sm:gap-y-4.5 w-full max-w-[280px] sm:max-w-[320px] justify-items-center transition-opacity ${
                lockoutSeconds > 0 ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  disabled={lockoutSeconds > 0 || isValidating}
                  onClick={() => handleNumberClick(num.toString())}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer select-none disabled:cursor-not-allowed"
                >
                  {num}
                </button>
              ))}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                {/* Empty Placeholder */}
              </div>
              <button
                disabled={lockoutSeconds > 0 || isValidating}
                onClick={() => handleNumberClick('0')}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center transition-all active:scale-90 active:bg-blue-100 dark:active:bg-gray-600 shadow-xs hover:shadow-md cursor-pointer select-none disabled:cursor-not-allowed"
              >
                0
              </button>
              <button
                disabled={lockoutSeconds > 0 || isValidating}
                onClick={handleDelete}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-all active:scale-90 active:bg-gray-200 dark:active:bg-gray-700 cursor-pointer select-none disabled:cursor-not-allowed"
              >
                <Delete size={26} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-3 text-sm text-gray-500 dark:text-gray-400 font-semibold hover:text-gray-700 dark:hover:text-gray-200 py-1.5 px-6 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
            >
              Batal
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};