// Force HMR: 1784900245.81105

import React, { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Dashboard } from './components/Dashboard';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';
import { PinModal } from './components/PinModal';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { NameSelectionModal } from './components/NameSelectionModal';
import { AutoUpdateHandler } from './components/AutoUpdateHandler'; // NEW IMPORT
import { UserRole, UserPermissions, UserPins, AuthStep, AdminUser, UserManualInputAccess, ProfileConfig } from './types';
import { supabase } from './services/supabaseClient';
import { startDeviceTracking, stopDeviceTracking } from './services/deviceTracker';
import { initGineeGlobalSyncScheduler } from './services/gineeGlobalSyncService';
import { Ban, LogOut, User, Crown, Search, X, Lock, Target } from 'lucide-react';

const DEFAULT_PROFILE_CONFIG: ProfileConfig[] = [
  { role: 'PICKER', is_active: true, sort_order: 1 },
  { role: 'PICKER_2', is_active: true, sort_order: 1 },
  { role: 'SORTIR', is_active: true, sort_order: 2 },
  { role: 'SORTIR_BATCH', is_active: true, sort_order: 3 },
  { role: 'PACKING', is_active: true, sort_order: 4 },
  { role: 'PACKING_2', is_active: true, sort_order: 4 },
  { role: 'GUDANG', is_active: true, sort_order: 5 },
  { role: 'OJOL', is_active: true, sort_order: 6 },
  { role: 'LEADER', is_active: true, sort_order: 7 },
  { role: 'CHECKER', is_active: true, sort_order: 9 },
  { role: 'ADMIN', is_active: true, sort_order: 8 },
];

// Default Data Initialization (Fallback)
const DEFAULT_PERMISSIONS: UserPermissions = {
  'picker@kalindo.com': [UserRole.PICKER, UserRole.PICKER_2],
  'sortir@kalindo.com': [UserRole.SORTIR],
  'packing@kalindo.com': [UserRole.PACKING, UserRole.PACKING_2],
  'dev@kalindo.com': [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR, UserRole.PACKING, UserRole.PACKING_2, UserRole.GUDANG, UserRole.OJOL, UserRole.LEADER],
  'developer@kalindo.com': [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR, UserRole.PACKING, UserRole.PACKING_2, UserRole.GUDANG, UserRole.OJOL, UserRole.LEADER, UserRole.ADMIN], // For devmode bypass
  'gudang.user@gmail.com': [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR, UserRole.PACKING, UserRole.PACKING_2, UserRole.GUDANG, UserRole.OJOL, UserRole.LEADER, UserRole.ADMIN],
  'leader@kalindo.com': [UserRole.LEADER],
  'admin@kalindo.com': [UserRole.ADMIN],
};

const DEFAULT_PINS: UserPins = {
  'picker@kalindo.com': '123456',
  'sortir@kalindo.com': '123456',
  'packing@kalindo.com': '123456',
  'dev@kalindo.com': '123456',
  'developer@kalindo.com': '123456', // For devmode bypass
  'gudang.user@gmail.com': '123456',
  'leader@kalindo.com': '123456',
  'admin@kalindo.com': '123456',
};

// Storage Keys
const STORAGE_KEY_USER = 'kalindo_user_email';
const STORAGE_KEY_ROLE = 'kalindo_user_role';
const STORAGE_KEY_ROLE_DATE = 'kalindo_role_date';
const STORAGE_KEY_THEME = 'theme';
const STORAGE_KEY_ADMIN_SESSION = 'kalindo_admin_session'; // Stores full AdminUser object stringified
const STORAGE_KEY_EMPLOYEE_NAME = 'kalindo_employee_name';
const STORAGE_KEY_EMPLOYEE_TARGET = 'kalindo_employee_target'; // Store target locally
const STORAGE_KEY_SCAN_POS = 'kalindo_scan_pos';
const STORAGE_KEY_ADMIN_LAST_LOGIN = 'kalindo_admin_last_login'; // 3-day persistence
const STORAGE_KEY_GOD_MODE_TARGET = 'kalindo_god_mode_target'; // Persistence for God Mode
const STORAGE_KEY_PROFILE_CONFIG = 'kalindo_profile_config'; // Persistence for Profile Config

const GOD_MODE_USERS = ['developer@kalindo.com', 'jgilbeth92@gmail.com'];


// Backup Configuration
const STORAGE_KEY_LAST_BACKUP = 'kalindo_last_backup';
const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 Minutes

