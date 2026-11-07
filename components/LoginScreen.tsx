import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Box,
  CheckCircle2,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Package,
  ScanLine,
  Shield,
  ShieldCheck,
  Shuffle,
  Sun,
  X,
  Delete
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getActiveLoginTheme, LoginThemeVariant } from '../services/themeSyncService';

export interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  onAdminLoginRequest?: () => void;
  googleClientId?: string;
  regionId?: string;
  demo?: boolean;
}

const ADMIN_FALLBACK_EMAIL = 'admin@kalindo.local';
const GOOGLE_CLIENT_ID_FALLBACK =
  '547501643468-8td780qud5qgoenuec0kvu8faagqnq30.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: any;
  }
}

/* =========================================================================
   GOOGLE SVG LOGO
   ========================================================================= */

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
    />
    <path
      fill="#FBBC05"
      d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
    />
  </svg>
);

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
        <pattern id="bc" width="9" height="1" patternUnits="userSpaceOnUse">
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
        <rect x="14" y="54" width="47" height="22" fill="url(#bc)" />
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
   PIN MODAL FALLBACK
   ========================================================================= */

function PinModal({
  onClose,
  onVerified,
  theme,
  dark
}: {
  onClose: () => void;
  onVerified: () => void;
  theme?: LoginThemeVariant;
  dark?: boolean;
}) {
  const LEN = 6;
  const [pin, setPin] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (theme !== 'tema_2') {
      refs.current[0]?.focus();
    }
  }, [theme]);

  const submit = async (value: string) => {
    setBusy(true);
    setErr(null);
    setWrong(false);

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('pin')
        .eq('email', ADMIN_FALLBACK_EMAIL)
        .maybeSingle();

      const expectedPin = data?.pin || '123456';
      if (!error && value === expectedPin) {
        onVerified();
        return;
      }

      setWrong(true);
      setShake(true);
      setErr('PIN salah, coba lagi.');
      setPin('');
      setDigits(Array(LEN).fill(''));
      if (theme !== 'tema_2') refs.current[0]?.focus();
      setTimeout(() => setShake(false), 450);
    } catch {
      if (value === '123456') {
        onVerified();
        return;
      }
      setWrong(true);
      setShake(true);
      setErr('Gagal memverifikasi PIN.');
      setPin('');
      setDigits(Array(LEN).fill(''));
      setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  };

  const handleKeypadPress = (d: string) => {
    if (busy || pin.length >= LEN) return;
    setErr(null);
    setWrong(false);
    const next = pin + d;
    setPin(next);
    if (next.length === LEN) submit(next);
  };

  const handleKeypadDelete = () => {
    if (!busy) {
      setErr(null);
      setWrong(false);
      setPin((p) => p.slice(0, -1));
    }
  };

  // Keyboard navigation for Tema 2
  useEffect(() => {
    if (theme !== 'tema_2') return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (/^\d$/.test(e.key)) handleKeypadPress(e.key);
      else if (e.key === 'Backspace') handleKeypadDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theme, pin, busy]);

  const setAt = (i: number, val: string) => {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (val && i < LEN - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!t) return;
    e.preventDefault();
    const next = Array.from({ length: LEN }, (_, i) => t[i] ?? '');
    setDigits(next);
    if (t.length === LEN) submit(next.join(''));
  };

  /* =========================================================================
     TEMA 2: SPLIT CARD MODAL (MIDNIGHT NAVY & CIRCULAR KEYPAD)
     ========================================================================= */
  if (theme === 'tema_2') {
    return (
      <div
        className="pm-root fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs select-none"
        data-theme={dark ? 'dark' : 'light'}
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
          className="pm-surface pm-border grid max-h-[calc(100dvh-2rem)] w-full max-w-[22rem] overflow-y-auto rounded-3xl border shadow-2xl md:max-w-[50rem] md:grid-cols-2"
        >
          {/* Sisi Kiri: Identitas Keamanan Dark Navy */}
          <div
            className="relative flex items-center gap-4 overflow-hidden bg-[#0E1B2E] p-5 text-white md:flex-col md:justify-center md:gap-0 md:p-10 md:text-center"
            style={{
              backgroundImage:
                'radial-gradient(60% 50% at 12% 0%, rgba(90,130,210,0.24), transparent 70%), radial-gradient(55% 45% at 100% 100%, rgba(90,130,210,0.14), transparent 70%)'
            }}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F2B705] text-[#16191D] md:h-16 md:w-16 md:rounded-2xl shadow-sm">
              <ShieldCheck size={26} />
            </div>
            <div className="md:mt-6">
              <h2 id="pin-title" className="text-lg font-semibold md:text-2xl">
                Verifikasi keamanan
              </h2>
              <p className="mt-1 text-sm text-[#8FA0B8] md:mt-2 md:text-base">
                Masukkan PIN untuk mengakses akun Admin.
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Keypad Interaktif */}
          <div className="flex flex-col items-center p-6 md:p-10">
            <p className="pm-muted text-sm">
              Masukkan PIN {LEN} digit Anda.
            </p>

            {/* Dot Display */}
            <div
              role="status"
              aria-label={`${pin.length} dari ${LEN} digit terisi`}
              className={`mt-5 flex gap-3 ${shake ? 'pm-shake' : ''}`}
            >
              {Array.from({ length: LEN }).map((_, i) => (
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
              {wrong ? (
                <span className="text-red-600 font-semibold">{err || 'PIN salah. Periksa lalu coba lagi.'}</span>
              ) : busy ? (
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
                  onClick={() => handleKeypadPress(d)}
                  disabled={busy}
                  className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <span />
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={busy}
                className="pm-focus pm-key grid h-14 w-14 place-items-center rounded-full border text-2xl font-medium transition active:scale-95 disabled:opacity-60 md:h-16 md:w-16 cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadDelete}
                disabled={busy}
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
     TEMA 1: DESAIN LAMA (SINGLE INPUT BOXES)
     ========================================================================= */
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-xs"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border p-6 shadow-2xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      >
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600">
            <KeyRound size={18} />
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-md p-1.5 hover:opacity-70 transition-opacity cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="pin-title" className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          Masuk sebagai admin
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Masukkan PIN 6 digit.</p>
        <div className={`mt-5 flex gap-2 ${wrong ? 'animate-[shake_0.4s_ease-in-out]' : ''}`} onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              type="password"
              inputMode="numeric"
              maxLength={1}
              disabled={busy}
              aria-label={`Digit PIN ${i + 1}`}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) {
                  refs.current[i - 1]?.focus();
                }
              }}
              className="h-12 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center text-lg font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none"
            />
          ))}
        </div>
        {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
        {busy && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span>Memverifikasi...</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN COMPONENT: LOGIN SCREEN (RESPONSIVE BLUE DESIGN)
   ========================================================================= */

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onAdminLoginRequest,
  googleClientId,
  regionId = 'ID-JKT-01',
  demo = false
}) => {
  const activeClientId =
    googleClientId ||
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    GOOGLE_CLIENT_ID_FALLBACK;

  // Active Login Theme (defaults to 'tema_1')
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

  const gRefTema2 = useRef<HTMLDivElement>(null);
  const tokenClientRef = useRef<any>(null);
  const isGisInitializedRef = useRef<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showPin, setShowPin] = useState(false);

  const notify = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const finish = useCallback(
    (email: string) => {
      notify(true, `Berhasil masuk sebagai ${email}`);
      setTimeout(() => onLoginSuccess(email), 500);
    },
    [onLoginSuccess]
  );

  // Dynamic GSI Loader
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google?.accounts) return;

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // 1. Session Detection on mount (Old Supabase Logic Preserved)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        onLoginSuccess(session.user.email);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        onLoginSuccess(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, [onLoginSuccess]);

  // 2. Initialize Google Identity Services (GIS)
  useEffect(() => {
    const handleCredentialResponse = async (response: any) => {
      setLoading(true);
      setError(null);

      // 1. Instantly decode Google-signed ID token JWT
      let decodedEmail: string | null = null;
      try {
        if (response.credential) {
          const base64Url = response.credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          if (payload?.email) {
            decodedEmail = payload.email.trim();
          }
        }
      } catch (decodeErr) {
        console.warn('Direct JWT decode notice:', decodeErr);
      }

      // 2. Optional Supabase Auth session sync
      try {
        if (response.credential) {
          const { data } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential
          });
          if (data?.user?.email) {
            decodedEmail = data.user.email.trim();
          }
        }
      } catch (supaErr: any) {
        console.warn('Supabase ID token sync notice:', supaErr);
      }

      if (decodedEmail) {
        console.log('✅ Google Sign-In Success via ID Token:', decodedEmail);
        localStorage.setItem('kalindo_user_email', decodedEmail);
        finish(decodedEmail);
      } else {
        setError('Gagal membaca akun Google. Silakan coba kembali.');
        setLoading(false);
      }
    };

    const initGIS = () => {
      if (!window.google?.accounts || !activeClientId) return;
      if (isGisInitializedRef.current) return;
      isGisInitializedRef.current = true;

      // A. Setup ID Token / One Tap
      try {
        window.google.accounts.id.initialize({
          client_id: activeClientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });
      } catch (err) {
        console.warn('GIS ID Init warning:', err);
      }

      // B. Setup OAuth2 Token Client (Popup flow for custom button)
      try {
        if (window.google.accounts.oauth2) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: activeClientId,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse?.error) {
                console.error('Google token client error:', tokenResponse);
                if (tokenResponse.error === 'popup_closed_by_user') {
                  setLoading(false);
                  return;
                }
                setError(
                  'Gagal login Google: ' +
                    (tokenResponse.error_description || tokenResponse.error)
                );
                setLoading(false);
                return;
              }
              if (tokenResponse?.access_token) {
                try {
                  setLoading(true);
                  const res = await fetch(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    {
                      headers: {
                        Authorization: `Bearer ${tokenResponse.access_token}`
                      }
                    }
                  );
                  const userinfo = await res.json();
                  if (userinfo?.email) {
                    const email = userinfo.email.trim();
                    console.log('✅ Google Login Berhasil via OAuth2 Popup:', email);
                    localStorage.setItem('kalindo_user_email', email);
                    finish(email);
                    return;
                  } else {
                    setError('Tidak dapat membaca email dari profil Google.');
                  }
                } catch (err: any) {
                  console.error('Userinfo fetch error:', err);
                  setError('Gagal memuat profil akun Google: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }
            }
          });
        }
      } catch (err) {
        console.warn('GIS OAuth2 Init warning:', err);
      }
    };

    if (window.google?.accounts) {
      initGIS();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts) {
          initGIS();
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [activeClientId, finish]);

  // 3. Dev Mode Bypass Keyboard Listener (Old Logic Preserved)
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;

      if (e.key.length === 1) {
        keyBuffer += e.key.toLowerCase();
        if (keyBuffer.length > 20) {
          keyBuffer = keyBuffer.slice(-20);
        }

        // ADMIN PANEL BYPASS (devadmin -> dev@kalindo.com)
        if (keyBuffer.includes('devadmin')) {
          keyBuffer = '';
          notify(true, 'Mode Pengembang Terdeteksi. Mengarahkan ke Admin...');
          try {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('mode', 'admin');
            window.history.pushState({}, '', newUrl.toString());
          } catch (e) {
            console.warn("URL update failed", e);
          }
          setTimeout(() => {
            if (onAdminLoginRequest) {
              onAdminLoginRequest();
            } else {
              onLoginSuccess('dev@kalindo.com');
            }
          }, 400);
        } else if (keyBuffer.includes('devmode') || keyBuffer.includes('devmodenew')) {
          // PROFILE SELECTION BYPASS (devmode / devmodenew -> jgilbeth92@gmail.com)
          keyBuffer = '';
          notify(true, 'Mode Pengembang Aktif: Bypass Login Google.');
          setTimeout(() => {
            onLoginSuccess('jgilbeth92@gmail.com');
          }, 400);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onLoginSuccess, onAdminLoginRequest]);

  // 4. Action Handlers
  const handleGoogleClick = () => {
    if (loading) return;
    setError(null);

    if (demo) {
      setLoading(true);
      setTimeout(() => {
        finish('picker.demo@kalindo.local');
      }, 900);
      return;
    }

    setLoading(true);

    // 1. Prioritaskan Token Client Popup (Tidak pernah redirect_uri_mismatch)
    if (tokenClientRef.current) {
      try {
        tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Token client request error:', err);
      }
    }

    // 2. Inisialisasi on-the-fly jika tokenClientRef belum siap
    if (window.google?.accounts?.oauth2 && activeClientId) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError(
                  'Gagal login Google: ' +
                    (tokenResponse.error_description || tokenResponse.error)
                );
              }
              setLoading(false);
              return;
            }
            if (tokenResponse?.access_token) {
              try {
                const res = await fetch(
                  'https://www.googleapis.com/oauth2/v3/userinfo',
                  {
                    headers: {
                      Authorization: `Bearer ${tokenResponse.access_token}`
                    }
                  }
                );
                const userinfo = await res.json();
                if (userinfo?.email) {
                  const email = userinfo.email.trim();
                  localStorage.setItem('kalindo_user_email', email);
                  finish(email);
                  return;
                }
              } catch (e: any) {
                console.error('Userinfo error:', e);
              }
            }
            setLoading(false);
          }
        });
        tokenClientRef.current = client;
        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Dynamic token client error:', err);
      }
    }

    // 3. Fallback ke Google ID One Tap Prompt jika didukung
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment() ||
            notification.isDismissedMoment()
          ) {
            setLoading(false);
            setError('Jendela Google Login tidak dapat dibuka. Pastikan pop-up diizinkan di browser.');
          }
        });
        return;
      } catch (err) {
        console.warn('One Tap Prompt error:', err);
      }
    }

    setLoading(false);
    setError('Layanan Google Sign-In sedang dimuat. Silakan tunggu sebentar dan coba lagi.');
  };

  const handleAdminClick = () => {
    if (onAdminLoginRequest) {
      onAdminLoginRequest();
    } else {
      setShowPin(true);
    }
  };

  const handleAdminPinVerified = () => {
    setShowPin(false);
    notify(true, 'PIN Admin diverifikasi.');
    setTimeout(() => {
      if (onAdminLoginRequest) {
        onAdminLoginRequest();
      } else {
        window.location.href = '/admin';
      }
    }, 500);
  };

  /* =========================================================================
     RENDER TEMA 1 (DESAIN LAMA - BIRU KALINDO KLASIK)
     ========================================================================= */
  if (activeTheme === 'tema_1') {
    return (
      <div className="h-full min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-gray-950 transition-colors duration-500 ease-in-out relative overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none">
      {/* ================= MOBILE & TABLET LAYOUT (< lg) ================= */}
      <div className="lg:hidden relative w-full min-h-[100dvh] flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#1d63ed] via-[#2563eb] to-[#0f172a] text-white">
        {/* Full Screen Background Graphic */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <picture className="w-full h-full block">
            <source media="(max-width: 639px)" srcSet="/assets/login-illustration-mobile.webp" type="image/webp" />
            <source media="(min-width: 640px) and (max-width: 1023px)" srcSet="/assets/login-illustration-tablet.webp" type="image/webp" />
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
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-blue-950/30 to-blue-900/10 pointer-events-none"></div>
        </div>

        {/* Ambient Glows */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Branding Badge */}
        <div className="relative z-10 pt-2 sm:pt-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-1.5 border border-white/40 shadow-xl">
            <Monitor size={24} className="text-white" strokeWidth={1.75} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
            Kalindo <span className="text-blue-200">Scan</span>
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm font-medium mt-0.5 max-w-xs leading-tight drop-shadow">
            Warehouse Management System
          </p>
        </div>

        {/* Center/Bottom Glassmorphic Login Card */}
        <div className="relative z-10 w-full max-w-[24rem] sm:max-w-[26rem] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-gray-800 p-5 sm:p-6 my-auto">
          <div className="space-y-3.5">
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Selamat Datang</h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                Silakan masuk untuk mengakses sistem gudang
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full h-11 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3 px-4 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-[#1a73e8]" />
                ) : (
                  <GoogleLogo />
                )}
              </div>
              <span className="text-xs sm:text-sm font-medium tracking-wide">
                {loading ? 'Memeriksa akun…' : 'Login dengan Google'}
              </span>
            </button>

            {/* Divider */}
            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center pt-1">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs pt-1">
                <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 font-semibold tracking-wider text-[10px] uppercase rounded-full">
                  SECURE SYSTEM
                </span>
              </div>
            </div>

            {/* Admin Login Button */}
            <button
              onClick={handleAdminClick}
              className="w-full h-10 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Shield size={15} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
              <span>Login Admin Panel</span>
            </button>
          </div>

          <div className="mt-3.5 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
              By signing in, you agree to the internal <br className="hidden sm:inline" />
              Warehouse Safety Protocols and Data Privacy Policy.
            </p>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pb-1 text-[10px] text-blue-200/70 font-medium">
          Kalindo Scan &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* ================= DESKTOP LAYOUT (>= lg) ================= */}
      <div className="hidden lg:flex w-full h-[100dvh] flex-row overflow-hidden">
        {/* Desktop Left Side - Illustration & Branding */}
        <div className="w-1/2 h-full bg-gradient-to-br from-[#1d63ed] via-[#2563eb] to-[#1e40af] relative flex items-center justify-center overflow-hidden">
          {/* WebP Illustration Asset */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <img
              src="/assets/login-illustration.webp"
              alt="Kalindo Scan Illustration"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/login-illustration.svg';
              }}
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/60 via-transparent to-blue-900/20 pointer-events-none"></div>

          {/* Branding Overlay */}
          <div className="relative z-10 text-left p-6 lg:p-8 xl:p-12 max-w-lg my-auto">
            <div className="w-14 h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20 bg-white/20 backdrop-blur-md rounded-2xl xl:rounded-3xl flex items-center justify-center mb-3 xl:mb-5 border border-white/40 shadow-xl relative group">
              <div className="absolute inset-0 bg-blue-400/20 rounded-2xl xl:rounded-3xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity"></div>
              <Monitor size={30} className="text-white relative z-10 lg:w-8 lg:h-8 xl:w-10 xl:h-10" strokeWidth={1.75} />
            </div>

            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-white mb-2 xl:mb-3 tracking-tight leading-tight drop-shadow-md">
              Kalindo Scan
            </h1>
            <p className="text-blue-100/90 text-sm lg:text-base xl:text-lg font-medium leading-relaxed max-w-sm xl:max-w-md drop-shadow">
              Efficient scanning, sorting, and packing for the modern warehouse.
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

        {/* Desktop Right Side - Login Form */}
        <div className="w-1/2 h-full bg-[#f8fafc] dark:bg-gray-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10 overflow-y-auto">
          <div className="w-full max-w-[26rem] xl:max-w-[28rem] my-auto py-2 sm:py-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-[0_20px_50px_-20px_rgba(29,99,237,0.18)] border border-gray-100 dark:border-gray-800 p-5 sm:p-6 lg:p-6 xl:p-8 relative z-10 animate-[fadeIn_0.3s_ease-out] transition-colors duration-200">
              <div className="text-left">
                <div className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/40 rounded-xl mb-2.5 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                  <Monitor size={22} strokeWidth={2} />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-0.5">
                  Kalindo <span className="text-blue-600 dark:text-blue-500">Scan</span>
                </h1>
                <p className="text-gray-400 dark:text-gray-500 font-medium text-xs">Warehouse Management System</p>
              </div>

              <div className="text-left mt-3">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">Selamat Datang</h2>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">Silakan masuk untuk mengakses sistem gudang</p>
              </div>

              {error && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-2.5 rounded-xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                  <AlertCircle size={15} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google Login Button */}
              <button
                onClick={handleGoogleClick}
                disabled={loading}
                className="mt-3.5 sm:mt-4 w-full h-11 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium rounded-full shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-3 px-4 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                  {loading ? (
                    <Loader2 size={16} className="animate-spin text-[#1a73e8]" />
                  ) : (
                    <GoogleLogo />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-medium tracking-wide">
                  {loading ? 'Memeriksa akun…' : 'Login dengan Google'}
                </span>
              </button>

              {/* Divider */}
              <div className="my-2.5 sm:my-3 flex items-center gap-3">
                <span className="flex-1 border-t border-gray-200 dark:border-gray-800" />
                <span className="text-[10px] tracking-wider uppercase font-semibold text-gray-400 dark:text-gray-500">
                  SECURE SYSTEM
                </span>
                <span className="flex-1 border-t border-gray-200 dark:border-gray-800" />
              </div>

              {/* Admin Login Button */}
              <button
                onClick={handleAdminClick}
                className="w-full h-10 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <Shield size={15} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                <span>Login Admin Panel</span>
              </button>

              <div className="mt-2.5 sm:mt-3 text-center">
                <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  By signing in, you agree to the internal <br className="hidden sm:inline" />
                  Warehouse Safety Protocols and Data Privacy Policy.
                </p>
              </div>

              {/* Status Footer */}
              <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5 text-[10px] sm:text-[11px] font-medium text-gray-400 dark:text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sistem normal
                </span>
                <span className="font-mono tracking-wider">{regionId}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PIN Modal Fallback */}
      {showPin && (
        <PinModal onClose={() => setShowPin(false)} onVerified={handleAdminPinVerified} theme={activeTheme} dark={dark} />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-[#16191D] px-4 py-2.5 text-sm text-white shadow-xl border border-white/10 animate-[popIn_0.2s_ease-out]"
        >
          {toast.ok ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
    );
  }

  /* =========================================================================
     RENDER TEMA 2 (DESAIN BARU - DARK NAVY & SCANNER VEKTOR)
     ========================================================================= */
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

        @keyframes ks-shake {
          0%, 100% { transform: translateX(0); }
          25%, 75% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
        }
        .ks-shake { animation: ks-shake 0.4s ease-in-out; }

        @keyframes ks-sweep {
          to { transform: translateY(26px); }
        }
        .ks-sweep {
          animation: ks-sweep 2.2s ease-in-out infinite alternate;
        }

        @media (prefers-reduced-motion: reduce) {
          .ks-shake, .ks-sweep { animation: none; }
        }
      `}</style>

      {/* Kolom Kiri: Brand & Ilustrasi (Desktop) */}
      <BrandTema2 />

      {/* Kolom Kanan: Card Login & Aksi */}
      <main className="relative flex min-h-[100dvh] lg:h-[100dvh] w-full flex-col items-center justify-between gap-6 overflow-y-auto bg-[#0E1B2E] px-4 py-6 sm:px-6 lg:px-8 lg:py-6 lg:bg-transparent">
        {/* Mobile Watermark Background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 lg:hidden">
          <IllustrationTema2 className="absolute bottom-0 left-1/2 block w-[135%] max-w-none -translate-x-1/2 opacity-40 sm:w-[88%]" />
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#0E1B2E] to-transparent" />
        </div>

        {/* Mobile Header Branding */}
        <header className="relative flex flex-col items-center text-center text-white lg:hidden pt-2">
          <MarkTema2 size={48} />
          <div className="mt-3 text-2xl font-semibold tracking-tight">Kalindo Scan</div>
          <p className="mt-0.5 text-xs text-[#8FA0B8]">Warehouse Management System</p>
        </header>

        {/* Card Form Login */}
        <div className="relative w-full max-w-[28rem] my-auto py-4">
          <section className="ks-surface ks-border relative rounded-3xl border p-6 pt-10 shadow-[0_24px_60px_-28px_rgba(14,27,46,0.4)] sm:p-8 sm:pt-11 lg:p-7 lg:pt-8 transition-colors duration-200">
            {/* Tombol Toggle Dark/Light Mode */}
            <button
              onClick={handleToggleTheme}
              aria-label={dark ? 'Mode terang' : 'Mode gelap'}
              className="ks-focus ks-border ks-btn absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border text-inherit transition-colors cursor-pointer"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Desktop Brand Header di Dalam Card */}
            <div className="hidden lg:block">
              <MarkTema2 size={40} />
              <div className="mt-4 text-2xl xl:text-3xl font-semibold tracking-tight">Kalindo Scan</div>
              <p className="ks-muted mt-0.5 text-xs xl:text-sm">Warehouse Management System</p>
            </div>

            <div className="text-center lg:mt-6 lg:text-left">
              <h2 className="text-base xl:text-lg font-semibold">Selamat datang</h2>
              <p className="ks-muted mt-0.5 text-xs xl:text-sm">
                Silakan masuk untuk mengakses sistem gudang.
              </p>
            </div>

            {/* Error Message Box */}
            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-600/30 bg-red-600/10 px-3.5 py-3 text-sm text-red-600 animate-[fadeIn_0.2s_ease-out]"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  aria-label="Tutup pesan"
                  className="ks-focus rounded p-0.5 hover:opacity-75"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Tombol Utama: Login dengan Google */}
            <button
              onClick={handleGoogleClick}
              disabled={loading}
              aria-busy={loading}
              className="ks-focus relative mt-6 flex h-12 w-full items-center justify-center rounded-full border border-[#2B3A55] bg-[#0E1B2E] font-medium text-white transition-all hover:bg-[#17294A] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 shadow-sm cursor-pointer"
            >
              <span className="absolute left-1.5 grid h-9 w-9 place-items-center rounded-full bg-white shadow-xs">
                {loading ? (
                  <Loader2 size={18} className="animate-spin text-[#0E1B2E]" />
                ) : (
                  <GoogleLogo />
                )}
              </span>
              <span className="text-sm font-medium tracking-wide">
                {loading ? 'Memeriksa akun…' : 'Login dengan Google'}
              </span>
            </button>

            {/* Google Identity Fallback hidden container */}
            <div className="hidden" ref={gRefTema2} />

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <span className="ks-border flex-1 border-t" />
              <span className="ks-muted text-xs tracking-wider uppercase font-medium">
                Sistem aman
              </span>
              <span className="ks-border flex-1 border-t" />
            </div>

            {/* Tombol: Login Admin Panel */}
            <button
              onClick={handleAdminClick}
              className="ks-focus ks-border ks-btn flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-medium transition-all active:scale-[0.99] cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>Login Admin Panel</span>
            </button>

            {/* Disclaimer Kebijakan */}
            <p className="ks-muted mt-6 text-center text-xs leading-relaxed">
              Dengan masuk, Anda menyetujui Protokol Keselamatan Gudang dan Kebijakan Privasi Data
              internal.
            </p>

            {/* Card Footer Status */}
            <div className="ks-border ks-muted mt-5 flex items-center justify-between border-t pt-4 text-xs font-medium">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Sistem normal
              </span>
              <span className="font-mono tracking-wider">{regionId}</span>
            </div>
          </section>
        </div>

        {/* Mobile Footer */}
        <p className="relative text-xs text-[#8FA0B8] lg:hidden">
          Kalindo Scan &copy; {new Date().getFullYear()}
        </p>
      </main>

      {/* PIN Modal Fallback jika dibuka */}
      {showPin && (
        <PinModal onClose={() => setShowPin(false)} onVerified={handleAdminPinVerified} theme={activeTheme} dark={dark} />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-xl bg-[#16191D] px-4 py-2.5 text-sm text-white shadow-xl border border-white/10 animate-[popIn_0.2s_ease-out]"
        >
          {toast.ok ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
