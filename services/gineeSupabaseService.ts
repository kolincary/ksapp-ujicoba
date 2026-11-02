import { gineeSupabase as supabase } from './supabaseGineeClient';
import { supabase as mainSupabase } from './supabaseClient';
import { GineeOrder } from './gineeService';
import { isGineeSyncEnabled } from './gineeGlobalSyncService';

export const GINEE_ORDERS_TABLE = 'ginee_orders';
export const GINEE_CANCELLATIONS_TABLE = 'cancelled_orders';

/**
 * Helper aman untuk parsing tanggal ISO (mencegah RangeError: Invalid time value jika nilai dari Ginee '-')
 */
function safeIsoDate(val: any): string | null {
  if (!val || val === '-' || val === '0' || val === 'null' || val === 'undefined') return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalisasi status pesanan Ginee agar konsisten
 */
function normalizeOrderStatus(rawStatus: string): string {
  const st = String(rawStatus || '').toUpperCase().trim();

  // 1. Prioritaskan status aktif / pengiriman - TIDAK BOLEH dianggap batal
  if (st.includes('READY') || st === 'SIAP_DIKIRIM' || st === 'TO_SHIP' || st === 'WAIT_SELLER_SEND' || st === 'PROCESSED' || st === 'PACKED') {
    return 'READY_TO_SHIP';
  }
  if (st.includes('SHIP') || st === 'DIKIRIM' || st === 'SHIPPED') {
    return 'SHIPPED';
  }
  if (st.includes('DELIVER') || st === 'SELESAI' || st === 'COMPLETED') {
    return 'DELIVERED';
  }
  if (st.includes('PAID') || st === 'LUNAS') {
    return 'PAID';
  }
  if (st.includes('UNPAID') || st === 'BELUM_BAYAR') {
    return 'UNPAID';
  }

  // 2. Status pembatalan resmi
  if (st === 'CANCELLED' || st === 'CANCELED' || st.includes('BATAL') || st.includes('DIBATALKAN') || st.includes('BUYER_CANCEL')) {
    return 'CANCELLED';
  }

  return rawStatus || 'PENDING';
}

/**
 * Deteksi status pembatalan mendalam:
 * HANYA mengembalikan true jika pesanan benar-benar dibatalkan secara sah di Ginee/Marketplace.
 * Pesanan yang aktif, diproses, siap kirim, atau sudah dikirim TIDAK AKAN PERNAH dianggap batal.
 */
export function isOrderCancelled(order: GineeOrder | any): boolean {
  if (!order) return false;
  const rawStatus = String(order.orderStatus || order.status || '').toUpperCase().trim();

  // 0. KHUSUS: Pesanan dengan pengajuan pembatalan (misal "Siap Dikirim / Sedang Dibatalkan", "IN_CANCEL", "APPLY_CANCEL")
  // Jika staf admin belum ACC atau menolak pembatalan, pesanan TETAP SIAP DIKIRIM dan TIDAK BOLEH dianggap batal!
  if (
    rawStatus.includes('SIAP DIKIRIM') ||
    rawStatus.includes('SIAP_DIKIRIM') ||
    rawStatus.includes('SEDANG DIBATALKAN') ||
    rawStatus.includes('SEDANG_DIBATALKAN') ||
    rawStatus.includes('IN_CANCEL') ||
    rawStatus.includes('APPLY_CANCEL') ||
    rawStatus.includes('CANCEL_PENDING') ||
    rawStatus.includes('CANCEL_REQUEST')
  ) {
    return false;
  }

  // 1. GUARD KETAT: Jika status aktif / dalam proses kirim, MUTLAK BUKAN BATAL
  if (
    ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'PROCESSED', 'PAID', 'COMPLETED', 'FINISHED', 'SUCCESS', 'SIAP_DIKIRIM', 'DIKIRIM', 'SELESAI', 'UNPAID'].includes(rawStatus) ||
    rawStatus.includes('READY') ||
    rawStatus.includes('SHIP') ||
    rawStatus.includes('DELIVER') ||
    rawStatus.includes('PROCESS') ||
    rawStatus.includes('PACK') ||
    rawStatus.includes('SIAP') ||
    rawStatus.includes('KIRIM')
  ) {
    return false;
  }

  // 2. Deteksi status utama pembatalan resmi
  if (
    rawStatus === 'CANCELLED' ||
    rawStatus === 'CANCELED' ||
    rawStatus.includes('BATAL') ||
    rawStatus.includes('DIBATALKAN')
  ) {
    return true;
  }

  // 3. Fallback ke payload eksternal HANYA jika rawStatus kosong / belum terdefinisi
  const raw = order.rawPayload || order.payload || order;
  if (raw && !rawStatus) {
    const extStatus = String(raw.externalOrderStatus || raw.subOrderStatus || '').toUpperCase().trim();
    if (extStatus.includes('SEDANG') || extStatus.includes('IN_CANCEL') || extStatus.includes('APPLY')) {
      return false;
    }
    if (extStatus === 'CANCELLED' || extStatus === 'CANCELED' || extStatus.includes('BATAL') || extStatus.includes('DIBATALKAN')) {
      return true;
    }
  }

  return false;
}

/**
 * Menyimpan daftar pesanan Ginee ke Supabase (ginee_orders dan cancelled_orders).
 * Memiliki proteksi batching, auto-detection status batal, dan pengamanan nomor resi (AWB)
 * agar pesanan yang sudah dicetak dan memiliki AWB tetap tersinkronisasi 100% ke cancelled_orders.
 */
