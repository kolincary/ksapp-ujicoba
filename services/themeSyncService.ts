import { supabase } from './supabaseClient';

export type LoginThemeVariant = 'tema_1' | 'tema_2';

export const STORAGE_KEY_LOGIN_THEME = 'kalindo_login_theme';
export const DEFAULT_LOGIN_THEME: LoginThemeVariant = 'tema_1';

/**
 * Get the currently active login theme for this device.
 * Defaults to 'tema_1' (Desain Lama).
 */
export const getActiveLoginTheme = (): LoginThemeVariant => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOGIN_THEME);
    if (saved === 'tema_1' || saved === 'tema_2') {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to read login theme from localStorage', e);
  }
  return DEFAULT_LOGIN_THEME;
};

/**
 * Save user theme preference locally and sync to Supabase cloud.
 * This guarantees the setting follows the user across devices.
 */
export const saveUserLoginTheme = async (
  theme: LoginThemeVariant,
  userEmail?: string,
  employeeName?: string
): Promise<void> => {
  // 1. Immediately persist on the local device
  try {
    localStorage.setItem(STORAGE_KEY_LOGIN_THEME, theme);
    if (userEmail) {
      localStorage.setItem(`${STORAGE_KEY_LOGIN_THEME}_${userEmail.toLowerCase().trim()}`, theme);
    }
    if (employeeName) {
      localStorage.setItem(`${STORAGE_KEY_LOGIN_THEME}_${employeeName.toLowerCase().trim()}`, theme);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kalindo_theme_changed'));
    }
  } catch (e) {
    console.warn('Failed to save login theme to localStorage', e);
  }

  // 2. Sync to Supabase cloud (app_settings table)
  const identifiers = [userEmail, employeeName].filter(Boolean) as string[];
  for (const rawId of identifiers) {
    const idKey = `login_theme:${rawId.toLowerCase().trim()}`;
    try {
      // Check if setting row already exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('setting_key', idKey)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('app_settings')
          .update({ setting_value: theme })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('app_settings')
          .insert({ setting_key: idKey, setting_value: theme });
      }
    } catch (err) {
      console.warn(`Could not sync login theme to Supabase for ${rawId}:`, err);
    }
  }
};

/**
 * Fetch user's saved theme from Supabase and apply it to this device.
 * Called automatically when user logs in or selects their employee name.
 */
export const syncUserLoginThemeFromCloud = async (
  userEmail?: string,
  employeeName?: string
): Promise<LoginThemeVariant | null> => {
  const identifiers = [employeeName, userEmail].filter(Boolean) as string[];

  for (const rawId of identifiers) {
    const idKey = `login_theme:${rawId.toLowerCase().trim()}`;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', idKey)
        .maybeSingle();

      if (!error && data?.setting_value) {
        const cloudTheme = data.setting_value as LoginThemeVariant;
        if (cloudTheme === 'tema_1' || cloudTheme === 'tema_2') {
          // Update device theme with user's cloud preference
          localStorage.setItem(STORAGE_KEY_LOGIN_THEME, cloudTheme);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('kalindo_theme_changed'));
          }
          return cloudTheme;
        }
      }
    } catch (err) {
      console.warn(`Error fetching cloud login theme for ${rawId}:`, err);
    }
  }

  return null;
};

