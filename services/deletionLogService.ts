import { supabase } from './supabaseClient';

export interface DeletionLogPayload {
  deleted_by: string;
  user_role?: string;
  menu_name: string;
  tab_name: string;
  item_count: number;
  target_summary?: string;
  deleted_data?: any;
  client_info?: string;
}

/**
 * Mencatat riwayat penghapusan data secara terpusat ke tabel Supabase `deletion_logs`.
 * Dilengkapi dengan fallback penyimpanan lokal (localStorage) agar log tidak pernah hilang
 * meskipun terjadi kendala jaringan saat penghapusan dilakukan.
 */
export async function logDeletionAction(payload: DeletionLogPayload): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  const clientInfo = payload.client_info || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Device');

  const logRecord = {
    deleted_at: timestamp,
    deleted_by: (payload.deleted_by || 'Unknown Staff').trim(),
    user_role: (payload.user_role || 'staff').trim(),
    menu_name: payload.menu_name || 'Batch Management',
    tab_name: payload.tab_name || 'Ringkasan Progress',
    item_count: Math.max(1, payload.item_count || 1),
    target_summary: (payload.target_summary || '').slice(0, 1000), // Batas aman string summary
    deleted_data: payload.deleted_data || [],
    client_info: clientInfo
  };

  // 1. Simpan backup cadangan ke localStorage
  try {
    const existingBackupStr = localStorage.getItem('app_deletion_logs_backup');
    const existingBackup: any[] = existingBackupStr ? JSON.parse(existingBackupStr) : [];
    // Simpan hingga 100 log riwayat terakhir
    existingBackup.unshift({ ...logRecord, local_logged_at: timestamp });
    if (existingBackup.length > 100) existingBackup.length = 100;
    localStorage.setItem('app_deletion_logs_backup', JSON.stringify(existingBackup));
  } catch (localErr) {
    console.warn('[DeletionLog] Local backup warning:', localErr);
  }

  // 2. Simpan ke database Supabase
  try {
    const { error } = await supabase
      .from('deletion_logs')
      .insert([logRecord]);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('not find the table')) {
        console.warn('[DeletionLog] Tabel deletion_logs belum dibuat di Supabase aktif. Harap jalankan create_deletion_logs_table.sql.');
      } else {
        console.warn('[DeletionLog] Warning simpan deletion_logs ke Supabase:', error.message);
      }
      return { success: false, error: error.message };
    }

    console.log(`[DeletionLog] ✓ Berhasil mencatat log hapus: ${logRecord.deleted_by} menghapus ${logRecord.item_count} data di [${logRecord.menu_name} > ${logRecord.tab_name}].`);
    return { success: true };
  } catch (err: any) {
    console.error('[DeletionLog] Exception saat simpan log hapus:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan log' };
  }
}
