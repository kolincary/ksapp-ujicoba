import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VPS_URL, VPS_KEY } from './supabaseClient';

// Konfigurasi Database Supabase KHUSUS Modul Sinkronisasi Ginee OMS & Outbound
// Di project 'kalindo scan server ujicoba', sinkronisasi diarahkan langsung ke VPS Supabase mandiri
export const GINEE_SUPABASE_URL = 
  (import.meta as any).env?.VITE_GINEE_SUPABASE_URL || 
  VPS_URL;

export const GINEE_SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_GINEE_SUPABASE_ANON_KEY || 
  VPS_KEY;

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
    return { success: true, message: 'Terhubung ke VPS Supabase Ginee (' + GINEE_SUPABASE_URL + ').' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke Supabase Ginee' };
  }
}