export async function saveGineeOrdersToSupabase(
  orders: GineeOrder[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!supabase) {
    return { success: false, count: 0, error: 'Koneksi database Supabase belum diinisialisasi.' };
  }
  if (!orders || orders.length === 0) {
    return { success: true, count: 0 };
  }

  const BATCH_SIZE = 100;
  let totalSaved = 0;
  let gineeOrdersTableExists = true;

  try {
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const chunk = orders.slice(i, i + BATCH_SIZE);

      // 0. Pra-pengecekan: Ambil nomor resi kurir (AWB) yang sudah ada di database ginee_orders
      // Hal ini SANGAT KRUSIAL: pesanan yang sudah dicetak dan memiliki resi, jika dibatalkan oleh pembeli,
      // API Ginee OMS sering kali tidak mengembalikan trackingNo di payload batal.
      // Kita pertahankan AWB dari database agar resi cetak kurir TIDAK HILANG / TIDAK TERTUTUP NULL!
      const chunkOrderIds = chunk.map(o => (o.orderSn || '').trim().toUpperCase()).filter(Boolean);
      const chunkChannelSns = chunk.map(o => (o.channelOrderSn || '').trim().toUpperCase()).filter(Boolean);
      const existingTrackingMap = new Map<string, string>();

      if (gineeOrdersTableExists && (chunkOrderIds.length > 0 || chunkChannelSns.length > 0)) {
        try {
          const uniqueIds = Array.from(new Set(chunkOrderIds));
          // Query per 100 ID
          for (let q = 0; q < uniqueIds.length; q += 80) {
            const subIds = uniqueIds.slice(q, q + 80);
            const { data: dbRows } = await supabase
              .from(GINEE_ORDERS_TABLE)
              .select('order_id, channel_order_sn, tracking_no')
              .in('order_id', subIds);

            if (Array.isArray(dbRows)) {
              dbRows.forEach((r: any) => {
                const trk = (r.tracking_no || '').trim().toUpperCase();
                if (trk && trk !== '-') {
                  if (r.order_id) existingTrackingMap.set(r.order_id.toUpperCase(), trk);
                  if (r.channel_order_sn) existingTrackingMap.set(r.channel_order_sn.toUpperCase(), trk);
                }
              });
            }
          }
        } catch (err) {
          console.warn('[Supabase Ginee] Warning lookup existing trackings:', err);
        }
      }

      const orderRows: any[] = [];
      const cancelRows: any[] = [];
      const activeBarcodesToClean: string[] = [];

      for (const order of chunk) {
        if (!order || !order.orderSn) continue;

        const cleanChannelSn = (order.channelOrderSn || '').trim().toUpperCase();
        const cleanOrderSn = (order.orderSn || '').trim().toUpperCase();

        // 1. Tentukan nomor resi kurir (AWB): prioritaskan payload baru, lalu fallback ke database lama
        let cleanTracking = (order.trackingNo && order.trackingNo !== '-' ? order.trackingNo : '').trim().toUpperCase();
        if (!cleanTracking) {
          const fromDb = existingTrackingMap.get(cleanOrderSn) || (cleanChannelSn ? existingTrackingMap.get(cleanChannelSn) : null);
          if (fromDb && fromDb !== '-') {
            cleanTracking = fromDb;
          }
        }

        const isCancelled = isOrderCancelled(order);
        const normalizedSt = isCancelled ? 'CANCELLED' : normalizeOrderStatus(order.orderStatus);

        const safeCreatedTime = safeIsoDate(order.orderTime) || new Date().toISOString();
        const safePayTime = safeIsoDate(order.payTime);
        const safeShipByTime = safeIsoDate(order.shipByTime);

        // Siapkan baris pesanan untuk ginee_orders (Tracking number TIDAK BOLEH menjadi null jika sudah pernah ada resi)
        const orderRow: any = {
          order_id: cleanOrderSn,
          channel_order_sn: cleanChannelSn || null,
          ...(cleanTracking && cleanTracking !== '-' ? { tracking_no: cleanTracking } : {}),
          status: normalizedSt,
          channel: order.channel || null,
          shop_name: order.shopName || null,
          created_at_ginee: safeCreatedTime,
          payment_time: safePayTime,
          ship_by_date: safeShipByTime,
          courier: order.logisticsProvider || null,
          recipient_name: order.recipientName || null,
          recipient_phone: order.recipientPhone || null,
          recipient_address: order.recipientAddress || null,
          total_amount: Number(order.totalAmount || 0),
          currency: order.currency || 'IDR',
          buyer_note: order.note || null,
          outbound_no: order.outboundNo || null,
          warehouse_name: order.warehouseName || null,
          items: Array.isArray(order.items) ? order.items : [],
          raw_payload: (order as any).rawPayload || null,
          updated_at: new Date().toISOString(),
        };

        orderRows.push(orderRow);

        // 2. Jika status Batal, masukkan ke daftar cancelRows untuk cancelled_orders
        // MENCATAT BAIK RESI KURIR (AWB) MAUPUN NO PESANAN TOKO MARKETPLACE!
        if (normalizedSt === 'CANCELLED') {
          const cancelReason =
            order.note ||
            (order as any).rawPayload?.cancelReason ||
            (order as any).rawPayload?.reason ||
            'Dibatalkan di Marketplace / Ginee OMS';

          // Kumpulkan seluruh kandidat AWB unik
          const trackingCandidates = new Set<string>();
          if (cleanTracking && cleanTracking !== '-') {
            trackingCandidates.add(cleanTracking);
          }
          if (Array.isArray(order.allTrackingNos)) {
            for (const t of order.allTrackingNos) {
              const cleanT = String(t || '').trim().toUpperCase();
              if (cleanT && cleanT !== '-') {
                trackingCandidates.add(cleanT);
              }
            }
          }

          const primaryTracking = cleanTracking || (trackingCandidates.size > 0 ? Array.from(trackingCandidates)[0] : null);

          // A. Simpan Seluruh Nomor Resi Kurir (AWB) — INI YANG DI-SCAN OLEH OPERATOR SAAT MENCETAK LABEL PENGIRIMAN
          for (const awb of trackingCandidates) {
            cancelRows.push({
              barcode: awb,
              tracking_no: awb,
              order_sn: cleanOrderSn,
              channel_order_sn: cleanChannelSn || null,
              cancelled_at: safeCreatedTime,
              cancelled_by: 'Ginee Sync Supabase',
              reason: cancelReason,
              shop_name: order.shopName || null,
              channel: order.channel || null,
              is_active: true,
            });
          }

          // B. Simpan No. Pesanan Toko Marketplace (Shopee, TikTok, Lazada, dll)
          if (cleanChannelSn && !cleanChannelSn.startsWith('SO') && !trackingCandidates.has(cleanChannelSn)) {
            cancelRows.push({
              barcode: cleanChannelSn,
              tracking_no: primaryTracking || null,
              order_sn: cleanOrderSn,
              channel_order_sn: cleanChannelSn,
              cancelled_at: safeCreatedTime,
              cancelled_by: 'Ginee Sync Supabase',
              reason: cancelReason,
              shop_name: order.shopName || null,
              channel: order.channel || null,
              is_active: true,
            });
          }

          // C. Simpan ID Pesanan Internal Ginee jika belum memiliki resi dan berbeda dari no toko
          if (cleanOrderSn && trackingCandidates.size === 0 && cleanOrderSn !== cleanChannelSn) {
            cancelRows.push({
              barcode: cleanOrderSn,
              tracking_no: null,
              order_sn: cleanOrderSn,
              channel_order_sn: cleanChannelSn || null,
              cancelled_at: safeCreatedTime,
              cancelled_by: 'Ginee Sync Supabase',
              reason: cancelReason,
              shop_name: order.shopName || null,
              channel: order.channel || null,
              is_active: true,
            });
          }
        } else {
          // 3. Pesanan AKTIF / SIAP KIRIM / SELESAI: Kumpulkan barcode untuk pembersihan otomatis dari cancelled_orders
          if (cleanTracking && cleanTracking !== '-') {
            activeBarcodesToClean.push(cleanTracking);
          }
          if (cleanChannelSn && !cleanChannelSn.startsWith('SO')) {
            activeBarcodesToClean.push(cleanChannelSn);
          }
          if (cleanOrderSn) {
            activeBarcodesToClean.push(cleanOrderSn);
          }
          if (Array.isArray(order.allTrackingNos)) {
            for (const t of order.allTrackingNos) {
              const cleanT = String(t || '').trim().toUpperCase();
              if (cleanT && cleanT !== '-') activeBarcodesToClean.push(cleanT);
            }
          }
        }
      }

      // 1. Simpan ke ginee_orders (jika tabel sudah dibuat di Supabase)
      if (gineeOrdersTableExists && orderRows.length > 0) {
        let { error: orderErr } = await supabase
          .from(GINEE_ORDERS_TABLE)
          .upsert(orderRows, { onConflict: 'order_id' });

        if (orderErr) {
          if (orderErr.code === 'PGRST205' || String(orderErr.message).includes('not find the table')) {
            gineeOrdersTableExists = false;
            console.warn('[Supabase Ginee] Catatan: Tabel ginee_orders belum dibuat di SQL Editor Supabase. Mengalihkan fokus ke cancelled_orders.');
          } else if (String(orderErr.message).includes("'items' column")) {
            // Fallback: Jika tabel ginee_orders ada namun kolom 'items' belum ditambahkan via ALTER TABLE
            console.warn('[Supabase Ginee] Kolom items belum ditambahkan di database. Menyimpan tanpa kolom items...');
            const strippedRows = orderRows.map(r => {
              const copy = { ...r };
              delete copy.items;
              return copy;
            });
            const { error: retryErr } = await supabase
              .from(GINEE_ORDERS_TABLE)
              .upsert(strippedRows, { onConflict: 'order_id' });
            if (retryErr) {
              console.warn('[Supabase Ginee] Warning upsert ginee_orders (fallback):', retryErr.message);
            }
          } else {
            console.warn('[Supabase Ginee] Warning upsert ginee_orders:', orderErr.message);
          }
        }
      }

      // 2. Simpan pembatalan ke cancelled_orders (PENTING untuk proteksi scan)
      if (cancelRows.length > 0) {
        // Dedup cancelRows by barcode
        const uniqueCancelMap = new Map<string, any>();
        cancelRows.forEach(cr => uniqueCancelMap.set(cr.barcode, cr));
        const uniqueCancels = Array.from(uniqueCancelMap.values());

        const { error: cancelErr } = await supabase
          .from(GINEE_CANCELLATIONS_TABLE)
          .upsert(uniqueCancels, { onConflict: 'barcode' });

        if (cancelErr) {
          if (cancelErr.code === 'PGRST205' || String(cancelErr.message).includes('not find the table')) {
            if (i === 0) {
              console.warn('[Supabase Ginee] Tabel cancelled_orders belum dibuat di Supabase (plltdvaxzxwsdtxlwnkf). Harap jalankan script supabase_ginee_schema.sql.');
            }
          } else {
            console.warn('[Supabase Ginee] Warning upsert cancelled_orders:', cancelErr.message);
          }
        }
      }

      // 3. Bersihkan nomor resi/pesanan aktif dari cancelled_orders jika sebelumnya sempat tercatat batal
      if (activeBarcodesToClean.length > 0) {
        try {
          const uniqueActives = Array.from(new Set(activeBarcodesToClean));
          for (let a = 0; a < uniqueActives.length; a += 100) {
            const subActives = uniqueActives.slice(a, a + 100);
            await supabase
              .from(GINEE_CANCELLATIONS_TABLE)
              .delete()
              .in('barcode', subActives);
          }
        } catch (cleanErr) {
          console.warn('[Supabase Ginee] Warning auto-clean active orders from cancelled_orders:', cleanErr);
        }
      }

      totalSaved += chunk.length;
      if (onProgress) {
        onProgress(totalSaved, orders.length);
      }
    }

    return { success: true, count: totalSaved };
  } catch (err: any) {
    console.error('[Supabase] Gagal menyimpan pesanan ke Supabase:', err);
    return { success: false, count: totalSaved, error: err.message || 'Error simpan Supabase' };
  }
}

