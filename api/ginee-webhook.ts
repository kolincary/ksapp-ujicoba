// Vercel Serverless Function: /api/ginee-webhook.ts
// Menerima push event webhook dari Ginee Open Platform V3 secara real-time dan menyimpan ke Supabase
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_APP_KEY = '74f4f05bb016485b';
const DEFAULT_APP_SECRET = '46218d81e39ad490';
const DEFAULT_COUNTRY = 'ID';
const WEBHOOK_SECRET = 'kalindo_secret_2026';

// Inisialisasi Supabase Client untuk Serverless Environment Vercel (Khusus Ginee OMS)
const SUPABASE_URL = process.env.VITE_GINEE_SUPABASE_URL || 'https://plltdvaxzxwsdtxlwnkf.supabase.co';
const SUPABASE_KEY =
  process.env.GINEE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_GINEE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbHRkdmF4enh3c2R0eGx3bmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4ODAwMjUsImV4cCI6MjEwODQ1NjAyNX0.WM46Ndn5RJOl7n9OUhOfB7gKC4oIdNsZzwMaynTpXKI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
 * Panggil Ginee API V3 untuk mengambil data pesanan terbaru secara detail
 */
async function fetchGineeOrderDetailFromApi(orderId: string): Promise<any | null> {
  if (!orderId) return null;
  const appKey = process.env.GINEE_APP_KEY || DEFAULT_APP_KEY;
  const appSecret = process.env.GINEE_APP_SECRET || DEFAULT_APP_SECRET;
  const country = DEFAULT_COUNTRY;

  const candidateEndpoints = [
    { path: '/openapi/v3/oms/order/detail', body: { orderId } },
    { path: '/openapi/v3/oms/order/get', body: { orderId } },
    {
      path: '/openapi/v3/oms/order/list',
      body: {
        page: 0,
        size: 5,
        createSince: new Date(Date.now() - 30 * 86400000).toISOString(),
        createTo: new Date().toISOString(),
        orderNumbers: [orderId],
      },
    },
  ];

  for (const item of candidateEndpoints) {
    try {
      const method = 'POST';
      const signData = `${method}$${item.path}$`;
      const signature = crypto.createHmac('sha256', appSecret).update(signData).digest('base64');
      const dateStr = new Date().toUTCString();

      const res = await fetch(`https://api.ginee.com${item.path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Advai-Country': country,
          'X-Advai-Date': dateStr,
          'Authorization': `${appKey}:${signature}`,
        },
        body: JSON.stringify(item.body),
      });

      if (!res.ok) continue;
      const json = await res.json();
      if (json && (json.code === 'SUCCESS' || json.code === 0 || json.data)) {
        const orderData = json.data?.order || json.data?.content?.[0] || json.data?.list?.[0] || json.data;
        if (orderData && typeof orderData === 'object') {
          return orderData;
        }
      }
    } catch (err) {
      console.warn(`[GineeWebhook] Fetch API ${item.path} warning:`, err);
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Advai-Signature, X-Advai-Event, X-Ginee-Signature, X-Ginee-Event, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Healthcheck / Ping Challenge dari Ginee
  if (req.method === 'GET') {
    const challenge = req.query?.challenge || req.query?.echostr;
    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({
      status: 'active',
      service: 'Kalindo Ginee Webhook Handler V3 (Supabase Realtime)',
      endpoint: 'https://www.kalindoapp.my.id/api/ginee-webhook',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Hanya method POST yang diterima.' });
  }

  try {
    const payload = req.body || {};

    // 2. Verifikasi Keamanan Secret Key (jika disertakan)
    const incomingSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['x-ginee-secret'] ||
      req.query?.secret ||
      payload.secret;

    if (incomingSecret && incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[GineeWebhook] ⚠️ Peringatan: Secret tidak cocok, tetap diproses dengan pengawasan.');
    }

    const eventType =
      req.headers['x-advai-event'] ||
      req.headers['x-ginee-event'] ||
      payload.eventType ||
      payload.event ||
      payload.action ||
      payload.type ||
      'UNKNOWN_EVENT';

    const data = payload.payload || payload.data || payload.order || payload;
    console.log(`[GineeWebhook] Menerima event: ${eventType}`);

    // 3. Ekstraksi Order ID
    const rawOrderId =
      data.orderId ||
      data.orderSn ||
      data.externalOrderId ||
      data.externalOrderSn ||
      data.orderNo ||
      payload.orderId ||
      payload.orderSn ||
      payload.externalOrderId;

    if (!rawOrderId) {
      return res.status(200).json({
        code: 'SUCCESS',
        message: `Event ${eventType} diterima dan dicatat.`,
      });
    }

    const orderId = String(rawOrderId).trim();

    // 4. Ambil Detail Tambahan dari Ginee API V3 jika data payload belum lengkap
    let enrichedData = data;
    try {
      const apiDetail = await fetchGineeOrderDetailFromApi(orderId);
      if (apiDetail) {
        enrichedData = { ...data, ...apiDetail };
      }
    } catch (e) {
      console.warn('[GineeWebhook] Live detail API fallback warning:', e);
    }

    // 5. Ekstraksi Nomor Resi / Tracking AWB secara mendalam (mendukung struktur Ginee V3 OMS, Outbound logistics, dan FastPrint)
    let rawTracking =
      enrichedData.logistics?.[0]?.trackingNumber ||
      enrichedData.logistics?.[0]?.trackingNo ||
      enrichedData.logistics?.[0]?.waybillNo ||
      enrichedData.payload?.logistics?.[0]?.trackingNumber ||
      enrichedData.payload?.logistics?.[0]?.trackingNo ||
      payload.payload?.logistics?.[0]?.trackingNumber ||
      payload.payload?.logistics?.[0]?.trackingNo ||
      payload.logistics?.[0]?.trackingNumber ||
      data.logistics?.[0]?.trackingNumber ||
      enrichedData.logisticsTrackingNumber ||
      enrichedData.logisticsTrackingNo ||
      enrichedData.trackingNo ||
      enrichedData.trackingNumber ||
      enrichedData.waybillNo ||
      enrichedData.waybillNumber ||
      enrichedData.awbNo ||
      enrichedData.awb ||
      enrichedData.expressNo ||
      enrichedData.packageList?.[0]?.trackingNumber ||
      enrichedData.packageList?.[0]?.logisticsTrackingNumber ||
      enrichedData.packageList?.[0]?.trackingNo ||
      enrichedData.packageList?.[0]?.waybillNo ||
      enrichedData.packages?.[0]?.trackingNumber ||
      enrichedData.packages?.[0]?.trackingNo ||
      enrichedData.packages?.[0]?.waybillNo ||
      enrichedData.shippingDocumentInfo?.waybillNo ||
      enrichedData.shippingDocumentInfo?.trackingNo ||
      enrichedData.shippingInfo?.trackingNo ||
      enrichedData.shippingInfo?.waybillNo ||
      enrichedData.deliveryInfo?.trackingNo ||
      data.trackingNo ||
      '-';

    // Ekstraksi kurir ekspedisi jika tersedia
    const extractedCarrier =
      enrichedData.logistics?.[0]?.logisticsProviderName ||
      enrichedData.payload?.logistics?.[0]?.logisticsProviderName ||
      payload.payload?.logistics?.[0]?.logisticsProviderName ||
      payload.logistics?.[0]?.logisticsProviderName ||
      enrichedData.packageList?.[0]?.logisticsProviderName ||
      enrichedData.logisticsProvider ||
      enrichedData.shippingCarrier ||
      '-';

    const rawStatus = String(enrichedData.orderStatus || enrichedData.status || '').toUpperCase().trim();
    const extStatus = String(enrichedData.externalOrderStatus || enrichedData.subOrderStatus || '').toUpperCase().trim();

    // 1. Periksa apakah status pesanan jelas-jelas aktif / pengiriman (TIDAK BOLEH dianggap batal)
    const isExplicitActive =
      ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'PROCESSED', 'PAID', 'COMPLETED', 'FINISHED', 'SUCCESS', 'SIAP_DIKIRIM', 'DIKIRIM', 'SELESAI'].includes(rawStatus) ||
      rawStatus.includes('READY') ||
      rawStatus.includes('SHIP') ||
      rawStatus.includes('DELIVER') ||
      rawStatus.includes('PROCESS');

    // 2. Normalisasi Status Pesanan
    let normalizedStatus = 'PENDING';
    if (rawStatus.includes('READY') || rawStatus === 'SIAP_DIKIRIM' || rawStatus === 'TO_SHIP' || rawStatus === 'WAIT_SELLER_SEND' || rawStatus === 'PROCESSED') {
      normalizedStatus = 'READY_TO_SHIP';
    } else if (rawStatus.includes('SHIP') || rawStatus === 'DIKIRIM' || rawStatus === 'SHIPPED') {
      normalizedStatus = 'SHIPPED';
    } else if (rawStatus.includes('DELIVER') || rawStatus === 'SELESAI' || rawStatus === 'COMPLETED') {
      normalizedStatus = 'DELIVERED';
    } else if (rawStatus.includes('PAID') || rawStatus === 'LUNAS') {
      normalizedStatus = 'PAID';
    } else if (rawStatus.includes('UNPAID') || rawStatus === 'BELUM_BAYAR') {
      normalizedStatus = 'UNPAID';
    } else if (
      !isExplicitActive &&
      (
        String(eventType).toUpperCase().includes('CANCEL') ||
        String(eventType).toUpperCase().includes('BATAL') ||
        String(payload.action || '').toUpperCase() === 'CANCEL' ||
        String(enrichedData.action || '').toUpperCase() === 'CANCEL' ||
        rawStatus.includes('CANCEL') ||
        rawStatus.includes('BATAL') ||
        rawStatus.includes('DIBATALKAN')
      )
    ) {
      normalizedStatus = 'CANCELLED';
    } else if (rawStatus) {
      normalizedStatus = rawStatus;
    }

    const isCancelEvent = normalizedStatus === 'CANCELLED';

    // 7. Simpan ke Supabase `cancelled_orders` secara Real-Time jika Dibatalkan
    // JANGAN PERNAH mengabaikan resi kurir (AWB) yang sudah pernah dicetak sebelumnya!
    let cleanTracking = rawTracking !== '-' ? String(rawTracking).trim().toUpperCase() : '-';
    let channelSn = String(enrichedData.externalOrderSn || enrichedData.externalOrderId || enrichedData.channelOrderSn || orderId).trim().toUpperCase();

    // Kumpulkan kandidat nomor resi kurir (AWB)
    const trackingCandidates = new Set<string>();
    if (cleanTracking && cleanTracking !== '-') {
      trackingCandidates.add(cleanTracking);
    }
    if (Array.isArray(enrichedData.packageList)) {
      enrichedData.packageList.forEach((p: any) => {
        const trk = p.trackingNumber || p.logisticsTrackingNumber || p.trackingNo || p.waybillNo;
        if (trk && trk !== '-') trackingCandidates.add(String(trk).trim().toUpperCase());
      });
    }
    if (Array.isArray(enrichedData.packages)) {
      enrichedData.packages.forEach((p: any) => {
        const trk = p.trackingNumber || p.trackingNo || p.waybillNo;
        if (trk && trk !== '-') trackingCandidates.add(String(trk).trim().toUpperCase());
      });
    }

    // Jika resi kurir belum lengkap dari payload baru, cari apakah pesanan ini SUDAH PERNAH DICETAK dan memiliki AWB di database ginee_orders
    let existingDbTracking: string | null = null;
    if (orderId) {
      try {
        const lookupFilters = [`order_id.eq.${orderId}`];
        if (channelSn && channelSn !== orderId) {
          lookupFilters.push(`channel_order_sn.eq.${channelSn}`);
        }
        lookupFilters.push(`channel_order_sn.eq.${orderId}`);

        const { data: existingDbOrder } = await supabase
          .from('ginee_orders')
          .select('tracking_no, channel_order_sn, order_id')
          .or(lookupFilters.join(','))
          .limit(1)
          .maybeSingle();

        if (existingDbOrder) {
          if (existingDbOrder.tracking_no && existingDbOrder.tracking_no !== '-') {
            existingDbTracking = String(existingDbOrder.tracking_no).trim().toUpperCase();
            trackingCandidates.add(existingDbTracking);
            if (cleanTracking === '-') {
              cleanTracking = existingDbTracking;
            }
            console.log(`[GineeWebhook] ✓ Berhasil memulihkan AWB kurir tercetak (${existingDbTracking}) dari database ginee_orders untuk pesanan ${orderId}`);
          }
          if ((!channelSn || channelSn.startsWith('SO')) && existingDbOrder.channel_order_sn) {
            channelSn = String(existingDbOrder.channel_order_sn).trim().toUpperCase();
          }
        }
      } catch (lookupErr) {
        console.warn('[GineeWebhook] Warning lookup existing tracking:', lookupErr);
      }
    }

    const primaryTracking = cleanTracking !== '-' ? cleanTracking : (existingDbTracking || (trackingCandidates.size > 0 ? Array.from(trackingCandidates)[0] : null));
    const shopName = enrichedData.shopName || enrichedData.storeName || null;
    const channelName = enrichedData.channel || enrichedData.platform || null;
    const safeCreated = safeIsoDate(enrichedData.createAt || enrichedData.orderTime) || new Date().toISOString();

    if (isCancelEvent) {
      const cancelReason = enrichedData.cancelReason || enrichedData.reason || data.cancelReason || 'Pesanan dibatalkan di Marketplace / Ginee OMS';

      // 1. Simpan pembatalan untuk SETIAP Nomor Resi Kurir (AWB) yang pernah dicetak — INILAH YANG DI-SCAN PACKING
      for (const awb of trackingCandidates) {
        const cancelPayloadAwb: any = {
          barcode: awb,
          tracking_no: awb,
          order_sn: orderId,
          channel_order_sn: channelSn,
          cancelled_at: safeCreated,
          cancelled_by: 'Ginee Webhook V3 Realtime',
          reason: cancelReason,
          shop_name: shopName,
          channel: channelName,
          is_active: true,
        };

        const { error: cancelErr1 } = await supabase
          .from('cancelled_orders')
          .upsert(cancelPayloadAwb, { onConflict: 'barcode' });

        if (cancelErr1) {
          console.warn('[GineeWebhook] Error recording cancelled_orders tracking to Supabase:', cancelErr1.message);
        } else {
          console.log(`[GineeWebhook] 🚨 Pesanan Batal dicatat di Supabase via RESI KURIR (AWB): ${awb} (${orderId})`);
        }
      }

      // 2. Simpan juga pembatalan berdasarkan Nomor Pesanan Marketplace (Shopee, TikTok, dll)
      if (channelSn && !channelSn.startsWith('SO') && !trackingCandidates.has(channelSn)) {
        const cancelPayloadChn: any = {
          barcode: channelSn,
          tracking_no: primaryTracking,
          order_sn: orderId,
          channel_order_sn: channelSn,
          cancelled_at: safeCreated,
          cancelled_by: 'Ginee Webhook V3 Realtime',
          reason: cancelReason,
          shop_name: shopName,
          channel: channelName,
          is_active: true,
        };

        const { error: cancelErr2 } = await supabase
          .from('cancelled_orders')
          .upsert(cancelPayloadChn, { onConflict: 'barcode' });

        if (cancelErr2) {
          console.warn('[GineeWebhook] Error recording cancelled_orders channelSn to Supabase:', cancelErr2.message);
        } else {
          console.log(`[GineeWebhook] 🚨 Pesanan Batal dicatat di Supabase via NO PESANAN TOKO: ${channelSn} (${orderId})`);
        }
      }

      // 3. Jika belum memiliki nomor resi sama sekali (dibatalkan sebelum cetak), simpan orderId Ginee
      if (trackingCandidates.size === 0 && orderId && orderId !== channelSn) {
        await supabase
          .from('cancelled_orders')
          .upsert({
            barcode: orderId,
            tracking_no: null,
            order_sn: orderId,
            channel_order_sn: channelSn,
            cancelled_at: safeCreated,
            cancelled_by: 'Ginee Webhook V3 Realtime',
            reason: cancelReason,
            shop_name: shopName,
            channel: channelName,
            is_active: true,
          }, { onConflict: 'barcode' });
      }
    } else if (isExplicitActive) {
      // Pembersihan otomatis: jika pesanan aktif / siap dikirim / telah dikirim,
      // pastikan resi / barcode pesanan ini TIDAK ADA di tabel cancelled_orders!
      try {
        const cleanupBarcodes = Array.from(trackingCandidates);
        if (channelSn && !channelSn.startsWith('SO')) cleanupBarcodes.push(channelSn);
        if (orderId) cleanupBarcodes.push(orderId);
        if (cleanupBarcodes.length > 0) {
          await supabase
            .from('cancelled_orders')
            .delete()
            .in('barcode', cleanupBarcodes);
        }
      } catch (delErr) {
        console.warn('[GineeWebhook] Warning cleaning active order from cancelled_orders:', delErr);
      }
    }

    // 8. Simpan/Update Dokumen Pesanan Lengkap ke Supabase `ginee_orders` (Pastikan tracking_no tidak hilang)
    try {
      const rawItems = enrichedData.items || enrichedData.orderItemList || payload.items || [];
      const formattedItems = Array.isArray(rawItems)
        ? rawItems.map((it: any) => ({
            sku: it.masterSku || it.sku || it.itemSku || it.variationSku || '-',
            msku: it.masterSku || it.msku || it.sku || it.itemSku || '-',
            productName: it.masterVariationName || it.productName || it.itemName || it.name || 'Produk Pesanan Ginee',
            variant: it.variant || it.variationName || it.spec || '',
            qty: Number(it.realQuantity || it.planQuantity || it.qty || it.quantity || 1),
            price: Number(it.realPrice || it.planPrice || it.price || 0),
          }))
        : [];

      const trackingToSave = primaryTracking || (cleanTracking !== '-' ? cleanTracking : null) || existingDbTracking;
      const supabaseOrderRow: any = {
        order_id: orderId,
        channel_order_sn: channelSn || null,
        ...(trackingToSave ? { tracking_no: trackingToSave } : {}),
        status: normalizedStatus,
        channel: channelName || null,
        shop_name: shopName || null,
        created_at_ginee: safeCreated,
        payment_time: safeIsoDate(enrichedData.payTime),
        ship_by_date: safeIsoDate(enrichedData.shipByTime),
        courier: extractedCarrier !== '-' ? extractedCarrier : (enrichedData.logisticsProvider || enrichedData.shippingCarrier || null),
        recipient_name: enrichedData.recipientName || enrichedData.recipientInfo?.name || null,
        recipient_phone: enrichedData.recipientPhone || enrichedData.recipientInfo?.phone || null,
        recipient_address: enrichedData.recipientAddress || enrichedData.recipientInfo?.address || null,
        total_amount: Number(enrichedData.totalAmount || enrichedData.orderAmount || 0),
        currency: enrichedData.currency || 'IDR',
        buyer_note: enrichedData.note || enrichedData.remark || null,
        outbound_no: enrichedData.outboundNo || payload.outboundNo || null,
        warehouse_name: enrichedData.warehouseName || payload.warehouseName || null,
        items: formattedItems,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      };

      const { error: gineeOrderErr } = await supabase
        .from('ginee_orders')
        .upsert(supabaseOrderRow, { onConflict: 'order_id' });

      if (gineeOrderErr) {
        if (!gineeOrderErr.message.includes('not find the table')) {
          console.warn('[GineeWebhook] Notice upserting to ginee_orders:', gineeOrderErr.message);
        }
      } else {
        console.log(`[GineeWebhook] ✓ Berhasil update pesanan ${orderId} ke Supabase ginee_orders.`);
      }
    } catch (orderSaveErr) {
      console.warn('[GineeWebhook] Warning saving order to ginee_orders:', orderSaveErr);
    }

    return res.status(200).json({
      code: 'SUCCESS',
      message: 'OK',
      orderId,
      orderStatus: normalizedStatus,
      trackingNo: cleanTracking,
      eventType,
    });
  } catch (err: any) {
    console.error('[GineeWebhook] Error memproses webhook:', err);
    return res.status(200).json({
      code: 'PROCESSED_WITH_WARNING',
      message: err.message || 'Error internal webhook',
    });
  }
}
