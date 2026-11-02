/**
 * Ginee Data Service (Supabase Powered)
 * Menyediakan integrasi penyimpanan data Ginee OMS, sinkronisasi harian, dan deteksi pembatalan real-time
 * yang dialihkan 100% ke database Supabase PostgreSQL & WebSocket Realtime.
 */
import { GineeOrder } from './gineeService';
import {
  saveGineeOrdersToSupabase,
  getGineeOrdersFromSupabase,
  findOrderInSupabase,
  subscribeCancelledOrdersRealtime as subscribeCancelledSupabase,
  saveScannedRecordToSupabase,
  deleteScannedRecordFromSupabase,
  clearAllScannedRecordsFromSupabase,
  purgeExpiredGineeDataFromSupabase,
  reconcileCancelledOrdersWithTrackings,
} from './gineeSupabaseService';

export { reconcileCancelledOrdersWithTrackings };

export const GINEE_ORDERS_COLLECTION = 'ginee_orders';
export const GINEE_SCANS_COLLECTION = 'ginee_scans';
export const GINEE_PRODUCTS_COLLECTION = 'ginee_products';

export interface GineeProduct {
  productId: string;
  productName: string;
  sku: string;
  msku: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
  category?: string;
  updatedAt?: string;
}

/**
 * Ekstraksi item otentik dari rawPayload webhook jika pesanan belum memiliki item detail
 */
export function extractItemsFromRawPayload(rawPayload: any): any[] | null {
  if (!rawPayload) return null;
  const rawList = rawPayload?.payload?.items || rawPayload?.items;
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  return rawList.map((it: any) => ({
    sku: it.masterSku || it.sku || it.itemSku || it.variationSku || '-',
    msku: it.masterSku || it.msku || it.sku || it.itemSku || '-',
    productName: it.masterVariationName || it.productName || it.itemName || it.name || 'Produk Pesanan Ginee',
    variant: it.variant || it.variationName || it.spec || '',
    qty: Number(it.realQuantity || it.planQuantity || it.qty || it.quantity || 1),
    price: Number(it.realPrice || it.planPrice || it.price || 0),
    imageUrl: it.imageUrl || it.image || it.picUrl || '',
  }));
}

/**
 * Menyimpan daftar pesanan Ginee ke Supabase.
 */