/**
 * Mengambil daftar pesanan dari Supabase ginee_orders
 */
export async function getGineeOrdersFromSupabase(
  limitCount = 1000,
  orderStatus?: string
): Promise<GineeOrder[]> {
  if (!supabase) return [];
  try {
    let q = supabase
      .from(GINEE_ORDERS_TABLE)
      .select('*')
      .order('created_at_ginee', { ascending: false })
      .limit(limitCount);

    if (orderStatus && orderStatus !== 'ALL') {
      q = q.eq('status', orderStatus);
    }

    const { data, error } = await q;
    if (error) {
      console.warn('[Supabase] getGineeOrdersFromSupabase notice:', error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row: any) => ({
      orderSn: row.order_id,
      channelOrderSn: row.channel_order_sn || row.order_id,
      orderStatus: row.status,
      channel: row.channel || 'Marketplace',
      shopName: row.shop_name || 'Toko',
      paymentStatus: 'PAID',
      orderTime: row.created_at_ginee || row.created_at,
      payTime: row.payment_time || '',
      shipByTime: row.ship_by_date || '',
      trackingNo: row.tracking_no || '-',
      logisticsProvider: row.courier || '-',
      totalAmount: Number(row.total_amount || 0),
      currency: row.currency || 'IDR',
      items: Array.isArray(row.items) ? row.items : [],
      note: row.buyer_note || '',
      recipientName: row.recipient_name || '',
      recipientPhone: row.recipient_phone || '',
      recipientAddress: row.recipient_address || '',
      outboundNo: row.outbound_no || undefined,
      warehouseName: row.warehouse_name || undefined,
      rawPayload: row.raw_payload || undefined,
    }));
  } catch (err) {
    console.warn('[Supabase] getGineeOrdersFromSupabase error:', err);
    return [];
  }
}

