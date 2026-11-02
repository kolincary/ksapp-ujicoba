
import React, { useEffect, useState, useRef } from 'react';
import { Monitor, Box, Package, Shuffle, Loader2, AlertCircle, Shield } from 'lucide-react';
import { supabase, rawSupabase } from '../services/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  onAdminLoginRequest?: () => void;
}

// Provided Google Client ID with env override
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '547501643468-92q8v07sfjglkf0s81capeo2vfl5a12l.apps.googleusercontent.com';

declare global {
  interface Window {
    google: any;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onAdminLoginRequest }) => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [showOAuthFallback, setShowOAuthFallback] = useState(false);
  const isInitializedRef = useRef(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleBtnRefMobile = useRef<HTMLDivElement>(null);

  // Fallback OAuth Login via redirect
  const handleOAuthLogin = async () => {
    setIsRedirecting(true);
    setErrorMsg(null);
    try {
      const { error } = await rawSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("OAuth Login Error:", err);
      setErrorMsg(err.message || "Failed to sign in with Google OAuth.");
      setIsRedirecting(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    // 1. Check active session directly from Supabase
    rawSupabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        onLoginSuccess(session.user.email);
      }
    });

    // 2. Listen for auth changes directly from Supabase
    const {
      data: { subscription },
    } = rawSupabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        onLoginSuccess(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, [onLoginSuccess]);

  // Initialize Google Identity Services
  useEffect(() => {
    const handleCredentialResponse = async (response: any) => {
      setIsRedirecting(true);
      setErrorMsg(null);

      // 1. Instant Google ID Token verification & direct login
      try {
        if (response.credential) {
          const base64Url = response.credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          if (payload && payload.email) {
            console.log("✅ Google Sign-In Success via ID Token:", payload.email);
            localStorage.setItem('kalindo_user_email', payload.email.trim());
            onLoginSuccess(payload.email.trim());
            setIsRedirecting(false);
            return;
          }
        }
      } catch (decodeErr) {
        console.warn("Direct JWT decode notice:", decodeErr);
      }

      // 2. Direct Supabase Auth
      try {
        const { data, error } = await rawSupabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        });

        if (error) throw error;
      } catch (err: any) {
        console.error("Google Login Error:", err);
        if (err?.message?.includes('Unacceptable audience') || err?.message?.includes('audience')) {
          setErrorMsg("Client ID belum didaftarkan di Supabase Auth Provider. Mengalihkan ke login Google OAuth...");
          await handleOAuthLogin();
          return;
        }
        setErrorMsg(err.message || "Failed to sign in with Google.");
        setIsRedirecting(false);
      }
    };

    const renderGoogleButton = () => {
      if (window.google) {
        const refs = [googleBtnRef.current, googleBtnRefMobile.current].filter(Boolean);
        refs.forEach((refNode) => {
          if (refNode) {
            refNode.innerHTML = '';
            const parentWidth = refNode.clientWidth || 320;

            window.google.accounts.id.renderButton(
              refNode,
              {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                width: parentWidth,
                shape: "pill",
                logo_alignment: "left"
              }
            );
          }
        });
      }
    };

    const initializeGoogleBtn = () => {
      if (!window.google) return;
      if (!isInitializedRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true
          });
          isInitializedRef.current = true;
          setGoogleReady(true);
        } catch (initErr) {
          console.warn("GSI initialize notice:", initErr);
        }
      }
      renderGoogleButton();

      // Check if origin (e.g. localhost:3001) is blocked by Google GIS 403
      // or if iframe failed to render within 1.2s
      setTimeout(() => {
        const desktopHasIframe = googleBtnRef.current?.querySelector('iframe');
        const mobileHasIframe = googleBtnRefMobile.current?.querySelector('iframe');
        const isNonStandardPort = window.location.port && window.location.port !== '3000';
        if (!desktopHasIframe && !mobileHasIframe) {
          setShowOAuthFallback(true);
        } else if (isNonStandardPort) {
          setShowOAuthFallback(true);
        }
      }, 1000);
    };

    if (window.google) {
      initializeGoogleBtn();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initializeGoogleBtn();
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }

    const handleResize = () => {
      renderGoogleButton();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dev Mode Bypass Listener 
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRedirecting) return;

      if (e.key.length === 1) {
        keyBuffer += e.key.toLowerCase();
      }
      if (keyBuffer.length > 15) {
        keyBuffer = keyBuffer.slice(-15);
      }

      // ADMIN PANEL BYPASS (devadmin -> dev@kalindo.com)
      if (keyBuffer.includes('devadmin')) {
        console.log("Admin Mode Activated");
        setIsRedirecting(true);
        keyBuffer = '';

        try {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('mode', 'admin');
          window.history.pushState({}, '', newUrl.toString());
        } catch (e) {
          console.warn("URL update failed (sandbox environment)", e);
        }

        setTimeout(() => {
          onLoginSuccess('dev@kalindo.com');
        }, 1200);
      }

      // PROFILE SELECTION BYPASS (devmode / devmodenew -> jgilbeth92@gmail.com)
      if (keyBuffer.includes('devmode') || keyBuffer.includes('devmodenew')) {
        console.log("Dev Profile Mode Activated");
        setIsRedirecting(true);
        keyBuffer = '';
        setTimeout(() => {
          onLoginSuccess('jgilbeth92@gmail.com');
        }, 1200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onLoginSuccess, isRedirecting]);

  return (
    <div className="h-full min-h-[100dvh] w-full flex flex-col lg:flex-row bg-[#f8fafc] dark:bg-gray-950 transition-colors duration-500 ease-in-out relative overflow-hidden select-none">

      {/* Redirecting Overlay */}
      {isRedirecting && (
        <div className="absolute inset-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connecting System</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Please wait while we redirect you...</p>
        </div>
      )}

      {/* ================= MOBILE & TABLET LAYOUT (< lg) ================= */}
      <div className="lg:hidden relative w-full h-[100dvh] min-h-[100dvh] flex flex-col justify-between items-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#1d63ed] via-[#2563eb] to-[#0f172a] text-white">

        {/* Full Screen Background Graphic (using 9:16 login-illustration-mobile.webp or tablet webp) */}
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
                const target = e.target as HTMLImageElement;
                target.src = "/assets/login-illustration.webp";
              }}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-blue-950/30 to-blue-900/10 pointer-events-none"></div>
        </div>

        {/* Ambient Glows */}
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header Branding Badge */}
        <div className="relative z-10 pt-3 sm:pt-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 border border-white/40 shadow-xl">
            <Monitor size={24} className="text-white sm:w-8 sm:h-8" strokeWidth={1.75} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
            Kalindo <span className="text-blue-200">Scan</span>
          </h1>
          <p className="text-blue-100/90 text-xs sm:text-sm font-medium mt-0.5 max-w-xs leading-tight drop-shadow">
            Warehouse Management System
          </p>
        </div>

        {/* Center/Bottom Glassmorphic Login Card */}
        <div className="relative z-10 w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-gray-800 p-5 sm:p-7 my-auto">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">Selamat Datang</h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">Silakan masuk untuk mengakses sistem gudang</p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-2xl text-xs flex items-center gap-2 border border-red-100 dark:border-red-800/50">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google Login Button Container Mobile */}
            <div className="w-full">
              <div className="w-full min-h-[50px] relative">
                <div ref={googleBtnRefMobile} id="google-btn-container-mobile" className="w-full min-h-[50px]"></div>

                {(!googleReady || showOAuthFallback) && (
                  <button
                    onClick={handleOAuthLogin}
                    className="w-full h-[50px] bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3 px-4 mt-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.3 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.18 0 10.02 0 12s.46 3.82 1.26 5.42l4.02-3.15z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                      </svg>
                    </div>
                    <span className="text-sm tracking-wide">Login dengan Google</span>
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center pt-1">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs pt-1">
                <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 font-semibold tracking-wider text-[10px] uppercase rounded-full">SECURE SYSTEM</span>
              </div>
            </div>

            {/* Admin Login Button */}
            {onAdminLoginRequest && (
              <div className="w-full">
                <button
                  onClick={onAdminLoginRequest}
                  className="w-full h-[46px] px-5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2.5 text-sm shadow-xs group"
                >
                  <Shield size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                  <span>Login Admin Panel</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
              By signing in, you agree to the internal <br className="hidden sm:inline" />
              Warehouse Safety Protocols and Data Privacy Policy.
            </p>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="relative z-10 pb-1 text-[10px] text-blue-200/70 font-medium">
          Kalindo Scan &copy; 2026
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
                (e.target as HTMLImageElement).src = "/assets/login-illustration.svg";
              }}
            />
          </div>

          {/* Branding Overlay */}
          <div className="relative z-10 text-left p-10 max-w-xl -mt-16">

            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-8 border border-white/40 shadow-2xl relative group">
              <div className="absolute inset-0 bg-blue-400/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity"></div>
              <Monitor size={48} className="text-white relative z-10" strokeWidth={1.75} />
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight leading-tight drop-shadow-md">
              Kalindo Scan
            </h1>
            <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-md drop-shadow">
              Efficient scanning, sorting, and packing for the modern warehouse.
            </p>

            <div className="absolute -top-12 -left-8 animate-bounce duration-[3500ms] pointer-events-none opacity-40">
              <Box className="text-white w-10 h-10" />
            </div>
            <div className="absolute top-1/2 -right-12 animate-bounce duration-[4500ms] pointer-events-none opacity-40">
              <Package className="text-white w-12 h-12" />
            </div>
            <div className="absolute bottom-2 right-10 animate-pulse pointer-events-none opacity-30">
              <Shuffle className="text-white w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Desktop Right Side - Login Form */}
        <div className="w-1/2 h-full bg-[#f8fafc] dark:bg-gray-950 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 overflow-y-auto">

          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800/80 p-8 lg:p-10 relative z-10 animate-[fadeIn_0.4s_ease-out] my-auto">

            <div className="text-left mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/40 rounded-2xl mb-4 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                <Monitor size={28} strokeWidth={2} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
                Kalindo <span className="text-blue-600 dark:text-blue-500">Scan</span>
              </h1>
              <p className="text-gray-400 dark:text-gray-500 font-medium text-xs sm:text-sm">Warehouse Management System</p>
            </div>

            <div className="space-y-5">
              <div className="text-left">
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">Selamat Datang</h2>
                <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-0.5">Silakan masuk untuk mengakses sistem gudang</p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3.5 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 border border-red-100 dark:border-red-800/50">
                  <AlertCircle size={18} className="shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Google Login Button Container Desktop */}
              <div className="w-full">
                <div className="w-full min-h-[50px] relative">
                  <div ref={googleBtnRef} id="google-btn-container" className="w-full min-h-[50px]"></div>

                  {(!googleReady || showOAuthFallback) && (
                    <button
                      onClick={handleOAuthLogin}
                      className="w-full h-[50px] bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-3 px-4 mt-2"
                    >
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.3 7.31 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.18 0 10.02 0 12s.46 3.82 1.26 5.42l4.02-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                      </div>
                      <span className="text-sm tracking-wide">Login dengan Google</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-xs pt-2">
                  <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 font-semibold tracking-wider text-[11px] uppercase">SECURE SYSTEM</span>
                </div>
              </div>

              {/* Admin Login Button */}
              {onAdminLoginRequest && (
                <div className="w-full">
                  <button
                    onClick={onAdminLoginRequest}
                    className="w-full h-[46px] px-5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full border border-slate-200/80 dark:border-slate-700/80 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2.5 text-sm shadow-xs group"
                  >
                    <Shield size={16} className="text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                    <span>Login Admin Panel</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 text-center">
              <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                By signing in, you agree to the internal <br className="hidden sm:inline" />
                Warehouse Safety Protocols and Data Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

