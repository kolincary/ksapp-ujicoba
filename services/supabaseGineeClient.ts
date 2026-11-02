import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Konfigurasi Database Supabase KHUSUS Modul Sinkronisasi Ginee OMS & Outbound
// Database ini terisolasi agar database operasional utama Kalindo Scan tidak terganggu
export const GINEE_SUPABASE_URL = 
  (import.meta as any).env?.VITE_GINEE_SUPABASE_URL || 
  'https://plltdvaxzxwsdtxlwnkf.supabase.co';

export const GINEE_SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_GINEE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbHRkdmF4enh3c2R0eGx3bmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4ODAwMjUsImV4cCI6MjEwODQ1NjAyNX0.WM46Ndn5RJOl7n9OUhOfB7gKC4oIdNsZzwMaynTpXKI';

/**
 * Client Supabase terdedikasi untuk Ginee OMS (Orders, Cancellations, Outbound & Retensi 5 Hari)
 */
export const gineeSupabase: SupabaseClient = createClient(
  GINEE_SUPABASE_URL,
  GINEE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Helper untuk memeriksa status koneksi ke Supabase Ginee
 */
export async function testGineeSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await gineeSupabase.from('ginee_orders').select('order_sn').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Terhubung ke Supabase Ginee terdedikasi (plltdvaxzxwsdtxlwnkf).' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke Supabase Ginee' };
  }
}
