-- FIX: Drop the OLD conflicting index identified by the user
-- This index 'idx_unique_scans_daily_v2' was enforcing strict duplicate checks
-- without considering the new 'menu_context' (Gudang Profile Scope).

DROP INDEX IF EXISTS idx_unique_scans_daily_v2;

-- The new index 'unique_scan_per_day_role_menu' is ALREADY there and correct.
-- So we only need to remove the old blocker.