/**
 * Mencari pesanan secara instan di Supabase berdasarkan Resi (trackingNo),
 * No. Pesanan Marketplace (channelOrderSn), atau No. Pesanan Ginee (orderSn).
 */
export async function findOrderInSupabase(queryStr: string): Promise<GineeOrder | null> {
  if (!supabase) return null;
  const clean = (queryStr || '').trim().toUpperCase();
  if (!clean) return null;
  const stripped = clean.replace(/[\s\-_/]/g, '');

  try {
    // 1. Coba cari di ginee_orders berdasarkan Resi (tracking_no), No. Pesanan Toko, Order ID Ginee, atau Outbound No
    const orderFilters = [
      `tracking_no.eq.${clean}`,
      `channel_order_sn.eq.${clean}`,
      `order_id.eq.${clean}`,
      `outbound_no.eq.${clean}`,
    ];
    if (clean.toLowerCase() !== clean) {
      orderFilters.push(
        `tracking_no.eq.${clean.toLowerCase()}`,
        `channel_order_sn.eq.${clean.toLowerCase()}`
      );
    }
    if (stripped && stripped !== clean && stripped.length >= 6) {
      orderFilters.push(
        `tracking_no.eq.${stripped}`,
        `channel_order_sn.eq.${stripped}`,
        `order_id.eq.${stripped}`
      );
    }

    const { data: dOrder, error: errOrder } = await supabase
      .from(GINEE_ORDERS_TABLE)
      .select('*')
      .or(orderFilters.join(','))
      .limit(1)
      .maybeSingle();

    if (!errOrder && dOrder) {
      const finalTracking = dOrder.tracking_no && dOrder.tracking_no !== '-' ? dOrder.tracking_no : clean;
      return {
        orderSn: dOrder.order_id,
        channelOrderSn: dOrder.channel_order_sn || dOrder.order_id,
        orderStatus: dOrder.status,
        channel: dOrder.channel || 'Marketplace',
        shopName: dOrder.shop_name || 'Toko',
        paymentStatus: 'PAID',
        orderTime: dOrder.created_at_ginee || dOrder.created_at,
        payTime: dOrder.payment_time || '',
        shipByTime: dOrder.ship_by_date || '',
        trackingNo: finalTracking,
        logisticsProvider: dOrder.courier || '-',
        totalAmount: Number(dOrder.total_amount || 0),
        currency: dOrder.currency || 'IDR',
        items: Array.isArray(dOrder.items) ? dOrder.items : [],
        note: dOrder.buyer_note || '',
        recipientName: dOrder.recipient_name || '',
        recipientPhone: dOrder.recipient_phone || '',
        recipientAddress: dOrder.recipient_address || '',
        outboundNo: dOrder.outbound_no || undefined,
        warehouseName: dOrder.warehouse_name || undefined,
        rawPayload: dOrder.raw_payload || undefined,
        allTrackingNos: Array.from(new Set([finalTracking, clean, dOrder.tracking_no].filter(Boolean))),
      };
    }

    // 2. Jika tidak ada di ginee_orders, cek apakah ini barcode di cancelled_orders
    const cancelFilters = [
      `barcode.eq.${clean}`,
      `tracking_no.eq.${clean}`,
      `channel_order_sn.eq.${clean}`,
      `order_sn.eq.${clean}`,
    ];
    if (stripped && stripped !== clean && stripped.length >= 6) {
      cancelFilters.push(
        `barcode.eq.${stripped}`,
        `tracking_no.eq.${stripped}`,
        `channel_order_sn.eq.${stripped}`,
        `order_sn.eq.${stripped}`
      );
    }

    const { data: dCancel } = await supabase
      .from(GINEE_CANCELLATIONS_TABLE)
      .select('*')
      .or(cancelFilters.join(','))
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (dCancel) {
      const cancelTracking = dCancel.tracking_no && dCancel.tracking_no !== '-' ? dCancel.tracking_no : clean;
      return {
        orderSn: dCancel.order_sn || dCancel.barcode,
        channelOrderSn: dCancel.channel_order_sn || dCancel.barcode,
        orderStatus: 'CANCELLED',
        channel: dCancel.channel || 'Marketplace',
        shopName: dCancel.shop_name || 'Toko',
        paymentStatus: 'CANCELLED',
        orderTime: dCancel.cancelled_at || new Date().toISOString(),
        payTime: '',
        shipByTime: '',
        trackingNo: cancelTracking,
        logisticsProvider: '-',
        totalAmount: 0,
        currency: 'IDR',
        items: [],
        note: dCancel.reason || 'Dibatalkan di Marketplace / Ginee OMS',
        recipientName: '',
        recipientPhone: '',
        recipientAddress: '',
        allTrackingNos: Array.from(new Set([cancelTracking, clean, dCancel.barcode].filter(Boolean))),
      };
    }

    return null;
  } catch (err) {
    console.warn('[Supabase] findOrderInSupabase error:', err);
    return null;
  }
}