const App: React.FC = () => {
  const [authStep, setAuthStep] = useState<AuthStep>('LOADING');
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [godModeTargetEmail, setGodModeTargetEmail] = useState<string>('');
  const [godModeSearch, setGodModeSearch] = useState<string>(''); // Search for God Mode
  const [employeeName, setEmployeeName] = useState<string>('');
  const [employeeTarget, setEmployeeTarget] = useState<number>(0); // New state for target
  const [isDarkMode, setIsDarkMode] = useState(false);
  // CHANGED DEFAULT TO CENTER
  const [scanButtonPosition, setScanButtonPosition] = useState<'left' | 'center' | 'right'>('center');
  const [isUserBlocked, setIsUserBlocked] = useState(false);

  // Daily Quest State
  const [isDailyQuestCompleted, setIsDailyQuestCompleted] = useState<boolean | null>(null); // null means loading
  const [dailyQuestCompleter, setDailyQuestCompleter] = useState<string>('');
  const [dailyQuestTargetRoles, setDailyQuestTargetRoles] = useState<string[]>([]);
  const [dailyQuestName, setDailyQuestName] = useState<string>('FISIK_STOCK');

  // Admin State
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [initialView, setInitialView] = useState<any>(undefined);

  // Admin Config States (Global App Users)
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [userPins, setUserPins] = useState<UserPins>(DEFAULT_PINS);
  const [userManualInputAccess, setUserManualInputAccess] = useState<UserManualInputAccess>({});
  
  // Profile Config State
  const [profileConfig, setProfileConfig] = useState<ProfileConfig[]>(() => {
    const cached = localStorage.getItem(STORAGE_KEY_PROFILE_CONFIG);
    let parsedConfig = DEFAULT_PROFILE_CONFIG;
    if (cached) {
      try { parsedConfig = JSON.parse(cached); } catch(e) {}
    }
    const existingRoles = parsedConfig.map(p => p.role);
    const missingProfiles = DEFAULT_PROFILE_CONFIG.filter(p => !existingRoles.includes(p.role));
    return [...parsedConfig, ...missingProfiles];
  });

  // 0. TRAFFIC-BASED BACKUP TRIGGER
  const triggerTrafficBasedBackup = async () => {
    try {
      const isBackupEnabled = localStorage.getItem('enable_drive_backup') === 'true';
      if (!isBackupEnabled) return;
      const lastBackupStr = localStorage.getItem(STORAGE_KEY_LAST_BACKUP);
      const lastBackup = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;
      const now = Date.now();

      if (now - lastBackup > BACKUP_INTERVAL_MS) {
        // Update timestamp IMMEDIATELY to prevent double-firing (optimistic lock)
        localStorage.setItem(STORAGE_KEY_LAST_BACKUP, now.toString());

        // Fire and Forget via Supabase Functions client (handles auth & CORS safely)
        supabase.functions.invoke('backup-to-drive').catch(() => {});
      }
    } catch (e) {
      // Silent fail
    }
  };

  // 1. Fetch Data from Supabase on Mount
  useEffect(() => {
    // Attempt Backup Trigger on App Mount
    triggerTrafficBasedBackup();
    // Inisialisasi sinkronisasi pesanan Ginee otomatis di latar belakang (aktif di menu manapun)
    initGineeGlobalSyncScheduler();

    const fetchSupabaseData = async () => {
      try {
        const { data, error } = await supabase.from('app_users').select('email, roles, allow_manual_input, is_blocked, pin');

        if (error) throw error;

        if (data && data.length > 0) {
          const newPerms: UserPermissions = { ...DEFAULT_PERMISSIONS };
          const newManualAccess: UserManualInputAccess = {};
          const newPins: UserPins = { ...DEFAULT_PINS };

          data.forEach((user: any) => {
            if (!user.email) return;
            const rawEmail = user.email;
            const lowerEmail = rawEmail.toLowerCase().trim();
            const roles = user.roles || [];
            const allowManual = user.allow_manual_input === true;
            const pin = user.pin || '123456';

            newPerms[rawEmail] = roles;
            newPerms[lowerEmail] = roles;
            newManualAccess[rawEmail] = allowManual;
            newManualAccess[lowerEmail] = allowManual;
            newPins[rawEmail] = pin;
            newPins[lowerEmail] = pin;
          });

          setUserPermissions(newPerms);
          setUserManualInputAccess(newManualAccess);
          setUserPins(newPins);
        }
      } catch (err: any) {
        // Graceful error handling for missing tables or connection issues
        if (err?.code === '42P01') {
          console.warn("Supabase table 'app_users' not found. Using default permissions. Please run the SQL setup scripts.");
        } else if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
          console.warn("Supabase connection offline or unreachable. Using default permissions.");
        } else {
          console.error("Error fetching Supabase data:", err?.message || JSON.stringify(err));
        }
      }
      try {
        const { data: profileData, error: profileError } = await supabase.from('app_profiles_config').select('*').order('sort_order');
        if (!profileError && profileData && profileData.length > 0) {
          const existingRoles = profileData.map((p: any) => p.role);
          const missingProfiles = DEFAULT_PROFILE_CONFIG.filter(p => !existingRoles.includes(p.role));
          const mergedData = [...profileData, ...missingProfiles];
          setProfileConfig(mergedData);
          localStorage.setItem(STORAGE_KEY_PROFILE_CONFIG, JSON.stringify(mergedData));
        }
      } catch (err) {
        console.warn("Could not fetch profile config from Supabase");
      }

      // Daily Quest default unlocked (not used in this project)
      setIsDailyQuestCompleted(true);
      setDailyQuestTargetRoles([]);
    };

    fetchSupabaseData();
  }, []);

  // 2. Initialize Theme & Session & Settings
  useEffect(() => {
    const initSettings = () => {
      // Theme
      if (localStorage.getItem(STORAGE_KEY_THEME) === 'dark') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove('dark');
      }

      // Scan Position
      const savedPos = localStorage.getItem(STORAGE_KEY_SCAN_POS);
      if (savedPos === 'left' || savedPos === 'center' || savedPos === 'right') {
        setScanButtonPosition(savedPos as any);
      } else {
        // Fallback default if nothing saved
        setScanButtonPosition('center');
      }
    };
    initSettings();

    // Splash Screen & Session Hydration
    const timer = setTimeout(() => {
      // ---------------------------------------------------------
      // URL-BASED ROUTING FOR ADMIN PORTAL
      // Checks for /admin path or ?mode=admin query parameter
      // ---------------------------------------------------------
      const path = window.location.pathname;
      const query = new URLSearchParams(window.location.search);
      const isAdminMode = path.startsWith('/admin') || query.get('mode') === 'admin' || Boolean(query.get('view')) || localStorage.getItem('is_admin_mode') === 'true';
      const viewParam = query.get('view');
      if (viewParam) setInitialView(viewParam);

      const storedEmail = localStorage.getItem(STORAGE_KEY_USER);
      const storedGodModeTarget = localStorage.getItem(STORAGE_KEY_GOD_MODE_TARGET);
      const storedRole = localStorage.getItem(STORAGE_KEY_ROLE);
      const storedDate = localStorage.getItem(STORAGE_KEY_ROLE_DATE);
      const storedName = localStorage.getItem(STORAGE_KEY_EMPLOYEE_NAME);
      const storedTarget = localStorage.getItem(STORAGE_KEY_EMPLOYEE_TARGET);
      const adminSessionStr = localStorage.getItem(STORAGE_KEY_ADMIN_SESSION);
      const adminLastLoginStr = localStorage.getItem(STORAGE_KEY_ADMIN_LAST_LOGIN);
      const todayStr = new Date().toDateString();

      // Priority 1: Direct URL to Admin
      if (isAdminMode) {
        if (adminSessionStr) {
          // Check 3-day persistence logic
          const lastLogin = adminLastLoginStr ? parseInt(adminLastLoginStr, 10) : Date.now();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

          if (Date.now() - lastLogin < threeDaysMs) {
            try {
              const adminData = JSON.parse(adminSessionStr);
              if (adminData && adminData.username) {
                // Verify with Supabase that this admin actually exists
                supabase
                  .from('admin_users')
                  .select('id, username, permissions')
                  .eq('username', adminData.username)
                  .maybeSingle()
                  .then(({ data: dbAdmin, error: adminErr }) => {
                    if (!adminErr && dbAdmin) {
                      const verifiedAdmin: AdminUser = {
                        id: dbAdmin.id,
                        username: dbAdmin.username,
                        permissions: dbAdmin.permissions || []
                      };
                      setCurrentAdmin(verifiedAdmin);
                      localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(verifiedAdmin));
                      localStorage.setItem(STORAGE_KEY_ADMIN_LAST_LOGIN, Date.now().toString());
                      setAuthStep('ADMIN_DASHBOARD');
                    } else if (adminData.username === 'Tamu' && adminData.id === -1) {
                      setCurrentAdmin(adminData);
                      setAuthStep('ADMIN_DASHBOARD');
                    } else {
                      // Session is forged or admin no longer exists
                      localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
                      localStorage.removeItem(STORAGE_KEY_ADMIN_LAST_LOGIN);
                      localStorage.removeItem('is_admin_mode');
                      setAuthStep('ADMIN_LOGIN');
                    }
                  })
                  .catch(() => {
                    setAuthStep('ADMIN_LOGIN');
                  });
              } else {
                setAuthStep('ADMIN_LOGIN');
              }
            } catch (e) {
              setAuthStep('ADMIN_LOGIN');
            }
          } else {
            // Expired
            localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
            localStorage.removeItem(STORAGE_KEY_ADMIN_LAST_LOGIN);
            localStorage.removeItem('is_admin_mode');
            setAuthStep('ADMIN_LOGIN');
          }
        } else {
          setAuthStep('ADMIN_LOGIN');
        }
        return; // Stop processing standard login
      }

      // Priority 2: Standard User Session
      if (storedEmail) {
        setUserEmail(storedEmail);

        // Restore God Mode Target if applicable
        if (storedGodModeTarget && GOD_MODE_USERS.includes(storedEmail)) {
          setGodModeTargetEmail(storedGodModeTarget);
        }

        if (storedEmail === 'dev@kalindo.com') {
          // Legacy check for dev email (Admin logic reuse)
          if (adminSessionStr) {
            try {
              const adminData = JSON.parse(adminSessionStr);
              setCurrentAdmin(adminData);
              setAuthStep('ADMIN_DASHBOARD');
            } catch (e) {
              setAuthStep('ADMIN_LOGIN');
            }
          } else {
            setAuthStep('ADMIN_LOGIN');
          }
        } else {
          // Check for valid role session
          let isSessionValid = false;
          if (storedRole && storedDate) {
            const lastLoginDate = new Date(storedDate);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastLoginDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays <= 3) {
              isSessionValid = true;
              // Refresh the session date so it's a sliding window
              if (storedDate !== todayStr) {
                localStorage.setItem(STORAGE_KEY_ROLE_DATE, todayStr);
              }
            }
          }

          if (isSessionValid) {
            if (Object.values(UserRole).includes(storedRole as UserRole)) {
              setCurrentRole(storedRole as UserRole);
              if (storedName) {
                setEmployeeName(storedName);
                setEmployeeTarget(storedTarget ? parseInt(storedTarget) : 0);
                setAuthStep('LOGGED_IN');
              } else {
                // If role exists but name is missing (rare case), go pick name
                setAuthStep('NAME_SELECTION');
              }
            } else {
              setAuthStep('ROLE_SELECTION');
            }
          } else {
            // Session expired or invalid
            localStorage.removeItem(STORAGE_KEY_ROLE);
            localStorage.removeItem(STORAGE_KEY_ROLE_DATE);
            localStorage.removeItem(STORAGE_KEY_EMPLOYEE_NAME);
            localStorage.removeItem(STORAGE_KEY_EMPLOYEE_TARGET);
            setCurrentRole(null);
            setAuthStep('ROLE_SELECTION');
          }
        }
      } else {
        setAuthStep('LOGIN');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // --- 2.5 LIVE ADMIN PERMISSIONS SYNC ---
  useEffect(() => {
    const syncAdminPermissions = async () => {
      if (authStep === 'ADMIN_DASHBOARD' && currentAdmin?.username) {
        try {
          const { data: freshAdmin, error } = await supabase
            .from('admin_users')
            .select('permissions')
            .eq('username', currentAdmin.username)
            .maybeSingle();

          if (!error && freshAdmin && freshAdmin.permissions) {
            const updatedAdmin = { ...currentAdmin, permissions: freshAdmin.permissions };
            setCurrentAdmin(updatedAdmin);
            localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(updatedAdmin));
          }
        } catch (err) {
          console.warn("Live admin permissions sync error:", err);
        }
      }
    };
    syncAdminPermissions();
  }, [authStep, currentAdmin?.username]);

  // --- 3. REALTIME BLOCKING & PERMISSION LISTENER ---
  useEffect(() => {
    if (!userEmail) return;

    const lowerUserEmail = userEmail.toLowerCase().trim();

    // Subscribe to UPDATE events on app_users
    const subscription = supabase
      .channel(`public:app_users:${lowerUserEmail}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_users' },
        (payload) => {
          if (payload.new && payload.new.email) {
            const updatedEmail = (payload.new.email as string).toLowerCase().trim();
            if (updatedEmail === lowerUserEmail) {
              if (payload.new.is_blocked === true) {
                setIsUserBlocked(true);
                localStorage.removeItem(STORAGE_KEY_USER);
                localStorage.removeItem(STORAGE_KEY_ROLE);
              }
              if (payload.new.allow_manual_input !== undefined) {
                const allowManual = payload.new.allow_manual_input === true;
                setUserManualInputAccess(prev => ({
                  ...prev,
                  [userEmail]: allowManual,
                  [lowerUserEmail]: allowManual,
                  [payload.new.email]: allowManual
                }));
              }
              if (payload.new.roles !== undefined) {
                setUserPermissions(prev => ({
                  ...prev,
                  [userEmail]: payload.new.roles,
                  [lowerUserEmail]: payload.new.roles,
                  [payload.new.email]: payload.new.roles
                }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userEmail]);



  // --- 4. USER ACTIVITY & DEVICE MONITORING ---
  useEffect(() => {
    if (authStep === 'LOGGED_IN' && userEmail && currentRole) {
      // Start Multi-Device Tracking in Firestore
      startDeviceTracking(
        userEmail,
        employeeName || userEmail,
        currentRole,
        () => {
          alert("PERINGATAN: Sesi perangkat ini telah dihentikan oleh Administrator.");
          handleLogout();
        }
      );

      const updateActivity = async (status: 'LOGGED_IN' | 'LOGGED_OUT' = 'LOGGED_IN') => {
        try {
          // Check if admin has force logged out this user before updating activity
          if (status === 'LOGGED_IN') {
             const { data: checkData } = await supabase.from('user_activity').select('force_logout').eq('user_email', userEmail).single();
             if (checkData && checkData.force_logout === true) {
                alert("PERINGATAN: Sesi Anda telah dihentikan oleh Administrator.");
                handleLogout();
                return; // Stop updating activity
             }
          }
          
          const { error } = await supabase
            .from('user_activity')
            .upsert({
              user_email: userEmail,
              employee_name: employeeName,
              role: currentRole,
              login_status: status,
              last_active: new Date().toISOString()
            }, { onConflict: 'user_email' });
          if (error) console.warn("Activity tracking error:", error.message);
        } catch (e) {
          // silent
        }
      };

      // Initial update
      updateActivity('LOGGED_IN');

      // Periodic update every 30 seconds
      const interval = setInterval(() => updateActivity('LOGGED_IN'), 30000);

      // Listener for force logout
      const sub = supabase.channel(`activity_${userEmail}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_activity', filter: `user_email=eq.${userEmail}` }, (payload) => {
          if (payload.new && payload.new.force_logout === true) {
            alert("PERINGATAN: Sesi Anda telah dihentikan oleh Administrator.");
            handleLogout();
          }
        })
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(sub);
        stopDeviceTracking(userEmail);
      };
    }
  }, [authStep, userEmail, currentRole, employeeName]);

  // --- 4b. ADMIN DEVICE MONITORING (admin, admin2, admin3, etc.) ---
  useEffect(() => {
    if (authStep === 'ADMIN_DASHBOARD' && currentAdmin?.username) {
      const adminName = currentAdmin.username;
      startDeviceTracking(
        adminName,
        adminName,
        currentAdmin.role || 'ADMIN',
        () => {
          alert("PERINGATAN: Sesi perangkat Admin ini telah dihentikan oleh Administrator.");
          handleLogout();
        }
      );

      return () => {
        stopDeviceTracking(adminName);
      };
    }
  }, [authStep, currentAdmin?.username]);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(STORAGE_KEY_THEME, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(STORAGE_KEY_THEME, 'light');
      }
      return newMode;
    });
  };

  const handleSetScanPosition = (pos: 'left' | 'center' | 'right') => {
    setScanButtonPosition(pos);
    localStorage.setItem(STORAGE_KEY_SCAN_POS, pos);
  };

  // Handlers
  const handleLoginSuccess = async (email: string) => {
    const trimmedEmail = email.trim();
    const lowerEmail = trimmedEmail.toLowerCase();
    setUserEmail(trimmedEmail);
    localStorage.setItem(STORAGE_KEY_USER, trimmedEmail);

    // --- SUPABASE REGISTRATION & BLOCK CHECK ---
    try {
      // 1. Check if user exists (case-insensitive)
      const { data: existingUser, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .ilike('email', lowerEmail)
        .maybeSingle();

      // If user exists, CHECK IF BLOCKED & SYNC STATE
      if (existingUser) {
        if (existingUser.is_blocked) {
          // SHOW MODAL INSTEAD OF ALERT
          setIsUserBlocked(true);
          return;
        }

        // CRITICAL: Directly sync permissions, PIN, and manual input access from existingUser
        const allowManual = existingUser.allow_manual_input === true;
        setUserManualInputAccess(prev => ({
          ...prev,
          [trimmedEmail]: allowManual,
          [lowerEmail]: allowManual,
          [existingUser.email]: allowManual
        }));

        if (existingUser.roles) {
          setUserPermissions(prev => ({
            ...prev,
            [trimmedEmail]: existingUser.roles,
            [lowerEmail]: existingUser.roles,
            [existingUser.email]: existingUser.roles
          }));
        }

        if (existingUser.pin) {
          setUserPins(prev => ({
            ...prev,
            [trimmedEmail]: existingUser.pin,
            [lowerEmail]: existingUser.pin,
            [existingUser.email]: existingUser.pin
          }));
        }
      }

      // Reset force_logout flag in user_activity so user can log in again after a force logout
      try {
        await supabase.from('user_activity').update({ force_logout: false }).ilike('user_email', lowerEmail);
      } catch (resetErr) {
        console.warn("Could not reset force_logout flag:", resetErr);
      }

      // 2. If not found (or error implying not found but table exists), Insert new user
      if (!existingUser && (!fetchError || fetchError.code !== '42P01')) {
        console.log(`Registering new user to Supabase: ${trimmedEmail}`);

        // Default roles for the demo user 'gudang.user', otherwise empty for safety
        const defaultRoles = (lowerEmail === 'gudang.user@gmail.com' || lowerEmail === 'developer@kalindo.com')
          ? [UserRole.PICKER, UserRole.PICKER_2, UserRole.SORTIR, UserRole.PACKING, UserRole.GUDANG, UserRole.ADMIN]
          : [];

        const { error: insertError } = await supabase
          .from('app_users')
          .insert([
            {
              email: trimmedEmail,
              pin: '123456',
              roles: defaultRoles,
              allow_manual_input: false // Default locked
            }
          ]);

        if (insertError) {
          if (insertError.code === '42P01') {
            console.warn("Cannot register user: 'app_users' table missing.");
          } else {
            console.error("Failed to register user in Supabase:", insertError);
          }
        } else {
          // Update local state to reflect new user immediately
          setUserPermissions(prev => ({ ...prev, [trimmedEmail]: defaultRoles, [lowerEmail]: defaultRoles }));
          setUserPins(prev => ({ ...prev, [trimmedEmail]: '123456', [lowerEmail]: '123456' }));
          setUserManualInputAccess(prev => ({ ...prev, [trimmedEmail]: false, [lowerEmail]: false }));
        }
      }
    } catch (err) {
      console.error("Supabase Registration Error:", err);
    }
    // -----------------------------------

    if (email === 'dev@kalindo.com') {
      setAuthStep('ADMIN_LOGIN');
    } else {
      // **GOD MODE CHECK**
      if (GOD_MODE_USERS.includes(email)) {
        setAuthStep('GOD_MODE_SELECTION');
      } else {
        // **REMOVED PIN_CHECK**: Skip Security Verification as requested
        setAuthStep('ROLE_SELECTION');
      }
    }
  };

  const handlePinSuccess = () => {
    setAuthStep('ROLE_SELECTION');
  };

  const handlePinCancel = async () => {
    // CRITICAL FIX: Sign out of Supabase to prevent LoginScreen from auto-detecting session
    // and looping back to PIN check immediately.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("SignOut error on PIN cancel", e);
    }

    setUserEmail('');
    localStorage.removeItem(STORAGE_KEY_USER);
    setAuthStep('LOGIN');
  };

  const handleRoleSelect = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem(STORAGE_KEY_ROLE, role);
    localStorage.setItem(STORAGE_KEY_ROLE_DATE, new Date().toDateString());
    localStorage.setItem('is_admin_mode', 'false');
    // Go to Name Selection instead of directly Dashboard
    setAuthStep('NAME_SELECTION');
  };

  const handleNameSelect = async (name: string) => {
    setEmployeeName(name);
    localStorage.setItem(STORAGE_KEY_EMPLOYEE_NAME, name);

    // Fetch target for this employee
    try {
      const { data } = await supabase
        .from('employees')
        .select('daily_target')
        .eq('name', name)
        .single();

      const target = data?.daily_target || 0;
      setEmployeeTarget(target);
      localStorage.setItem(STORAGE_KEY_EMPLOYEE_TARGET, target.toString());
    } catch (e) {
      console.error("Failed to fetch target", e);
      setEmployeeTarget(0);
    }

    setAuthStep('LOGGED_IN');
  };

  const handleLogout = () => {
    // 1. Snapshot critical settings we want to keep
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
    const savedScanPos = localStorage.getItem(STORAGE_KEY_SCAN_POS);
    const savedDeviceId = localStorage.getItem('kalindo_device_id');
    const emailToLog = userEmail;
    const adminToLog = currentAdmin?.username;

    // 2. Cleanly clear all session, admin state, and role storage
    try {
      localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
      localStorage.removeItem(STORAGE_KEY_ADMIN_LAST_LOGIN);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_ROLE);
      localStorage.removeItem(STORAGE_KEY_ROLE_DATE);
      localStorage.removeItem(STORAGE_KEY_EMPLOYEE_NAME);
      localStorage.removeItem(STORAGE_KEY_EMPLOYEE_TARGET);
      localStorage.removeItem('is_admin_mode');
      localStorage.removeItem('kalindo_admin_active_view');
      localStorage.removeItem('isDevModeNew');
      localStorage.removeItem('showSecretMenu');
      localStorage.removeItem('showFakeReportMenu');
      sessionStorage.clear();

      // Clean Supabase auth tokens
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') && k.includes('auth-token')) {
          localStorage.removeItem(k);
        }
      });

      if (savedTheme) localStorage.setItem(STORAGE_KEY_THEME, savedTheme);
      if (savedScanPos) localStorage.setItem(STORAGE_KEY_SCAN_POS, savedScanPos);
      if (savedDeviceId) localStorage.setItem('kalindo_device_id', savedDeviceId);
    } catch (e) {
      console.warn('Storage clear notice:', e);
    }

    // 3. Immediately reset URL to root / without any query parameters (?view=..., ?mode=admin)
    try {
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.origin + '/');
      }
    } catch (e) {}

    // 4. Reset internal React state IMMEDIATELY so UI transitions to LOGIN instantly (0ms)
    setCurrentRole(null);
    setUserEmail('');
    setGodModeTargetEmail('');
    setEmployeeName('');
    setEmployeeTarget(0);
    setCurrentAdmin(null);
    setGodModeSearch('');
    setAuthStep('LOGIN');

    // 5. Fire background cleanup without blocking or freezing UI
    try {
      if (emailToLog) {
        stopDeviceTracking(emailToLog).catch(() => {});
        supabase
          .from('user_activity')
          .update({
            login_status: 'LOGGED_OUT',
            last_logout: new Date().toISOString()
          })
          .eq('user_email', emailToLog)
          .catch(() => {});
      } else if (adminToLog) {
        stopDeviceTracking(adminToLog).catch(() => {});
      }
      supabase.auth.signOut().catch(() => {});
    } catch (err) {
      console.warn('Background logout notice:', err);
    }
  };

  const handleDashboardBack = () => {
    setCurrentRole(null);
    setEmployeeName('');
    setEmployeeTarget(0);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    localStorage.removeItem(STORAGE_KEY_ROLE_DATE);
    localStorage.removeItem(STORAGE_KEY_EMPLOYEE_NAME);
    localStorage.removeItem(STORAGE_KEY_EMPLOYEE_TARGET);
    setAuthStep('ROLE_SELECTION');
  };

  const handleNameBack = () => {
    setCurrentRole(null);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    localStorage.removeItem(STORAGE_KEY_ROLE_DATE);
    setAuthStep('ROLE_SELECTION');
  }

  // DevMode Bypass Helper
  const handleBypassDevMode = () => {
    const devAdminUser: AdminUser = {
      id: 'devmode-admin',
      username: 'admin',
      permissions: [
        'view_dashboard',
        'manage_employees',
        'view_packing',
        'view_packing_2',
        'view_picker',
        'view_checker',
        'view_leader_2',
        'view_gudang',
        'view_sortir',
        'view_ojol',
        'manage_pins',
        'manage_access',
        'manage_admins',
        'view_profile_config',
        'manage_database',
        'view_search_data',
        'view_search_data_2',
        'view_failed_scans',
        'manage_symbols',
        'manage_cancel_data',
        'view_compare_logistik',
        'view_scan_all',
        'view_fake_report',
        'view_check_invoice',
        'manage_batches'
      ]
    };
    try {
      sessionStorage.removeItem('admin_login_lock_until');
      sessionStorage.removeItem('admin_login_attempts');
      localStorage.setItem('isDevModeNew', 'true');
      localStorage.setItem('showSecretMenu', 'true');
      localStorage.setItem('showFakeReportMenu', 'true');
      // Clean any expired/stale Supabase auth tokens that cause 401 Unauthorized
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') && k.includes('auth-token')) {
          localStorage.removeItem(k);
        }
      });
      if (localStorage.getItem('active_supabase_url') !== 'https://ldzsudeqrpmpjolpybsx.supabase.co') {
        localStorage.setItem('active_supabase_url', 'https://ldzsudeqrpmpjolpybsx.supabase.co');
        localStorage.setItem('active_supabase_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkenN1ZGVxcnBtcGpvbHB5YnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mjg5NTksImV4cCI6MjEwOTIwNDk1OX0.4ZQW_0fW8QgZbHTy4zJoFK4RmnMmK6iagE6zHEVCDYg');
      }
    } catch (e) {}
    handleAdminLoginSuccess(devAdminUser);
  };

  // Global listener saat di login panel admin / login screen
  useEffect(() => {
    if (authStep !== 'LOGIN' && authStep !== 'ADMIN_LOGIN') return;
    let keyBuffer = '';
    const handleGlobalDevModeKeyDown = (e: KeyboardEvent) => {
      if (e.key && e.key.length === 1) {
        keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-25);
        if (keyBuffer.includes('logindevmode') || keyBuffer.includes('devmode')) {
          keyBuffer = '';
          handleBypassDevMode();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalDevModeKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalDevModeKeyDown, true);
    };
  }, [authStep]);

  // Admin Handlers
  const handleAdminLoginSuccess = (adminUser: AdminUser) => {
    setCurrentAdmin(adminUser);
    localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(adminUser));
    localStorage.setItem(STORAGE_KEY_ADMIN_LAST_LOGIN, Date.now().toString()); // Set login time
    localStorage.setItem('is_admin_mode', 'true');
    
    // Khusus admin2, selalu default langsung ke menu Catatan Shift & Urgent Admin
    if ((adminUser?.username || '').trim().toLowerCase() === 'admin2') {
      localStorage.setItem('kalindo_admin_active_view', 'ADMIN_NOTES');
      setInitialView('ADMIN_NOTES');
    }
    
    setAuthStep('ADMIN_DASHBOARD');
  };

  const handleAdminSave = async (newPermissions: UserPermissions, newPins: UserPins, newManualAccess?: UserManualInputAccess) => {
    // 1. Update Local State
    setUserPermissions(newPermissions);
    setUserPins(newPins);
    if (newManualAccess) {
      setUserManualInputAccess(newManualAccess);
    }

    // 2. Sync to Supabase
    try {
      const updates = Object.keys(newPermissions).map(email => {
        const lower = email.toLowerCase().trim();
        const allowManual = newManualAccess
          ? (newManualAccess[lower] ?? newManualAccess[email] ?? false)
          : (userManualInputAccess[lower] ?? userManualInputAccess[email] ?? false);

        return {
          email: email,
          roles: newPermissions[email],
          pin: newPins[email] || '123456',
          allow_manual_input: allowManual
        };
      });

      // Upsert allows us to update existing rows or insert new ones if they are missing
      const { error } = await supabase
        .from('app_users')
        .upsert(updates, { onConflict: 'email' });

      if (error) {
        if (error.code === '42P01') {
          alert("Database table 'app_users' does not exist. Changes saved locally only.");
        } else {
          alert(`Error saving to Cloud: ${error.message}`);
        }
        console.error("Supabase Sync Error:", error);
      } else {
        console.log("Successfully synced permissions to Supabase");
      }
    } catch (err) {
      console.error("Unexpected error syncing to Supabase:", err);
      alert("Network error: Changes saved locally but failed to sync to cloud.");
    }
  };

  // God Mode Handlers
  const handleGodModeSelect = (targetEmail: string | null) => {
    if (targetEmail) {
      setGodModeTargetEmail(targetEmail);
      localStorage.setItem(STORAGE_KEY_GOD_MODE_TARGET, targetEmail);
    } else {
      setGodModeTargetEmail('');
      localStorage.removeItem(STORAGE_KEY_GOD_MODE_TARGET);
    }
    setAuthStep('ROLE_SELECTION');
  };

  const handleSaveProfileConfig = async (newConfig: ProfileConfig[]) => {
    setProfileConfig(newConfig);
    localStorage.setItem(STORAGE_KEY_PROFILE_CONFIG, JSON.stringify(newConfig));
    const payload = newConfig.map((item: any) => {
        const { id, ...rest } = item;
        return rest;
      });
      try {
        const { error } = await supabase.from('app_profiles_config').upsert(payload, { onConflict: 'role' });
      if (error) {
         alert("Gagal menyimpan konfigurasi ke cloud: " + error.message);
      }
    } catch (e: any) {
      alert("Network error: " + e.message);
    }
  };

  // Render Views based on State
  if (authStep === 'LOADING') {
    return <SplashScreen />;
  }

  // Determine Effective Email & Permissions for Role Selector
  // If God Mode is active (target set), we use that target's permissions.
  // Otherwise we use the logged in user's email.
  const effectiveEmail = godModeTargetEmail || userEmail;
  const effectivePermissions = userPermissions;

  // Determine if we are in Admin Dashboard mode to adjust layout
  const isAdminDashboard = authStep === 'ADMIN_DASHBOARD';

  return (
    <div className={`h-[100dvh] w-full bg-gray-100 dark:bg-gray-950 font-sans text-gray-900 dark:text-white transition-colors duration-500 ease-in-out overflow-y-auto supports-[height:100dvh]:h-[100dvh] ${isAdminDashboard || authStep === 'LOGIN' || authStep === 'ADMIN_LOGIN' || authStep === 'GOD_MODE_SELECTION' || authStep === 'ROLE_SELECTION' ? '' : 'flex justify-center items-center md:p-4'}`}>

      {/* 
         SMART UPDATE HANDLER
         Monitors version.json and forces reload if code is outdated.
         This ensures database config changes are applied immediately.
      */}
      <AutoUpdateHandler />

      {/* GLOBAL BLOCKED USER MODAL */}
      {isUserBlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-8 text-center animate-[popIn_0.3s_ease-out] border border-gray-100 dark:border-gray-700">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-500 mx-auto mb-6">
              <Ban size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Akses Ditolak</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Akun Anda telah dinonaktifkan atau diblokir oleh Administrator. Silahkan hubungi supervisor Anda.
            </p>
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Kembali ke Login</span>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL DAILY QUEST MODAL */}
      {!isUserBlocked && isDailyQuestCompleted === false && (!dailyQuestTargetRoles.length || (currentRole && dailyQuestTargetRoles.includes(currentRole))) && authStep !== 'LOGIN' && authStep !== 'ADMIN_LOGIN' && authStep !== 'ADMIN_DASHBOARD' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-md"></div>
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-8 text-center animate-[popIn_0.3s_ease-out] border border-indigo-100 dark:border-indigo-700">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-500 mx-auto mb-6">
              <Lock size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aplikasi Terkunci</h2>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl mb-6">
               <p className="text-indigo-700 dark:text-indigo-400 font-bold flex items-center justify-center gap-2">
                  <Target size={18} /> Quest: {dailyQuestName}
               </p>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">
              Silahkan selesaikan tugas ini. Jika salah satu perwakilan role Anda sudah menyelesaikannya, aplikasi akan otomatis terbuka untuk semua device.
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsDailyQuestCompleted(true);
                }}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Target size={18} />
                <span>Input / Selesaikan Quest</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Logout Sementara</span>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white dark:bg-gray-950 relative border-gray-200 dark:border-gray-800 flex flex-col ${isAdminDashboard || authStep === 'LOGIN' || authStep === 'ADMIN_LOGIN' || authStep === 'GOD_MODE_SELECTION' || authStep === 'ROLE_SELECTION' ? 'w-full h-full' : 'w-full h-full md:max-w-7xl md:h-[85vh] md:min-h-[550px] md:rounded-[2rem] md:shadow-2xl md:overflow-hidden shadow-black/20 md:border'}`}>

        {authStep === 'LOGIN' && (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onAdminLoginRequest={() => setAuthStep('ADMIN_LOGIN')}
          />
        )}

        {/* Admin Flow */}
        {authStep === 'ADMIN_LOGIN' && (
          <AdminLogin
            onSuccess={handleAdminLoginSuccess}
            onBack={handleLogout}
          />
        )}

        {authStep === 'ADMIN_DASHBOARD' && (
          <AdminDashboard
            permissions={userPermissions}
            pins={userPins}
            manualInputAccess={userManualInputAccess}
            onSave={handleAdminSave}
            onLogout={handleLogout}
            currentAdmin={currentAdmin}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            initialView={initialView}
            profileConfig={profileConfig}
            onSaveProfileConfig={handleSaveProfileConfig}
            onExitToProfile={() => setAuthStep('ROLE_SELECTION')}
          />
        )}

        {/* GOD MODE SELECTION */}
        {authStep === 'GOD_MODE_SELECTION' && (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 md:p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 text-center flex flex-col max-h-[85vh]">
              <div className="shrink-0">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-500 mx-auto mb-4">
                  <Crown size={32} />
                </div>
                <h2 className="text-xl font-bold mb-1">Developer Mode</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-xs">Anda memiliki akses khusus.</p>
              </div>

              <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
                <button
                  onClick={() => handleGodModeSelect(null)}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shrink-0 text-sm"
                >
                  <User size={18} />
                  User Biasa ({userEmail})
                </button>

                <div className="relative shrink-0 py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white dark:bg-gray-800 px-2 text-gray-400">Atau Masuk Sebagai</span></div>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative shrink-0 mb-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Cari user target..."
                    value={godModeSearch}
                    onChange={(e) => setGodModeSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all text-xs"
                  />
                  {godModeSearch && (
                    <button
                      onClick={() => setGodModeSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {Object.keys(userPermissions)
                    .filter(email => email !== userEmail && email.toLowerCase().includes(godModeSearch.toLowerCase()))
                    .map(email => (
                      <button
                        key={email}
                        onClick={() => handleGodModeSelect(email)}
                        className="w-full py-2.5 px-3 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-xl font-medium text-xs text-left transition-colors flex items-center justify-between group shrink-0"
                      >
                        <span className="truncate mr-2">{email}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-amber-200 dark:bg-amber-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">GOD MODE</span>
                      </button>
                    ))}
                  {Object.keys(userPermissions).filter(email => email !== userEmail && email.toLowerCase().includes(godModeSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">User tidak ditemukan.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {(authStep === 'ROLE_SELECTION') && (
          <div className="h-full w-full animate-[fadeIn_0.3s_ease-out] flex-1 min-h-0">
            <RoleSelector
              userEmail={effectiveEmail} // Use effective email (Target or Real)
              onSelectRole={handleRoleSelect}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              onLogout={handleLogout}
              permissions={effectivePermissions}
              profileConfig={profileConfig}
            />
          </div>
        )}

        {/* Name Selection */}
        {authStep === 'NAME_SELECTION' && (
          <NameSelectionModal
            onSelect={handleNameSelect}
            onBack={handleNameBack}
            userEmail={effectiveEmail}
            role={currentRole}
          />
        )}

        {/* PIN Modal Overlay */}
        {authStep === 'PIN_CHECK' && (
          <>
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 blur-md z-0 backdrop-blur-sm"></div>
            <PinModal
              isOpen={true}
              userEmail={userEmail}
              onSuccess={handlePinSuccess}
              onClose={handlePinCancel}
              accentColor={userEmail === 'gudang.user@gmail.com' ? 'purple' : 'blue'}
            />
          </>
        )}

        {/* Main Dashboard */}
        {authStep === 'LOGGED_IN' && currentRole && (
          <div className="h-full w-full animate-[slideUp_0.4s_ease-out] flex-1 min-h-0">
            <Dashboard
              role={currentRole}
              onBack={handleDashboardBack}
              userEmail={effectiveEmail}
              userPin={userPins[effectiveEmail] || userPins[(effectiveEmail || '').toLowerCase().trim()] || '123456'}
              employeeName={employeeName}
              dailyTarget={employeeTarget}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              scanButtonPosition={scanButtonPosition}
              setScanButtonPosition={handleSetScanPosition}
              allowManualInput={userManualInputAccess[(effectiveEmail || '').toLowerCase().trim()] ?? userManualInputAccess[effectiveEmail] ?? false}
              profileConfig={profileConfig}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db; 
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563; 
        }
      `}</style>
    </div>
  );
};

export default App;