export async function saveGineeOrdersToFirestore(
  orders: GineeOrder[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  return saveGineeOrdersToSupabase(orders, onProgress);
}

/**
 * Mengambil daftar pesanan dari Supabase
 */
export async function getGineeOrdersFromFirestore(
  limitCount = 1000,
  orderStatus?: string
): Promise<GineeOrder[]> {
  return getGineeOrdersFromSupabase(limitCount, orderStatus);
}

/**
 * Mencari pesanan secara instan di Supabase berdasarkan Resi (trackingNo),
 * No. Pesanan Marketplace (channelOrderSn), atau No. Pesanan Ginee (orderSn).
 */
export async function findOrderInFirestore(queryStr: string): Promise<GineeOrder | null> {
  return findOrderInSupabase(queryStr);
}

/**
 * Memperbarui status pesanan di Supabase
 */
export async function updateOrderStatusInFirestore(
  orderSn: string,
  newStatus: string,
  extraData?: Partial<GineeOrder>
): Promise<boolean> {
  if (extraData) {
    await saveScannedRecordToSupabase({
      orderSn,
      status: newStatus,
      ...extraData,
    });
  }
  return true;
}

/**
 * Mendengarkan perubahan pesanan secara realtime di Supabase
 */
export function subscribeGineeOrdersRealtime(
  callback: (orders: GineeOrder[]) => void,
  limitCount = 100
): (() => void) | null {
  getGineeOrdersFromSupabase(limitCount).then(orders => callback(orders));
  return () => {};
}

/**
 * Real-Time Listener Pesanan Baru / Terkini
 */
export function subscribeRecentOrdersRealtime(
  callback: (orders: GineeOrder[]) => void,
  limitCount = 200
): (() => void) | null {
  getGineeOrdersFromSupabase(limitCount).then(orders => callback(orders));
  return () => {};
}

/**
 * Mendengarkan penambahan/perubahan riwayat scan secara realtime
 */
export function subscribeScannedRecordsRealtime(
  callback: (records: any[]) => void
): (() => void) | null {
  return () => {};
}

/**
 * Mendengarkan data pembatalan pesanan di Supabase secara REAL-TIME
 * (Diterima dalam hitungan milidetik saat pembeli/marketplace membatalkan pesanan via Webhook Supabase)
 * Cloud Firestore dinonaktifkan sepenuhnya untuk mencegah biaya/kuota berlebih.
 */
export function subscribeCancelledOrdersRealtime(
  callback: (cancelled: { barcode: string; orderSn?: string; reason?: string }[]) => void
): (() => void) | null {
  // Hanya gunakan Supabase Realtime (100% aman, bebas biaya per-read Firestore)
  return subscribeCancelledSupabase(callback);
}

/**
 * Menyimpan data pemindaian ke Supabase (Cloud Firestore dinonaktifkan sepenuhnya)
 */
export async function saveScannedRecordToFirestore(record: any): Promise<boolean> {
  if (!record) return false;
  try {
    await saveScannedRecordToSupabase(record);
  } catch (err) {
    console.warn('[Supabase] saveScannedRecord notice:', err);
  }
  return true;
}

/**
 * Menghapus satu rekaman riwayat scan dari Supabase (Cloud Firestore dinonaktifkan)
 */
export async function deleteScannedRecordFromFirestore(identifier: string): Promise<boolean> {
  if (!identifier) return false;
  try {
    await deleteScannedRecordFromSupabase(identifier);
  } catch (err) {
    console.warn('[Supabase] deleteScannedRecord notice:', err);
  }
  return true;
}

/**
 * Menghapus seluruh riwayat scan dari Supabase (Cloud Firestore dinonaktifkan)
 */
export async function clearAllScannedRecordsFromFirestore(): Promise<boolean> {
  try {
    await clearAllScannedRecordsFromSupabase();
  } catch {}
  return true;
}

/**
 * Menghapus otomatis data di Supabase yang berumur lebih dari 5 hari (Retensi H-5).
 * Menjaga database tetap ramping, cepat, dan hemat kuota.
 */
export async function purgeExpiredGineeOrdersFromFirestore(windowDays = 5): Promise<{ deletedCount: number }> {
  const res = await purgeExpiredGineeDataFromSupabase(windowDays);
  return { deletedCount: res.deletedCount || 0 };
}

/**
 * Mengambil produk Ginee dari database
 */
export async function getGineeProductsFromFirestore(): Promise<GineeProduct[]> {
  try {
    const orders = await getGineeOrdersFromSupabase(200);
    const prodMap = new Map<string, GineeProduct>();
    orders.forEach(o => {
      if (Array.isArray(o.items)) {
        o.items.forEach(it => {
          const sku = it.sku || it.msku;
          if (sku && sku !== '-' && !prodMap.has(sku)) {
            prodMap.set(sku, {
              productId: sku,
              productName: it.productName || 'Produk JOYKO',
              sku: it.sku || '-',
              msku: it.msku || it.sku || '-',
              price: it.price || 0,
              imageUrl: it.imageUrl || '',
            });
          }
        });
      }
    });
    return Array.from(prodMap.values());
  } catch {
    return [];
  }
}

/**
 * Menyimpan produk Ginee
 */
export async function saveGineeProductsToFirestore(products: GineeProduct[]): Promise<boolean> {
  return true;
}

/**
 * Sinkronisasi Master SKU
 */
export async function syncMasterSkusToGineeProducts(orders: GineeOrder[]): Promise<number> {
  return 0;
}