/**
 * Mendengarkan data pembatalan pesanan di Supabase secara REAL-TIME via WebSocket
 * (Diterima dalam hitungan milidetik saat pembatalan terjadi dari Ginee Webhook atau Sync)
 */
export function subscribeCancelledOrdersRealtime(
  callback: (cancelled: { barcode: string; orderSn?: string; reason?: string }[]) => void
): (() => void) | null {
  if (!supabase) return null;

  try {
    const listMap = new Map<string, { barcode: string; orderSn?: string; reason?: string }>();

    const emitMerged = () => {
      callback(Array.from(listMap.values()));
    };

    // 1. Ambil data awal dari cancelled_orders (hanya yang aktif)
    supabase
      .from(GINEE_CANCELLATIONS_TABLE)
      .select('*')
      .eq('is_active', true)
      .limit(5000)
      .then(({ data, error }) => {
        if (!error && data && Array.isArray(data)) {
          data.forEach((row: any) => {
            const reason = row.reason || 'Dibatalkan di Marketplace / Ginee OMS';
            const orderSn = row.channel_order_sn || row.order_sn || row.barcode;
            const ids = [row.barcode, row.tracking_no, row.order_sn, row.channel_order_sn].filter(Boolean);
            ids.forEach((id: string) => {
              const cleanId = String(id).trim().toUpperCase();
              if (cleanId) {
                listMap.set(cleanId, { barcode: cleanId, orderSn, reason });
              }
            });
          });
          emitMerged();
        }
      });

    // 2. Hubungkan ke WebSocket Realtime Supabase
    const channelName = `realtime-cancels-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: GINEE_CANCELLATIONS_TABLE },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.is_active !== false) {
              const reason = row.reason || 'Dibatalkan di Marketplace / Ginee OMS';
              const orderSn = row.channel_order_sn || row.order_sn || row.barcode;
              const ids = [row.barcode, row.tracking_no, row.order_sn, row.channel_order_sn].filter(Boolean);
              ids.forEach((id: string) => {
                const cleanId = String(id).trim().toUpperCase();
                if (cleanId) {
                  listMap.set(cleanId, { barcode: cleanId, orderSn, reason });
                }
              });
              emitMerged();
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old;
            if (oldRow) {
              const ids = [oldRow.barcode, oldRow.tracking_no, oldRow.order_sn, oldRow.channel_order_sn].filter(Boolean);
              ids.forEach((id: string) => {
                const cleanId = String(id).trim().toUpperCase();
                if (cleanId) listMap.delete(cleanId);
              });
              emitMerged();
            }
          }
        }
      )
      .subscribe();

    // Kembalikan fungsi unsubscribe
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('[Supabase] removeChannel error:', e);
      }
    };
  } catch (err) {
    console.warn('[Supabase] subscribeCancelledOrdersRealtime error:', err);
    return null;
  }
}

/**
 * Catatan Arsitektur:
 * Tabel scanned_items di Supabase Utama didedikasikan murni untuk alur dan logika divisi operasional lain (Picker, Checker, Leader, Eliminasi).
 * Modul Ginee (Pesanan 90 Hari dan Scan & Kirim) TIDAK MENULIS atau MENGUBAH tabel scanned_items sama sekali
 * agar tidak mengganggu integritas data divisi lain.
 * Riwayat scan Ginee dikelola secara cepat dan mandiri di IndexedDB lokal browser (dan Firestore jika aktif).
 */
export async function saveScannedRecordToSupabase(_record: any): Promise<boolean> {
  // Disengaja NO-OP: Jangan insert ke scanned_items (milik divisi lain)
  return true;
}

export async function deleteScannedRecordFromSupabase(_identifier: string): Promise<boolean> {
  // Disengaja NO-OP: Jangan delete dari scanned_items
  return true;
}

export async function clearAllScannedRecordsFromSupabase(): Promise<boolean> {
  // Disengaja NO-OP: Jangan delete dari scanned_items
  return true;
}

/**
 * Menghapus data expired:
 * - ginee_orders: Retensi 3 hari kalender (H-3 ke bawah dihapus)
 * - cancelled_orders: Retensi 7 hari kalender (H-7 ke bawah dihapus)
 * Dilakukan otomatis di VPS melalui cron job setiap jam 00:00 WIB,
 * dan fungsi ini berfungsi sebagai pemicu cadangan dari web client.
 */
export async function purgeExpiredGineeDataFromSupabase(
  ordersRetentionDays = 3,
  cancellationsRetentionDays = 7
): Promise<{ success: boolean; deletedCount?: number }> {
  if (!supabase) return { success: false, deletedCount: 0 };
  try {
    const cutoffOrders = new Date(Date.now() - (ordersRetentionDays - 1) * 86400000).toISOString().split('T')[0];
    const cutoffCancels = new Date(Date.now() - (cancellationsRetentionDays - 1) * 86400000).toISOString().split('T')[0];
    console.log(`[Supabase Ginee] Purge cutoff: ginee_orders < ${cutoffOrders}, cancelled_orders < ${cutoffCancels}`);

    // Hapus dari cancelled_orders
    const { error: cancelDelErr } = await supabase
      .from(GINEE_CANCELLATIONS_TABLE)
      .delete()
      .lt('cancelled_at', `${cutoffCancels}T00:00:00.000Z`);

    if (cancelDelErr) {
      console.warn('[Supabase Ginee] Purge cancelled_orders warning:', cancelDelErr.message);
    }

    // Hapus dari ginee_orders
    try {
      await supabase
        .from(GINEE_ORDERS_TABLE)
        .delete()
        .lt('created_at_ginee', `${cutoffOrders}T00:00:00.000Z`);
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.warn('[Supabase Ginee] purgeExpiredGineeData error:', err);
    return { success: false };
  }
}

/**
 * Rekonsiliasi Otomatis: Memeriksa cancelled_orders yang belum memiliki nomor resi (tracking_no = null),
 * lalu mencocokkannya dengan ginee_orders yang memiliki AWB.
 * Jika ditemukan kecocokan:
 * 1. Update data pembatalan yang ada dengan tracking_no.
 * 2. Tambahkan baris baru ke cancelled_orders dengan barcode = tracking_no (AWB Kurir).
 * Hal ini memastikan pesanan yang sudah dicetak dan ada resi kurir langsung terproteksi 100%.
 */
export async function reconcileCancelledOrdersWithTrackings(): Promise<{ success: boolean; repairedCount: number }> {
  if (!supabase) return { success: false, repairedCount: 0 };

  try {
    // 1. Ambil baris cancelled_orders yang tracking_no-nya null
    const { data: nullCancels, error: fetchErr } = await supabase
      .from(GINEE_CANCELLATIONS_TABLE)
      .select('id, barcode, order_sn, channel_order_sn, shop_name, channel, reason, cancelled_at')
      .is('tracking_no', null)
      .limit(500);

    if (fetchErr || !Array.isArray(nullCancels) || nullCancels.length === 0) {
      return { success: true, repairedCount: 0 };
    }

    const orderIdMap = new Map<string, any>();
    const channelSnMap = new Map<string, any>();

    nullCancels.forEach(c => {
      if (c.order_sn) orderIdMap.set(String(c.order_sn).trim().toUpperCase(), c);
      if (c.channel_order_sn) channelSnMap.set(String(c.channel_order_sn).trim().toUpperCase(), c);
      if (c.barcode) channelSnMap.set(String(c.barcode).trim().toUpperCase(), c);
    });

    const targetOrderIds = Array.from(orderIdMap.keys());
    const targetChannelSns = Array.from(channelSnMap.keys());

    const newAwbRows: any[] = [];
    let updatedCount = 0;

    // 2. Cari di ginee_orders berdasarkan order_id
    for (let i = 0; i < targetOrderIds.length; i += 60) {
      const chunk = targetOrderIds.slice(i, i + 60);
      const { data: gineeMatches } = await supabase
        .from(GINEE_ORDERS_TABLE)
        .select('order_id, channel_order_sn, tracking_no, status, shop_name, channel')
        .in('order_id', chunk)
        .not('tracking_no', 'is', null);

      if (Array.isArray(gineeMatches)) {
        for (const gm of gineeMatches) {
          const trk = (gm.tracking_no || '').trim().toUpperCase();
          if (!trk || trk === '-') continue;

          const cancelRow = orderIdMap.get(String(gm.order_id).toUpperCase());
          if (cancelRow) {
            const isActuallyCancelled = gm.status === 'CANCELLED' || gm.status === 'CANCELED';
            if (!isActuallyCancelled) {
              // Jika pesanan di ginee_orders TIDAK BATAL (misal: READY_TO_SHIP, SHIPPED),
              // hapus entri cancel yang keliru ini dari cancelled_orders!
              await supabase
                .from(GINEE_CANCELLATIONS_TABLE)
                .delete()
                .eq('id', cancelRow.id);
              continue;
            }

            // A. Update row yang sudah ada
            await supabase
              .from(GINEE_CANCELLATIONS_TABLE)
              .update({ tracking_no: trk })
              .eq('id', cancelRow.id);

            // B. Siapkan row baru untuk AWB barcode
            newAwbRows.push({
              barcode: trk,
              tracking_no: trk,
              order_sn: gm.order_id,
              channel_order_sn: gm.channel_order_sn || cancelRow.channel_order_sn,
              cancelled_at: cancelRow.cancelled_at || new Date().toISOString(),
              cancelled_by: 'Auto-Reconciliation AWB',
              reason: cancelRow.reason || 'Dibatalkan di Marketplace / Ginee OMS',
              shop_name: gm.shop_name || cancelRow.shop_name,
              channel: gm.channel || cancelRow.channel,
              is_active: true,
            });

            updatedCount++;
          }
        }
      }
    }

    // 3. Cari di ginee_orders berdasarkan channel_order_sn
    for (let i = 0; i < targetChannelSns.length; i += 60) {
      const chunk = targetChannelSns.slice(i, i + 60);
      const { data: gineeMatches } = await supabase
        .from(GINEE_ORDERS_TABLE)
        .select('order_id, channel_order_sn, tracking_no, status, shop_name, channel')
        .in('channel_order_sn', chunk)
        .not('tracking_no', 'is', null);

      if (Array.isArray(gineeMatches)) {
        for (const gm of gineeMatches) {
          const trk = (gm.tracking_no || '').trim().toUpperCase();
          if (!trk || trk === '-') continue;

          const cancelRow = channelSnMap.get(String(gm.channel_order_sn).toUpperCase());
          if (cancelRow) {
            const isActuallyCancelled = gm.status === 'CANCELLED' || gm.status === 'CANCELED';
            if (!isActuallyCancelled) {
              await supabase
                .from(GINEE_CANCELLATIONS_TABLE)
                .delete()
                .eq('id', cancelRow.id);
              continue;
            }

            await supabase
              .from(GINEE_CANCELLATIONS_TABLE)
              .update({ tracking_no: trk })
              .eq('id', cancelRow.id);

            newAwbRows.push({
              barcode: trk,
              tracking_no: trk,
              order_sn: gm.order_id || cancelRow.order_sn,
              channel_order_sn: gm.channel_order_sn,
              cancelled_at: cancelRow.cancelled_at || new Date().toISOString(),
              cancelled_by: 'Auto-Reconciliation AWB',
              reason: cancelRow.reason || 'Dibatalkan di Marketplace / Ginee OMS',
              shop_name: gm.shop_name || cancelRow.shop_name,
              channel: gm.channel || cancelRow.channel,
              is_active: true,
            });

            updatedCount++;
          }
        }
      }
    }

    // 4. Masukkan AWB barcode yang baru ke cancelled_orders
    if (newAwbRows.length > 0) {
      const uniqueAwbMap = new Map<string, any>();
      newAwbRows.forEach(r => uniqueAwbMap.set(r.barcode, r));
      const finalAwbRows = Array.from(uniqueAwbMap.values());

      await supabase
        .from(GINEE_CANCELLATIONS_TABLE)
        .upsert(finalAwbRows, { onConflict: 'barcode' });

      console.log(`✓ [Reconciliation] ${finalAwbRows.length} resi kurir (AWB) baru berhasil ditambahkan ke cancelled_orders!`);
    }

    return { success: true, repairedCount: updatedCount };
  } catch (err: any) {
    console.warn('[Supabase] reconcileCancelledOrdersWithTrackings error:', err);
    return { success: false, repairedCount: 0 };
  }
}

/**
 * Sinkronisasi Real-Time: Mengambil data nomor resi unik (tracking_no) dari tabel cancelled_orders
 * di Supabase Ginee OMS (https://plltdvaxzxwsdtxlwnkf.supabase.co) dan memasukkannya ke
 * tabel cancelled_orders di Supabase utama Kalindo (Data Cancel Admin Panel).
 * Data yang sudah ada diabaikan (skip) sehingga tidak terjadi duplikasi.
 */
export async function syncGineeCancelledOrdersToKalindo(
  targetClient = mainSupabase,
  force = false
): Promise<{ success: boolean; totalGinee: number; newInserted: number; error?: string; skipped?: boolean }> {
  try {
    // 0. Cek apakah fitur sinkronisasi Ginee diaktifkan secara global (OFF toggle)
    if (!force) {
      const isEnabled = await isGineeSyncEnabled();
      if (!isEnabled) {
        console.log('[GineeSync] ⏸️ Sinkronisasi pembatalan Ginee ke Kalindo dilewati karena fitur sedang NONAKTIF (OFF).');
        return { success: true, totalGinee: 0, newInserted: 0, skipped: true };
      }
    }

    // 1. Ambil seluruh data cancelled_orders dari Supabase Ginee yang memiliki tracking_no
    const { data: gineeCancels, error: gErr } = await supabase
      .from(GINEE_CANCELLATIONS_TABLE)
      .select('tracking_no, barcode, order_sn, channel_order_sn, cancelled_at, reason, shop_name, is_active')
      .not('tracking_no', 'is', null)
      .order('cancelled_at', { ascending: false });

    if (gErr) {
      console.warn('[GineeSync] Gagal mengambil cancelled_orders dari Supabase Ginee:', gErr.message);
      return { success: false, totalGinee: 0, newInserted: 0, error: gErr.message };
    }

    if (!gineeCancels || gineeCancels.length === 0) {
      return { success: true, totalGinee: 0, newInserted: 0 };
    }

    // 2. Ekstrak data unik berdasarkan tracking_no (Nomor Resi / AWB Kurir)
    const uniqueGineeMap = new Map<string, any>();
    for (const r of gineeCancels) {
      const trk = String(r.tracking_no || '').trim().toUpperCase();
      if (trk && trk.length >= 4 && !uniqueGineeMap.has(trk)) {
        uniqueGineeMap.set(trk, r);
      }
    }

    const allTrackings = Array.from(uniqueGineeMap.keys());
    if (allTrackings.length === 0) {
      return { success: true, totalGinee: 0, newInserted: 0 };
    }

    // 2b. Validasi status asli pesanan di ginee_orders:
    // Saring dan jangan biarkan nomor resi yang statusnya aktif / kirim masuk ke Data Cancel Kalindo!
    const activeTrackings = new Set<string>();
    for (let i = 0; i < allTrackings.length; i += 100) {
      const slice = allTrackings.slice(i, i + 100);
      const { data: gineeOrders } = await supabase
        .from(GINEE_ORDERS_TABLE)
        .select('tracking_no, status')
        .in('tracking_no', slice)
        .neq('status', 'CANCELLED');

      if (Array.isArray(gineeOrders)) {
        gineeOrders.forEach(go => {
          if (go.tracking_no) activeTrackings.add(String(go.tracking_no).trim().toUpperCase());
        });
      }
    }

    // Jika ada nomor resi yang ternyata AKTIF di ginee_orders, bersihkan dari tabel Ginee cancelled_orders!
    if (activeTrackings.size > 0) {
      const activeList = Array.from(activeTrackings);
      for (let i = 0; i < activeList.length; i += 100) {
        const slice = activeList.slice(i, i + 100);
        await supabase
          .from(GINEE_CANCELLATIONS_TABLE)
          .delete()
          .in('tracking_no', slice);
        await supabase
          .from(GINEE_CANCELLATIONS_TABLE)
          .delete()
          .in('barcode', slice);
      }
    }

    // 3. Periksa resi yang sudah ada di tabel cancelled_orders Supabase utama (chunking per 100)
    const existingSet = new Set<string>();
    const chunkSize = 100;
    for (let i = 0; i < allTrackings.length; i += chunkSize) {
      const slice = allTrackings.slice(i, i + chunkSize);
      const { data: existingRows } = await targetClient
        .from('cancelled_orders')
        .select('barcode')
        .in('barcode', slice);

      if (existingRows) {
        existingRows.forEach(x => {
          if (x.barcode) existingSet.add(String(x.barcode).trim().toUpperCase());
        });
      }
    }

    // 4. Saring hanya data baru yang BENAR-BENAR BATAL dan BELUM ADA di tabel cancelled_orders utama
    const toInsert = Array.from(uniqueGineeMap.values()).filter(r => {
      const trk = String(r.tracking_no).trim().toUpperCase();
      // MUTLAK: Jangan masukkan jika ternyata aktif di ginee_orders!
      if (activeTrackings.has(trk)) return false;
      return !existingSet.has(trk);
    });

    if (toInsert.length > 0) {
      // 5. Masukkan data baru yang sah ke tabel cancelled_orders di Supabase utama
      const rowsToInsert = toInsert.map(r => ({
        barcode: String(r.tracking_no).trim().toUpperCase(),
        cancelled_by: 'Ginee OMS Realtime',
        reason: r.reason || (r.shop_name ? `Dibatalkan di Marketplace / Ginee OMS (${r.shop_name})` : 'Dibatalkan di Marketplace / Ginee OMS'),
        cancelled_at: r.cancelled_at || new Date().toISOString(),
        is_active: true,
      }));

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const batch = rowsToInsert.slice(i, i + chunkSize);
        const { error: insErr } = await targetClient
          .from('cancelled_orders')
          .upsert(batch, { onConflict: 'barcode', ignoreDuplicates: true });

        if (insErr) {
          console.warn('[GineeSync] Warning upserting to main cancelled_orders:', insErr.message);
        }
      }

      console.log(`✓ [GineeSync] Berhasil menyinkronkan ${toInsert.length} data cancel baru dari Ginee ke Supabase utama!`);
    }

    // 6. Pembersihan Otomatis di Supabase Utama Kalindo (Self-Healing):
    // Jika ada nomor resi di cancelled_orders Kalindo yang berasal dari Ginee,
    // tetapi nomor resi tersebut aktif/shipped di ginee_orders, HAPUS dari tabel cancelled_orders Kalindo!
    if (activeTrackings.size > 0) {
      const activeList = Array.from(activeTrackings);
      for (let i = 0; i < activeList.length; i += 100) {
        const slice = activeList.slice(i, i + 100);
        await targetClient
          .from('cancelled_orders')
          .delete()
          .in('barcode', slice)
          .or('cancelled_by.ilike.%Ginee%,cancelled_by.eq.Auto-Reconciliation AWB');
      }
    }

    return { success: true, totalGinee: uniqueGineeMap.size, newInserted: toInsert.length };
  } catch (err: any) {
    console.warn('[GineeSync] syncGineeCancelledOrdersToKalindo fatal error:', err);
    return { success: false, totalGinee: 0, newInserted: 0, error: err.message };
  }
}

