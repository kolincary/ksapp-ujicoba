export enum UserRole {
  PICKER = 'PICKER',
  PICKER_2 = 'PICKER_2',
  SORTIR = 'SORTIR',
  SORTIR_BATCH = 'SORTIR_BATCH',
  PACKING = 'PACKING',
  PACKING_2 = 'PACKING_2',
  GUDANG = 'GUDANG',
  OJOL = 'OJOL',
  LEADER = 'LEADER',
  CHECKER = 'CHECKER',
  ADMIN = 'ADMIN'
}

export interface ScannedItem {
  id: string;
  timestamp: number;
  barcode: string;
  role: UserRole | string; // Allow dynamic strings
  // Fields populated by AI or simulated database lookup
  destination?: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  description?: string;
  status: 'PENDING' | 'COMPLETED' | 'ERROR';
  employee_name?: string;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC'; // New field for offline support
  menu_context?: string; // New field for database-level validasi duplikat (GUDANG SCOPE)
  scan_mode?: 'INDIVIDU' | 'TIM';
  team_members?: string[];
  excel_filename?: string;
  report_keterangan?: string;
  report_msku?: string;
  report_qty?: string;
  order_id?: string; // New field for ID Pesanan
}

export interface FailedItem extends ScannedItem {
  failReason: 'DUPLICATE' | 'FORBIDDEN' | 'NETWORK' | 'OTHER';
  failMessage: string;
}

export interface ScanResult {
  barcode: string;
  destination: string;
  description: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface AdminUser {
  id: number;
  username: string;
  password?: string; // Optional when fetching for display
  permissions: string[]; // Array of permission IDs e.g., ['manage_pins', 'view_dashboard']
  created_at?: string;
  last_login?: string;
}

export interface Employee {
  id: number;
  name: string;
  active: boolean;
  allowed_roles?: string[];
  shift?: string | null; // Relaxed from hardcoded union type
  daily_target?: number; // Added daily target field
  pin?: string | null; // Added personal PIN
}

export type UserPermissions = Record<string, (UserRole | string)[]>;
export type UserPins = Record<string, string>;
export type UserBlockedStatus = Record<string, boolean>; // New type for blocking
export type UserManualInputAccess = Record<string, boolean>; // New type for manual input lock

export type AuthStep = 'LOADING' | 'LOGIN' | 'PIN_CHECK' | 'GOD_MODE_SELECTION' | 'ROLE_SELECTION' | 'NAME_SELECTION' | 'LOGGED_IN' | 'ADMIN_LOGIN' | 'ADMIN_DASHBOARD';

export type AdminView = 'DASHBOARD' | 'PINS' | 'ACCESS' | 'EMPLOYEES' | 'ADMIN_MANAGEMENT' | 'PACKING_DATA' | 'PACKING_2_DATA' | 'SORTIR_DATA' | 'PICKER_DATA' | 'PICKER_2_DATA' | 'LEADER_2_DATA' | 'LEADER_PENDING_ADMIN' | 'CHECKER_DATA' | 'LOGISTIK_DATA' | 'GUDANG_PENDING' | 'GUDANG_READY' | 'GUDANG_REPORT' | 'GUDANG_BUNDLING' | 'GUDANG_CANCEL' | 'OJOL_DATA' | 'SYMBOLS' | 'SEARCH_ALL' | 'SEARCH_OLD' | 'SEARCH_NEW' | 'SCAN_ALL' | 'FAILED_SCANS' | 'CHECK_INVOICE' | 'FAKE_REPORT' | 'CANCEL_DATA' | 'COMPARE_LOGISTIK' | 'COMPARE_PACKING_PICKER' | 'EXPORT_DATA' | 'BATCH_DATA' | 'BATCH_DATA_2' | 'USER_MONITORING' | 'SUPABASE_CONFIG' | 'SETTINGS' | 'PROFILE_CONFIG' | 'BATCH_SORTIR_DATA' | 'ADMIN_DATA' | 'SKU_DATA' | 'SPECIAL_SCAN' | 'SEARCH_ALL_FIRESTORE' | 'FIRESTORE_MANAGER' | 'SUPABASE_MANAGER' | 'RUNNING_TEXT_MANAGER' | 'TRACK_RESI' | 'ADMIN_NOTES' | 'INJECT_EXPIRED_RESI' | 'PRINT_FORMS' | 'ADMIN_BATCH_IMPORTS' | 'MENU_VISIBILITY' | 'RESI_FORMATTER' | 'PESANAN_90_HARI' | 'SCAN_DAN_KIRIM';

export interface AdminShiftNoteRead {
  user_email: string;
  user_name: string;
  read_at: number;
}

export interface AdminShiftNote {
  id: string;
  title: string;
  content: string;
  priority: 'URGENT' | 'SHIFT_HANDOVER' | 'INFO';
  created_by: string;
  created_at: number;
  is_active: boolean;
  target_role?: string;
  read_by?: AdminShiftNoteRead[];
}

// Added theme props to interface
export interface AdminDashboardProps {
  permissions: UserPermissions;
  pins: UserPins;
  manualInputAccess: UserManualInputAccess; // Added prop
  onSave: (newPermissions: UserPermissions, newPins: UserPins, newManualAccess?: UserManualInputAccess) => void;
  onLogout: () => void;
  currentAdmin: AdminUser | null;
  isDarkMode: boolean;
  toggleTheme: () => void;
  initialView?: AdminView; // Added initialView prop
  profileConfig?: ProfileConfig[]; // New prop for profile configuration
  onSaveProfileConfig?: (newConfig: ProfileConfig[]) => void;
  onExitToProfile?: () => void;
}

export interface ProfileConfig {
  id?: number;
  role: string;
  is_active: boolean;
  sort_order: number;
  use_page_modal?: boolean;
}
