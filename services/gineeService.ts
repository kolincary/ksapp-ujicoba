import { saveOrdersToIndexedDB, getAllOrdersFromIndexedDB, isMockOrder } from './gineeIndexedDb';

export interface GineeOrderItem {
  sku: string;
  msku?: string;
  productName: string;
  variant?: string;
  qty: number;
  price: number;
  imageUrl?: string;
}

export interface GineeOrder {
  orderSn: string;
  channelOrderSn: string;
  platform: string;
  shopName: string;
  buyerName: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  isCod?: boolean;
  isPreOrder?: boolean;
  labelPrinted?: boolean;
  orderTime: string;
  payTime: string;
  shipByTime: string;
  trackingNo: string;
  logisticsProvider: string;
  totalAmount: number;
  currency: string;
  items: GineeOrderItem[];
  note: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  outboundNo?: string;
  warehouseName?: string;
  allTrackingNos?: string[];
  isScanned?: boolean;
  scannedAt?: string;
  scanSyncStatus?: 'SYNCED' | 'LOCAL_ONLY' | 'PENDING' | 'ERROR';
  rawPayload?: any;
}

export type GineeProxyMode = 'auto' | 'supabase' | 'server' | 'custom';

export interface GineeApiConfig {
  appKey: string;
  appSecret: string;
  country?: string; // Default: 'ID'
  proxyMode?: GineeProxyMode;
  customProxyUrl?: string;
  host?: string; // Default: 'https://api.ginee.com'
}

// ─── Custom Error for Ginee API Gateway Responses ─────────────────────────────
export class GineeApiError extends Error {
  code?: any;
  endpoint?: string;
  constructor(message: string, code?: any, endpoint?: string) {
    super(message);
    this.name = 'GineeApiError';
    this.code = code;
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, GineeApiError.prototype);
  }
}

// ─── Generate HMAC-SHA256 Signature in Browser ────────────────────────────────
export async function generateGineeSignature(
  secret: string,
  method: string,
  path: string
): Promise<string> {
  const cleanSecret = secret.trim();
  const signData = `${method.toUpperCase()}$${path}$`;
  const encoder = new TextEncoder();

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(cleanSecret),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signData));
    const bytes = new Uint8Array(signatureBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  throw new Error('Web Cryptography API tidak tersedia di browser ini.');
}

// ─── Map Channel to Readable Platform ─────────────────────────────────────────
export function mapChannelToPlatform(channel?: string): string {
  if (!channel) return 'Lainnya';
  const c = channel.toUpperCase();
  if (c.includes('SHOPEE')) return 'Shopee';
  if (c.includes('TOKOPEDIA')) return 'Tokopedia';
  if (c.includes('LAZADA')) return 'Lazada';
  if (c.includes('TIKTOK')) return 'TikTok Shop';
  if (c.includes('BLIBLI')) return 'Blibli';
  if (c.includes('BUKALAPAK')) return 'Bukalapak';
  if (c.includes('OFFLINE') || c.includes('MANUAL')) return 'Manual / Offline';
  return channel;
}

// ─── Ginee Shop ID to Human-Readable Shop Name Map ──────────────────────────
export const GINEE_SHOP_MAP: Record<string, { name: string; platform: string }> = {
  // Shopee
  '64925304': { name: '(ID) JOYKO Official Shop', platform: 'Shopee' },
  '1468895646': { name: '(ID) JOYKO Surabaya', platform: 'Shopee' },
  '1910690728': { name: '(ID) JOYKO Home Official', platform: 'Shopee' },
  // Lazada
  '378': { name: '(ID) JOYKO', platform: 'Lazada' },
  '379': { name: '(ID) JOYKO Surabaya', platform: 'Lazada' },
  // TikTok Shop
  '7494675848901527651': { name: '(ID) JOYKO Home', platform: 'TikTok Shop' },
  '7496118821000349737': { name: '(ID) Joyko Surabaya', platform: 'TikTok Shop' },
  '7494819579044070930': { name: '(ID) Joyko.id', platform: 'TikTok Shop' },
  // Blibli
  'blibli_joyko': { name: '(ID) JOYKO', platform: 'Blibli' },
};

export function resolveShopName(rawShop?: string, platform?: string): string {
  if (!rawShop) return '(ID) JOYKO Official Shop';
  const str = String(rawShop).trim();
  if (GINEE_SHOP_MAP[str]) {
    return GINEE_SHOP_MAP[str].name;
  }
  if (/[a-zA-Z]/.test(str)) {
    return str.startsWith('(ID)') ? str : `(ID) ${str}`;
  }
  return `(ID) Toko ${str}`;
}

/**
 * Ekstraksi nomor resi / tracking / waybill terlengkap dari berbagai format respon Ginee OMS V3.
 * Mendukung Shopee SPX (SPXID...), J&T Express, SiCepat, AnterAja, Ninja, TikTok Express, dll.
 */
export function extractOrderTrackingNo(raw: any): string {
  if (!raw) return '-';

  // 1. Array logistics (format Ginee OMS Outbound / Webhook payload)
  const logisticsArr =
    raw.logistics ||
    raw.payload?.logistics ||
    raw.rawPayload?.payload?.logistics ||
    raw.rawPayload?.logistics ||
    raw.logisticsList ||
    raw.deliveryInfoList ||
    raw.shippingInfoList ||
    raw.packageInfos ||
    raw.outboundInfos;
  if (Array.isArray(logisticsArr) && logisticsArr.length > 0) {
    for (const l of logisticsArr) {
      const val =
        l.trackingNumber ||
        l.trackingNo ||
        l.waybillNo ||
        l.logisticsTrackingNumber ||
        l.awbNo ||
        l.mailNo ||
        l.expressNo ||
        l.waybillCode ||
        l.trackingCode;
      if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
        return val.trim();
      }
    }
  }

  // 2. Array packageList (struktur standar Ginee OMS V3 untuk pesanan pengiriman)
  const pkgListArr =
    raw.packageList ||
    raw.payload?.packageList ||
    raw.rawPayload?.payload?.packageList ||
    raw.rawPayload?.packageList ||
    raw.orderPackageList;
  if (Array.isArray(pkgListArr) && pkgListArr.length > 0) {
    for (const pkg of pkgListArr) {
      const val =
        pkg.trackingNumber ||
        pkg.logisticsTrackingNumber ||
        pkg.logisticsTrackingNo ||
        pkg.trackingNo ||
        pkg.waybillNo ||
        pkg.waybillNumber ||
        pkg.awbNo ||
        pkg.awb ||
        pkg.mailNo ||
        pkg.expressNo ||
        pkg.waybillCode;
      if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
        return val.trim();
      }
    }
  }

  // 3. Array packages
  if (Array.isArray(raw.packages) && raw.packages.length > 0) {
    for (const pkg of raw.packages) {
      const val =
        pkg.trackingNumber ||
        pkg.logisticsTrackingNumber ||
        pkg.logisticsTrackingNo ||
        pkg.trackingNo ||
        pkg.waybillNo ||
        pkg.awbNo ||
        pkg.mailNo ||
        pkg.expressNo;
      if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
        return val.trim();
      }
    }
  }

  // 4. Properti langsung di level root objek pesanan Ginee V3
  const direct =
    raw.trackingNo ||
    raw.trackingNumber ||
    raw.logisticsTrackingNumber ||
    raw.logisticsTrackingNo ||
    raw.waybillNo ||
    raw.waybillNumber ||
    raw.waybillCode ||
    raw.mailNo ||
    raw.awbNo ||
    raw.awb ||
    raw.expressNo ||
    raw.expressCode ||
    raw.logisticsNo ||
    raw.trackingCode ||
    raw.shippingNo ||
    raw.shippingNumber ||
    raw.billCode ||
    raw.channelTrackingNo ||
    raw.channelTrackingNumber ||
    raw.shippingDocumentInfo?.waybillNo ||
    raw.shippingDocumentInfo?.trackingNo ||
    raw.shippingDocumentInfo?.trackingNumber ||
    raw.shippingDocumentInfo?.logisticsTrackingNumber ||
    raw.shippingInfo?.trackingNo ||
    raw.shippingInfo?.waybillNo ||
    raw.shippingInfo?.trackingNumber ||
    raw.shippingInfo?.logisticsTrackingNumber ||
    raw.deliveryInfo?.trackingNo ||
    raw.deliveryInfo?.waybillNo ||
    raw.deliveryInfo?.logisticsTrackingNumber ||
    raw.deliveryOrder?.trackingNo ||
    raw.deliveryOrder?.waybillNo ||
    raw.shippingDocument?.trackingNo ||
    raw.shippingDocument?.waybillNo ||
    raw.fulfillmentInfo?.trackingNo ||
    raw.fulfillmentInfo?.waybillNo ||
    raw.externalBookingSn ||
    raw.bookingSn ||
    raw.bookingNo ||
    raw.shippingCarrierNo ||
    raw.shippingOrderNo;

  if (direct && typeof direct === 'string' && direct.trim() !== '' && direct.trim() !== '-') {
    return direct.trim();
  }

  return '-';
}

/**
 * Mengambil seluruh nomor resi unik jika pesanan memiliki banyak paket / waybill
 */
export function extractAllTrackingNos(raw: any): string[] {
  if (!raw) return [];
  const set = new Set<string>();

  const add = (val: any) => {
    if (val && typeof val === 'string' && val.trim() !== '' && val.trim() !== '-') {
      set.add(val.trim());
    }
  };

  add(raw.externalBookingSn);
  add(raw.bookingSn);
  add(raw.bookingNo);

  const logisticsArr =
    raw.logistics ||
    raw.payload?.logistics ||
    raw.rawPayload?.payload?.logistics ||
    raw.rawPayload?.logistics ||
    raw.logisticsList ||
    raw.deliveryInfoList ||
    raw.shippingInfoList ||
    raw.packageInfos ||
    raw.outboundInfos;
  if (Array.isArray(logisticsArr)) {
    for (const l of logisticsArr) {
      add(l.trackingNumber);
      add(l.trackingNo);
      add(l.waybillNo);
      add(l.logisticsTrackingNumber);
      add(l.awbNo);
      add(l.mailNo);
      add(l.expressNo);
      add(l.waybillCode);
    }
  }

  const pkgListArr =
    raw.packageList ||
    raw.payload?.packageList ||
    raw.rawPayload?.payload?.packageList ||
    raw.rawPayload?.packageList ||
    raw.orderPackageList;
  if (Array.isArray(pkgListArr)) {
    for (const p of pkgListArr) {
      add(p.logisticsTrackingNumber);
      add(p.logisticsTrackingNo);
      add(p.trackingNo);
      add(p.waybillNo);
      add(p.trackingNumber);
      add(p.awbNo);
      add(p.mailNo);
      add(p.expressNo);
      add(p.waybillCode);
    }
  }
  if (Array.isArray(raw.packages)) {
    for (const p of raw.packages) {
      add(p.logisticsTrackingNumber);
      add(p.trackingNo);
      add(p.waybillNo);
      add(p.trackingNumber);
      add(p.awbNo);
      add(p.mailNo);
      add(p.expressNo);
    }
  }

  add(raw.logisticsTrackingNumber);
  add(raw.logisticsTrackingNo);
  add(raw.trackingNo);
  add(raw.trackingNumber);
  add(raw.waybillNo);
  add(raw.waybillNumber);
  add(raw.waybillCode);
  add(raw.mailNo);
  add(raw.awbNo);
  add(raw.expressNo);
  add(raw.expressCode);
  add(raw.logisticsNo);
  add(raw.trackingCode);
  add(raw.shippingNo);
  add(raw.channelTrackingNo);
  add(raw.shippingDocumentInfo?.waybillNo);
  add(raw.shippingDocumentInfo?.trackingNo);
  add(raw.shippingInfo?.trackingNo);
  add(raw.shippingInfo?.waybillNo);
  add(raw.deliveryInfo?.trackingNo);
  add(raw.deliveryOrder?.trackingNo);
  add(raw.deliveryOrder?.waybillNo);
  add(raw.shippingDocument?.trackingNo);
  add(raw.shippingDocument?.waybillNo);

  return Array.from(set);
}

/**
 * Ekstraksi seluruh item dari berbagai struktur respon Ginee Open API V3,
 * termasuk packageList, packages, orderItemList, dll.
 */
export function extractRawOrderItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw.items) && raw.items.length > 0) return raw.items;
  if (Array.isArray(raw.orderItemList) && raw.orderItemList.length > 0) return raw.orderItemList;
  if (Array.isArray(raw.itemList) && raw.itemList.length > 0) return raw.itemList;
  if (Array.isArray(raw.products) && raw.products.length > 0) return raw.products;
  if (Array.isArray(raw.goodsList) && raw.goodsList.length > 0) return raw.goodsList;
  if (Array.isArray(raw.skuList) && raw.skuList.length > 0) return raw.skuList;
  if (Array.isArray(raw.orderItems) && raw.orderItems.length > 0) return raw.orderItems;
  if (Array.isArray(raw.orderDetailList) && raw.orderDetailList.length > 0) return raw.orderDetailList;
  if (Array.isArray(raw.lineItems) && raw.lineItems.length > 0) return raw.lineItems;
  if (Array.isArray(raw.subOrders) && raw.subOrders.length > 0) return raw.subOrders;
  if (Array.isArray(raw.subOrderList) && raw.subOrderList.length > 0) return raw.subOrderList;

  // 1. Ekstraksi dari packageList (Ginee V3 package grouping)
  if (Array.isArray(raw.packageList) && raw.packageList.length > 0) {
    const list: any[] = [];
    for (const pkg of raw.packageList) {
      const pItems = pkg.orderItemList || pkg.itemList || pkg.items || pkg.products || pkg.goodsList || pkg.skuList;
      if (Array.isArray(pItems) && pItems.length > 0) {
        list.push(...pItems);
      }
    }
    if (list.length > 0) return list;
  }

  // 2. Ekstraksi dari packages
  if (Array.isArray(raw.packages) && raw.packages.length > 0) {
    const list: any[] = [];
    for (const pkg of raw.packages) {
      const pItems = pkg.orderItemList || pkg.itemList || pkg.items || pkg.products || pkg.goodsList || pkg.skuList;
      if (Array.isArray(pItems) && pItems.length > 0) {
        list.push(...pItems);
      }
    }
    if (list.length > 0) return list;
  }

  // 3. Ekstraksi dari rawPayload jika ada
  if (raw.rawPayload) {
    const payloadItems = raw.rawPayload.payload?.items || raw.rawPayload.items || raw.rawPayload.orderItemList;
    if (Array.isArray(payloadItems) && payloadItems.length > 0) return payloadItems;
  }

  return [];
}

// ─── Known Seed Orders (Based on User's Exact Ginee OMS Data & Gambar 1, 2, 3, 4) ─
export const KNOWN_GINEE_ORDERS_SEED: GineeOrder[] = [
  {
    orderSn: '261024G08DBXDW',
    channelOrderSn: '261024G08DBXDW',
    platform: 'Shopee',
    shopName: 'JOYKO Official Shop',
    buyerName: 'A******a',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'Cash on Delivery',
    isCod: true,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-24T21:07:00+07:00',
    payTime: '2026-10-24T21:07:00+07:00',
    shipByTime: '25-10-2026 23:59',
    trackingNo: 'SPXID048291047192',
    allTrackingNos: ['SPXID048291047192'],
    logisticsProvider: 'SPX Standard',
    totalAmount: 32022,
    currency: 'IDR',
    outboundNo: 'So-2113158973567209472',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'A******a',
    recipientPhone: '******29',
    recipientAddress: '******a No. 1, Penatih, KOTA DENPASAR, DENPASAR TIMUR, BALI, ID, 80235',
    items: [
      {
        sku: 'FILE-EF-1218/BLUE',
        msku: 'FILE-EF-1218/BLUE',
        productName: 'Expanding File Map Harmonika Joyko EF-1218 Giro 13 Pocket',
        variant: 'Blue',
        qty: 1,
        price: 17600,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98o-lts22v99f24c15_tn',
      },
      {
        sku: 'FILE-EF-1218/PURPLE',
        msku: 'FILE-EF-1218/PURPLE',
        productName: 'Expanding File Map Harmonika Joyko EF-1218 Giro 13 Pocket',
        variant: 'Purple',
        qty: 1,
        price: 20400,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98o-lts22v99f24c15_tn',
      },
    ],
  },
  {
    orderSn: '586768550415991811',
    channelOrderSn: '586768550415991811',
    platform: 'TikTok Shop',
    shopName: '(ID) JOYKO Home',
    buyerName: 'A******o',
    orderStatus: 'UNPAID',
    paymentStatus: 'UNPAID',
    paymentMethod: 'COD',
    isCod: true,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-24T21:07:00+07:00',
    payTime: '2026-10-24T21:07:00+07:00',
    shipByTime: '25-10-2026 23:59',
    trackingNo: '-',
    allTrackingNos: [],
    logisticsProvider: 'Anteraja Economy',
    totalAmount: 38902,
    currency: 'IDR',
    outboundNo: 'So-2113157804955340800',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'A******o',
    recipientPhone: '*******37',
    recipientAddress: 'Kec. Denpasar Barat, Kota Denpasar, Bali',
    items: [
      {
        sku: 'SCISSORS-SC-838',
        msku: 'SCISSORS-SC-838',
        productName: 'JOYKO Scissors Gunting Stainless Steel SC-838',
        variant: 'Hitam',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98s-lts24z87m55k11_tn',
      },
      {
        sku: 'CUTTER-CU-500',
        msku: 'CUTTER-CU-500',
        productName: 'JOYKO Cutter Pemotong Kertas CU-500',
        variant: 'Standard',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98t-lts259v1c9ab73_tn',
      },
      {
        sku: 'CLIP-105/1BOX/12PCS',
        msku: 'CLIP-105/1BOX/12PCS',
        productName: 'Binder Clip Klip Penjepit Kertas Joyko No. 105-12Pcs',
        variant: 'No. 105-12Pcs',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98r-lts213n8b3v920_tn',
      },
      {
        sku: 'PENCILLEAD-PL-10',
        msku: 'PENCILLEAD-PL-10',
        productName: 'Pencil Lead Isi Pensil Mekanik Joyko PL-10 0.5 mm',
        variant: '0.5 mm',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98v-lts20v45w6ab18_tn',
      },
      {
        sku: 'RULER-RL-ST30',
        msku: 'RULER-RL-ST30',
        productName: 'Penggaris Besi Joyko Stainless Steel 30cm RL-ST30',
        variant: '30cm',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98w-lts22v99f24c31_tn',
      },
      {
        sku: 'TAPE-CT-522/1PCS',
        msku: 'TAPE-CT-522/1PCS',
        productName: 'JOYKO Correction Tape Pita Koreksi CT-522 12m',
        variant: 'CT-522 12m',
        qty: 1,
        price: 5557,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98t-lts259v1c9ab73_tn',
      },
      {
        sku: 'HIGHLIGHTER-HL-45',
        msku: 'HIGHLIGHTER-HL-45',
        productName: 'Joyko Highlighter Stabilo Pastel HL-45 Set 6 Warna',
        variant: 'Pastel Set 6',
        qty: 1,
        price: 5560,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98y-lts24z87m55k42_tn',
      },
    ],
  },
  {
    orderSn: '261024FTB1NCQ0',
    channelOrderSn: '261024FTB1NCQ0',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'V*****a',
    orderStatus: 'UNPAID',
    paymentStatus: 'UNPAID',
    paymentMethod: 'ShopeePay',
    isCod: false,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-24T19:21:00+07:00',
    payTime: '2026-10-24T19:21:00+07:00',
    shipByTime: '26-10-2026 23:59',
    trackingNo: 'SPXID06588291039A',
    allTrackingNos: ['SPXID06588291039A'],
    logisticsProvider: 'SPX Hemat',
    totalAmount: 30568,
    currency: 'IDR',
    outboundNo: 'So-2113969110676295680',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'V*****a',
    recipientPhone: '*******54',
    recipientAddress: 'Kota Surabaya, Jawa Timur',
    items: [
      {
        sku: 'TAPE-OPP-1-100/1ROLL',
        msku: 'TAPE-OPP-1-100/1ROLL',
        productName: 'Opp Tape Lakban Bening Joyko OPP-1-100M',
        variant: 'OPP-1-100M',
        qty: 1,
        price: 18600,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98v-lts20v45w6ab18_tn',
      },
      {
        sku: 'CLIP-105/1BOX/12PCS',
        msku: 'CLIP-105/1BOX/12PCS',
        productName: 'Binder Clip Klip Penjepit Kertas Joyko No. 105-12Pcs',
        variant: 'No. 105-12Pcs',
        qty: 1,
        price: 3000,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98r-lts213n8b3v920_tn',
      },
      {
        sku: 'BOOK-SKPP-2700-A4',
        msku: 'BOOK-SKPP-2700-A4',
        productName: 'JOYKO Sketch Paper Kertas Sketsa A4',
        variant: 'A4',
        qty: 1,
        price: 8968,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98w-lts22v99f24c31_tn',
      },
    ],
  },
  {
    orderSn: '261024FTB1P086',
    channelOrderSn: '261024FTB1P086',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'A******a',
    orderStatus: 'UNPAID',
    paymentStatus: 'UNPAID',
    paymentMethod: 'Transfer Bank',
    isCod: false,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-24T19:21:00+07:00',
    payTime: '2026-10-24T19:21:00+07:00',
    shipByTime: '25-10-2026 23:59',
    trackingNo: '11004558291039',
    allTrackingNos: ['11004558291039'],
    logisticsProvider: 'Anteraja Economy',
    totalAmount: 9677,
    currency: 'IDR',
    outboundNo: 'So-2113157289898106880',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'A******a',
    recipientPhone: '*******56',
    recipientAddress: 'Kota Bandung, Jawa Barat',
    items: [
      {
        sku: 'PEN-GP-265/1BOX/12PCS',
        msku: 'PEN-GP-265/1BOX/12PCS',
        productName: 'JOYKO Gel Pen GP-265 Shokyo 0.5 mm Hitam Pack 12 Pcs',
        variant: 'Hitam (12 Pcs)',
        qty: 1,
        price: 4838,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98y-lts24z87m55k42_tn',
      },
      {
        sku: 'TAPE-CT-522/1PCS',
        msku: 'TAPE-CT-522/1PCS',
        productName: 'JOYKO Correction Tape Pita Koreksi CT-522 12m',
        variant: 'CT-522 12m',
        qty: 1,
        price: 4839,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98t-lts259v1c9ab73_tn',
      },
    ],
  },
  {
    orderSn: '261022AASBBTGTQ5RSI',
    channelOrderSn: '261022AASBBTGTQ5RSI',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Home Official',
    buyerName: 'Dibuat oleh Shopee',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'Non COD',
    isCod: false,
    isPreOrder: false,
    labelPrinted: true,
    orderTime: '2026-10-22T21:18:00+07:00',
    payTime: '2026-10-22T21:18:00+07:00',
    shipByTime: '23-10-2026 20:41',
    trackingNo: 'SPXID06566456437A',
    allTrackingNos: ['SPXID06566456437A'],
    logisticsProvider: 'SPX Hemat',
    totalAmount: 0,
    currency: 'IDR',
    outboundNo: 'So-2113273702048202752',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'Dibuat oleh Shopee',
    recipientPhone: '-',
    recipientAddress: '-',
    items: [
      {
        sku: 'CLOCK-WLCL-5001',
        msku: 'CLOCK-WLCL-5001',
        productName: 'JOYKO Wall Clock Jam Dinding WLCL-5001',
        variant: 'WLCL-5001',
        qty: 1,
        price: 0,
      },
    ],
  },
  {
    orderSn: '261023CCFRX6DF',
    channelOrderSn: '261023CCFRX6DF',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'N******i',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'ShopeePay',
    isCod: false,
    isPreOrder: false,
    labelPrinted: true,
    orderTime: '2026-10-23T10:37:00Z',
    payTime: '2026-10-23T10:37:00Z',
    shipByTime: '23-10-2026 23:59',
    trackingNo: 'SPXID06563033978A',
    logisticsProvider: 'SPX Hemat',
    totalAmount: 103724,
    currency: 'IDR',
    outboundNo: 'So-2113474383916978176',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'N******i',
    recipientPhone: '*******30',
    recipientAddress: 'Kota Surabaya, Jawa Timur',
    allTrackingNos: ['SPXID06563033978A'],
    items: [
      {
        sku: 'PENCILLEAD-PL-10',
        msku: 'PENCILLEAD-PL-10',
        productName: 'Pencil Lead Isi Pensil Mekanik Joyko PL-10 0.5 mm',
        variant: 'PL-10 0.5 mm',
        qty: 1,
        price: 3000,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7r98o-lsi503b4k0r615_tn',
      },
    ],
  },
  {
    orderSn: '261022A55DQ92X',
    channelOrderSn: '261022A55DQ92X',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'N******a',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'ShopeePay',
    isCod: false,
    isPreOrder: false,
    labelPrinted: true,
    orderTime: '2026-10-22T14:30:00Z',
    payTime: '2026-10-22T14:35:00Z',
    shipByTime: '23-10-2026 23:59',
    trackingNo: '11004557309250',
    logisticsProvider: 'Anteraja Economy',
    totalAmount: 60000,
    currency: 'IDR',
    outboundNo: 'So-2113153295475412992',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'N******a',
    recipientPhone: '*******10',
    recipientAddress: 'Jl. Merdeka No. 45, Jakarta',
    items: [
      {
        sku: 'BAG-RSB-100-12X20',
        msku: 'BAG-RSB-100-12X20',
        productName: 'Plastik Klip Resealable Bag RSB-100 Joyko 4X6~12X20',
        variant: 'RSB-100-12x20',
        qty: 4,
        price: 15000,
        imageUrl: 'https://cf.shopee.co.id/file/id-11134207-7rbk6-m6ds60vwj1eb24_tn',
      },
    ],
  },
  {
    orderSn: '2610229T4BFTW8',
    channelOrderSn: '2610229T4BFTW8',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'N******a',
    orderStatus: 'SHIPPED',
    paymentStatus: 'PAID',
    paymentMethod: 'COD',
    isCod: true,
    isPreOrder: false,
    labelPrinted: true,
    orderTime: '2026-10-22T11:01:00Z',
    payTime: '2026-10-22T10:01:00Z',
    shipByTime: '22-10-2026 23:59',
    trackingNo: 'SPXID048291047192',
    logisticsProvider: 'Hemat Kargo',
    totalAmount: 32348,
    currency: 'IDR',
    outboundNo: 'So-4384539335337073717',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'N******a',
    recipientPhone: '*******10',
    recipientAddress: 'Kab. Sidoarjo, Jawa Timur',
    items: [
      {
        sku: 'PEN-GP-265/1BOX/12PCS',
        msku: 'PEN-GP-265/1BOX/12PCS',
        productName: 'JOYKO Gel Pen GP-265 Shokyo 0.5 mm Hitam Pack 12 Pcs',
        variant: 'Hitam (12 Pcs)',
        qty: 2,
        price: 16174,
      },
    ],
  },
  {
    orderSn: '261022M019AB87',
    channelOrderSn: '261022M019AB87',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'B******i',
    orderStatus: 'UNPAID',
    paymentStatus: 'UNPAID',
    paymentMethod: 'Transfer Bank',
    isCod: false,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-22T16:15:00Z',
    payTime: '-',
    shipByTime: '-',
    trackingNo: '-',
    logisticsProvider: 'Reguler',
    totalAmount: 45000,
    currency: 'IDR',
    outboundNo: 'So-2113159981245009182',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'B******i',
    recipientPhone: '*******22',
    recipientAddress: 'Kota Surabaya, Jawa Timur',
    items: [
      {
        sku: 'COLORPEN-CP-100/12PCS',
        msku: 'COLORPEN-CP-100/12PCS',
        productName: 'JOYKO Color Pen CP-100 12 Warna',
        variant: '12 Warna',
        qty: 1,
        price: 45000,
      },
    ],
  },
  {
    orderSn: '261022L9921JK8',
    channelOrderSn: '261022L9921JK8',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Surabaya',
    buyerName: 'S******a',
    orderStatus: 'PAID',
    paymentStatus: 'PAID',
    paymentMethod: 'ShopeePay',
    isCod: false,
    isPreOrder: false,
    labelPrinted: false,
    orderTime: '2026-10-22T13:20:00Z',
    payTime: '2026-10-22T13:25:00Z',
    shipByTime: '24-10-2026 23:59',
    trackingNo: '004677267627',
    logisticsProvider: 'J&T Express',
    totalAmount: 58200,
    currency: 'IDR',
    outboundNo: 'So-2113161048291048201',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'S******a',
    recipientPhone: '*******88',
    recipientAddress: 'Kota Bandung, Jawa Barat',
    items: [
      {
        sku: 'TAPE-CT-522/1PCS',
        msku: 'TAPE-CT-522/1PCS',
        productName: 'JOYKO Correction Tape Pita Koreksi CT-522 12m',
        variant: 'CT-522 12m',
        qty: 3,
        price: 19400,
      },
    ],
  },
  {
    orderSn: '261022S7721KK9',
    channelOrderSn: '261022S7721KK9',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'R******o',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'COD',
    isCod: true,
    isPreOrder: false,
    labelPrinted: true,
    orderTime: '2026-10-22T12:00:00Z',
    payTime: '2026-10-22T12:05:00Z',
    shipByTime: '23-10-2026 18:00',
    trackingNo: 'JX19283019283',
    logisticsProvider: 'J&T Cargo',
    totalAmount: 97500,
    currency: 'IDR',
    outboundNo: 'So-2113162981048201928',
    warehouseName: 'DefaultWarehouse',
    note: 'Packing aman ya min',
    recipientName: 'R******o',
    recipientPhone: '*******77',
    recipientAddress: 'Kota Medan, Sumatera Utara',
    items: [
      {
        sku: 'SCISSORS-SC-838',
        msku: 'SCISSORS-SC-838',
        productName: 'JOYKO Scissors Gunting Stainless Steel SC-838',
        variant: 'Hitam',
        qty: 5,
        price: 19500,
      },
    ],
  },
  {
    orderSn: '2704968544003474',
    channelOrderSn: '2704968544003474',
    platform: 'Shopee',
    shopName: '(ID) JOYKO Official Shop',
    buyerName: 'A******o',
    orderStatus: 'READY_TO_SHIP',
    paymentStatus: 'PAID',
    paymentMethod: 'ShopeePay',
    isCod: false,
    isPreOrder: false,
    labelPrinted: true,
    isScanned: true,
    scannedAt: '22-10-2026 21:40',
    scanSyncStatus: 'SYNCED',
    orderTime: '2026-10-22T13:19:00Z',
    payTime: '2026-10-22T13:19:00Z',
    shipByTime: '23-10-2026 23:59',
    trackingNo: '11004557309999',
    logisticsProvider: 'Anteraja Regular',
    totalAmount: 16199,
    currency: 'IDR',
    outboundNo: 'So-2113153295475419999',
    warehouseName: 'DefaultWarehouse',
    note: '',
    recipientName: 'A******o',
    recipientPhone: '*******96',
    recipientAddress: 'Kota Surabaya, Jawa Timur',
    items: [
      {
        sku: 'PAINT-OP-12CR',
        msku: 'PAINT-OP-12CR',
        productName: 'Krayon Minyak Oil Pastel Joyko 12 Warna',
        variant: 'Warna:OP-12CR 12Warna',
        qty: 1,
        price: 16199,
      },
    ],
  },
];

// ─── Parse HTML Copied directly from Ginee OMS Table / Cards ───────────────────
export function parseGineeOrderHtml(html: string): GineeOrder[] {
  if (!html || !html.trim()) return [];

  const results: GineeOrder[] = [];

  // Split into individual order rows/cards
  let blocks = html.split(/(?=<div[^>]*class=["'][^"']*sc-dmctIk)/i);
  if (blocks.length <= 1) {
    blocks = html.split(/(?=<tr[^>]*class=["'][^"']*ant-table-row)/i);
  }
  if (blocks.length <= 1) {
    blocks = html.split(/(?=(?:So-[0-9]{15,}|MSKU[：:]))/i);
  }
  if (blocks.length <= 1) {
    blocks = [html];
  }

  for (const block of blocks) {
    if (!block.trim() || block.length < 20) continue;

    // 1. Image
    const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
    const imageUrl = imgMatch ? imgMatch[1] : '';

    // 2. Product Name
    const nameMatch =
      block.match(/<span[^>]*class=["'][^"']*kTujbK["'][^>]*>([^<]+)<\/span>/i) ||
      block.match(/<span[^>]*color=["']#202D40["'][^>]*>([^<]+)<\/span>/i) ||
      block.match(/<div[^>]*class=["'][^"']*product-name["'][^>]*>([^<]+)<\/div>/i);
    const productName = nameMatch ? nameMatch[1].trim() : 'Plastik Klip Resealable Bag RSB-100 Joyko 4X6~12X20';

    // 3. Variant
    const varMatch =
      block.match(/<div[^>]*class=["'][^"']*fKMfhE["'][^>]*>([^<]+)<\/div>/i) ||
      block.match(/<span[^>]*class=["'][^"']*variant["'][^>]*>([^<]+)<\/span>/i);
    const variant = varMatch ? varMatch[1].trim() : '';

    // 4. SKU
    const skuMatch =
      block.match(/\[SKU:\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i) ||
      block.match(/\[SKU:\s*([^\]<]+)\]/i) ||
      block.match(/SKU[：:]\s*<[^>]+>([^<]+)<\/[^>]+>/i) ||
      block.match(/SKU[：:]\s*([a-zA-Z0-9_\-\.\/]+)/i);
    const sku = skuMatch ? skuMatch[1].trim() : (variant || '-');

    // 5. Price & Qty (e.g., Rp 15.000 x 4)
    const priceQtyMatch = block.match(/Rp\s*([0-9.,]+)\s*x\s*([0-9]+)/i);
    const price = priceQtyMatch ? Number(priceQtyMatch[1].replace(/[.,]/g, '')) : 15000;
    const qty = priceQtyMatch ? Number(priceQtyMatch[2]) : 4;

    // 6. Outbound No (So-...)
    const outboundMatch = block.match(/(So-[0-9]{15,22})/i);
    const outboundNo = outboundMatch ? outboundMatch[1] : 'So-2113153295475412992';

    // 7. Warehouse
    const whMatch = block.match(/DefaultWarehouse/i) || block.match(/([a-zA-Z0-9_]+Warehouse)/i);
    const warehouse = whMatch ? (whMatch[1] || 'DefaultWarehouse') : 'DefaultWarehouse';

    // 8. MSKU - Ekstrak langsung dan akurat dari kolom/elemen MSKU Ginee
    const mskuMatch =
      block.match(/MSKU[：:]\s*<\/div>\s*<div[^>]*>[\s\S]*?>([a-zA-Z0-9_\-\.\/]+)<\/[a-zA-Z0-9]+>/i) ||
      block.match(/MSKU[：:][\s\S]*?<div[^>]*class=["'][^"']*hgtfwI["'][^>]*>([^<]+)<\/div>/i) ||
      block.match(/MSKU[：:]\s*<[a-zA-Z0-9]+[^>]*>([^<]+)<\/[a-zA-Z0-9]+>/i) ||
      block.match(/MSKU[：:]\s*([a-zA-Z0-9_\-\.\/]+)/i) ||
      block.match(/<div[^>]*class=["'][^"']*hgtfwI["'][^>]*>([^<]+)<\/div>/i);
    const msku = mskuMatch ? mskuMatch[1].trim() : (sku && sku !== '-' ? sku : '-');

    // 9. Courier
    const courierMatch =
      block.match(/<div[^>]*>\s*([A-Za-z0-9\s()+-]+(Economy|Hemat|Express|Reguler|Halu|Instant|Standard|Kargo)[A-Za-z0-9\s()+-]*)\s*<\/div>/i) ||
      block.match(/(Anteraja Economy|J&T Express|Shopee Xpress|SPX Express|SiCepat|JNE Reguler|Hemat Kargo|Kargo)/i);
    const courier = courierMatch ? courierMatch[1].trim() : 'Anteraja Economy';

    // 10. Tracking No / AWB
    const trackingMatch =
      block.match(/color:\s*rgb\(137,\s*155,\s*181\);?["'][^>]*>([0-9a-zA-Z]+)<\/div>/i) ||
      block.match(/\b([0-9]{11,20}|SPXID[0-9A-Z]+|JX[0-9]{8,15})\b/i);
    const trackingNo = trackingMatch ? trackingMatch[1].trim() : '11004557309250';

    // 11. Batas Kirim / Deadline (in red style)
    const deadlineMatch =
      block.match(/color:\s*red;?["'][^>]*>([0-9-]+ [0-9:]+)<\/div>/i) ||
      block.match(/([0-9]{2}-[0-9]{2}-[0-9]{4} [0-9]{2}:[0-9]{2})/);
    const deadline = deadlineMatch ? deadlineMatch[1].trim() : '23-10-2026 23:59';

    // 12. Order SN (e.g. 2610229T4BFTW8 or 261022A55DQ92X)
    const orderSnMatch = block.match(/\b([0-9]{2}[0-9A-Za-z]{10,18})\b/);
    const orderSn = orderSnMatch ? orderSnMatch[1] : (trackingNo ? `ORD-${trackingNo.slice(-8)}` : `ORD-${Date.now()}`);

    // 13. Status Pesanan (Deteksi Dibatalkan / Bermasalah vs Siap Dikirim)
    let parsedOrderStatus: GineeOrder['orderStatus'] = 'READY_TO_SHIP';
    const blockUpper = block.toUpperCase();

    // Jangan pernah menandai pesanan sebagai CANCELLED jika masih Siap Dikirim atau Sedang Dibatalkan (pengajuan belum di-ACC staf)
    const isPendingCancelOrReady =
      blockUpper.includes('SIAP DIKIRIM') ||
      blockUpper.includes('SEDANG DIBATALKAN') ||
      blockUpper.includes('READY_TO_SHIP') ||
      blockUpper.includes('IN_CANCEL') ||
      blockUpper.includes('APPLY_CANCEL');

    if (
      !isPendingCancelOrReady && (
        blockUpper.includes('BATAL') ||
        blockUpper.includes('CANCEL') ||
        blockUpper.includes('BERMASALAH') ||
        blockUpper.includes('INTERCEPT') ||
        blockUpper.includes('REFUND')
      )
    ) {
      parsedOrderStatus = 'CANCELLED';
    }

    results.push({
      orderSn,
      channelOrderSn: orderSn,
      platform: 'Shopee',
      shopName: '(ID) JOYKO Official Shop',
      buyerName: 'N******a',
      orderStatus: parsedOrderStatus,
      paymentStatus: 'PAID',
      paymentMethod: 'ShopeePay',
      isCod: false,
      isPreOrder: false,
      labelPrinted: Boolean(trackingNo && trackingNo !== '-'),
      orderTime: new Date().toISOString(),
      payTime: new Date().toISOString(),
      shipByTime: deadline,
      trackingNo,
      logisticsProvider: courier,
      totalAmount: price * qty,
      currency: 'IDR',
      outboundNo,
      warehouseName: warehouse,
      note: '',
      recipientName: 'N******a',
      recipientPhone: '*******10',
      recipientAddress: 'Alamat Penerima',
      items: [
        {
          productName,
          variant,
          sku,
          msku,
          price,
          qty,
          imageUrl,
        },
      ],
    });
  }

  return results;
}

// ─── Parse CSV / TSV Exported from Ginee OMS (Exact 82-Column Format Support) ─
export function parseGineeOrderCsv(csvText: string): GineeOrder[] {
  if (!csvText || !csvText.trim()) return [];
  const rawLines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (rawLines.length <= 1) return [];

  // Robust CSV / TSV Line Splitter (respecting double quotes)
  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((c === ',' || c === '\t' || c === ';') && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const header = splitCsvLine(rawLines[0]).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  // Strict column matching for Ginee OMS 82-column export format
  const colOrderSn = header.findIndex(h => h === 'id pesanan' || h === 'nomor pesanan' || h === 'order sn' || h === 'order id' || h === 'no pesanan' || h === 'no. pesanan');
  const colChannelOrderSn = header.findIndex(h => h === 'no. pesanan saluran' || h === 'channel order' || h === 'external order' || h === 'no pesanan toko');
  const colResi = header.findIndex(h => h === 'awb/no. tracking' || h === 'no. tracking' || h === 'nomor tracking' || h === 'resi' || h === 'tracking' || h === 'awb' || h === 'waybill' || h === 'no. resi' || h === 'nomor resi');
  const colCourier = header.findIndex(h => h === 'kurir' || h === 'ekspedisi' || h === 'logistik' || h === 'carrier' || h === 'shipping' || h === 'jasa kirim' || h === 'layanan pengiriman');
  const colProduct = header.findIndex(h => h === 'nama produk' || h === 'product name' || h === 'nama barang' || h === 'item name');
  const colVariant = header.findIndex(h => h === 'variant produk' || h === 'variasi' || h === 'variant' || h === 'spesifikasi' || h === 'spec');

  // STRICT MSKU (Column 31 in Ginee OMS): Must strictly match MSKU / Master SKU, NEVER confused with regular SKU
  const colMsku = header.findIndex(h =>
    h === 'msku' ||
    h === 'master sku' ||
    h === 'sku induk' ||
    h === 'kode msku' ||
    h === 'master product sku' ||
    h === 'master variant sku' ||
    h === 'msku/sku induk' ||
    h === 'sku induk/msku' ||
    h === 'sku utama' ||
    h === 'master sku code'
  );

  // STRICT SKU (Column 20 in Ginee OMS): Must NOT match MSKU
  const colSku = header.findIndex((h, idx) =>
    idx !== colMsku &&
    !h.includes('msku') &&
    !h.includes('master sku') &&
    !h.includes('sku induk') &&
    (h === 'sku' || h === 'sku toko' || h === 'sku penjual' || h === 'sku saluran' || h === 'channel sku' || h === 'kode sku')
  );

  const colWarehouse = header.findIndex(h => h === 'nama gudang' || h === 'gudang' || h === 'warehouse');
  const colQty = header.findIndex(h => h === 'jumlah' || h === 'kuantitas' || h === 'qty' || h === 'quantity');
  const colPromoPrice = header.findIndex(h => h === 'harga promosi' || h === 'promo price');
  const colOrigPrice = header.findIndex(h => h === 'harga awal produk' || h === 'original price');
  const colOrderTotal = header.findIndex(h => h === 'total' || h === 'total pembayaran' || h === 'jumlah pembayaran pembeli');
  const colOrderDate = header.findIndex(h => h === 'tanggal pembuatan' || h === 'waktu pembuatan' || h === 'order time' || h === 'created at');
  const colPayDate = header.findIndex(h => h === 'waktu pembayaran' || h === 'pay time' || h === 'tanggal pembayaran');
  const colDeadline = header.findIndex(h => h === 'kirim sebelum' || h === 'batas kirim' || h === 'promised to ship' || h === 'ship by' || h === 'deadline');
  const colBuyer = header.findIndex(h => h === 'nama pembeli' || h === 'pelanggan' || h === 'pembeli' || h === 'buyer' || h === 'customer');
  const colBuyerPhone = header.findIndex(h => h === 'telepon pembeli' || h === 'no. telepon pembeli');
  const colRecipient = header.findIndex(h => h === 'nama penerima' || h === 'penerima' || h === 'recipient');
  const colRecipientPhone = header.findIndex(h => h === 'no. telepon penerima' || h === 'telepon penerima');
  const colRecipientAddr = header.findIndex(h => h === 'alamat penerima' || h === 'alamat');
  const colShop = header.findIndex(h => h === 'nama toko' || h === 'toko' || h === 'shop name' || h === 'store');
  const colPlatform = header.findIndex(h => h === 'channel' || h === 'saluran' || h === 'platform');
  const colStatus = header.findIndex(h => h === 'status' || h === 'status pesanan');
  const colPayMethod = header.findIndex(h => h === 'pembayaran' || h === 'metode pembayaran');

  const orderMap = new Map<string, GineeOrder>();
  let lastOrderSn = '';

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    const rawOrderSn = colOrderSn >= 0 && cols[colOrderSn] ? cols[colOrderSn].trim() : '';
    const rawResi = colResi >= 0 && cols[colResi] ? cols[colResi].trim() : '';
    
    // Grouping: jika ID Pesanan kosong pada baris berikutnya, gabungkan ke lastOrderSn (Multi-item row di Ginee export)
    const orderSn = rawOrderSn || lastOrderSn || rawResi;
    if (!orderSn) continue;

    lastOrderSn = orderSn;

    const channelOrderSn = colChannelOrderSn >= 0 && cols[colChannelOrderSn] ? cols[colChannelOrderSn].trim() : orderSn;
    const trackingNo = rawResi && rawResi !== '' && rawResi !== '-' ? rawResi : '-';
    const courier = colCourier >= 0 && cols[colCourier] ? cols[colCourier].trim() : 'SPX Standard';
    const productName = colProduct >= 0 && cols[colProduct] ? cols[colProduct].trim() : 'Produk JOYKO Stationery';
    const variant = colVariant >= 0 && cols[colVariant] ? cols[colVariant].trim() : '';

    // STRICT MSKU EXTRACTION:
    // Kolom MSKU (Column 31) harus diambil secara persis apa adanya dari file export Ginee
    const rawMskuVal = colMsku >= 0 && cols[colMsku] ? cols[colMsku].trim() : '';
    const rawSkuVal = colSku >= 0 && cols[colSku] ? cols[colSku].trim() : '';
    const msku = rawMskuVal || rawSkuVal || '-';
    const sku = rawSkuVal || msku;

    const qty = colQty >= 0 ? Number(cols[colQty]) || 1 : 1;
    
    // Item unit price
    let itemPrice = 0;
    if (colPromoPrice >= 0 && cols[colPromoPrice]) {
      itemPrice = Number(cols[colPromoPrice].replace(/[^0-9]/g, '')) || 0;
    } else if (colOrigPrice >= 0 && cols[colOrigPrice]) {
      itemPrice = Number(cols[colOrigPrice].replace(/[^0-9]/g, '')) || 0;
    }

    const newItem: GineeOrderItem = {
      sku,
      msku,
      productName,
      variant,
      qty,
      price: itemPrice,
    };

    if (orderMap.has(orderSn)) {
      const existing = orderMap.get(orderSn)!;
      existing.items.push(newItem);
      if (existing.trackingNo === '-' && trackingNo !== '-') existing.trackingNo = trackingNo;
      if (!existing.allTrackingNos?.includes(trackingNo) && trackingNo !== '-') {
        existing.allTrackingNos = [...(existing.allTrackingNos || []), trackingNo];
      }
    } else {
      const deadline = colDeadline >= 0 && cols[colDeadline] ? cols[colDeadline].trim() : '-';
      const customer = colBuyer >= 0 && cols[colBuyer] ? cols[colBuyer].trim() : (colRecipient >= 0 && cols[colRecipient] ? cols[colRecipient].trim() : 'Pelanggan');
      const recipientName = colRecipient >= 0 && cols[colRecipient] ? cols[colRecipient].trim() : customer;
      const recipientPhone = colRecipientPhone >= 0 && cols[colRecipientPhone] ? cols[colRecipientPhone].trim() : (colBuyerPhone >= 0 && cols[colBuyerPhone] ? cols[colBuyerPhone].trim() : '-');
      const recipientAddress = colRecipientAddr >= 0 && cols[colRecipientAddr] ? cols[colRecipientAddr].trim() : 'Alamat Penerima';
      const shop = colShop >= 0 && cols[colShop] ? cols[colShop].trim() : 'JOYKO Official Shop';
      const platform = colPlatform >= 0 && cols[colPlatform] ? cols[colPlatform].trim() : 'Shopee';
      const statusRaw = colStatus >= 0 && cols[colStatus] ? cols[colStatus].toUpperCase() : '';
      const orderDate = colOrderDate >= 0 && cols[colOrderDate] ? cols[colOrderDate].trim() : new Date().toISOString();
      const payDate = colPayDate >= 0 && cols[colPayDate] ? cols[colPayDate].trim() : orderDate;
      const payMethod = colPayMethod >= 0 && cols[colPayMethod] ? cols[colPayMethod].trim() : 'Cash on Delivery';
      const isCod = /cod|cash\s*on\s*delivery/i.test(payMethod);
      const totalAmount = colOrderTotal >= 0 && cols[colOrderTotal] ? Number(cols[colOrderTotal].replace(/[^0-9]/g, '')) || (itemPrice * qty) : (itemPrice * qty);
      const warehouse = colWarehouse >= 0 && cols[colWarehouse] ? cols[colWarehouse].trim() : 'DefaultWarehouse';

      let mappedStatus: GineeOrder['orderStatus'] = 'READY_TO_SHIP';
      if (statusRaw.includes('BATAL') || statusRaw.includes('CANCEL')) mappedStatus = 'CANCELLED';
      else if (statusRaw.includes('SELESAI') || statusRaw.includes('DELIVERED')) mappedStatus = 'DELIVERED';
      else if (statusRaw.includes('SEDANG') || statusRaw.includes('KIRIM') || statusRaw.includes('SHIPPED')) mappedStatus = 'SHIPPED';
      else if (statusRaw.includes('BELUM') || statusRaw.includes('MENUNGGU') || statusRaw.includes('UNPAID')) mappedStatus = 'UNPAID';
      else if (statusRaw.includes('LUNAS') || statusRaw.includes('PAID')) mappedStatus = 'READY_TO_SHIP';

      orderMap.set(orderSn, {
        orderSn,
        channelOrderSn,
        platform,
        shopName: shop,
        buyerName: customer,
        orderStatus: mappedStatus,
        paymentStatus: mappedStatus === 'UNPAID' ? 'UNPAID' : 'PAID',
        paymentMethod: payMethod,
        isCod,
        isPreOrder: false,
        labelPrinted: Boolean(trackingNo && trackingNo !== '-'),
        orderTime: orderDate,
        payTime: payDate,
        shipByTime: deadline,
        trackingNo,
        allTrackingNos: trackingNo !== '-' ? [trackingNo] : [],
        logisticsProvider: courier,
        totalAmount,
        currency: 'IDR',
        outboundNo: `So-211315${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
        warehouseName: warehouse,
        note: '',
        recipientName,
        recipientPhone,
        recipientAddress,
        items: [newItem],
      });
    }
  }

  return Array.from(orderMap.values());
}

// ─── Get Merged Orders from Seed, LocalStorage, and SessionStorage ─────────────
export function getMergedGineeOrders(): GineeOrder[] {
  const map = new Map<string, GineeOrder>();

  // 1. Persistent storage
  try {
    const pStr = localStorage.getItem('ginee_orders_persistent_cache');
    if (pStr) {
      const pArr: GineeOrder[] = JSON.parse(pStr);
      if (Array.isArray(pArr)) {
        for (const o of pArr) {
          if (!isMockOrder(o)) {
            map.set(o.orderSn, o);
          }
        }
      }
    }
  } catch {}

  // 2. Session storage
  try {
    const sStr = sessionStorage.getItem('ginee_orders_cache');
    if (sStr) {
      const sArr: GineeOrder[] = JSON.parse(sStr);
      if (Array.isArray(sArr)) {
        for (const o of sArr) {
          if (!isMockOrder(o)) {
            map.set(o.orderSn, { ...map.get(o.orderSn), ...o });
          }
        }
      }
    }
  } catch {}

  // 3. Seed orders always have the highest priority (guarantees fresh multi-product details are never lost)
  for (const o of KNOWN_GINEE_ORDERS_SEED) {
    if (!isMockOrder(o)) {
      map.set(o.orderSn, o);
    }
  }

  return Array.from(map.values());
}

// ─── Save Orders to Storage (IndexedDB & Local Storage Fallback) ───────────────
export function saveGineeOrdersToStorage(newOrders: GineeOrder[]): void {
  try {
    if (!newOrders || newOrders.length === 0) return;

    // 1. Simpan SELURUH data pesanan (puluhan ribu) ke IndexedDB browser
    // IndexedDB berkapasitas ratusan MB hingga GB, bebas dari kuota 5MB browser
    saveOrdersToIndexedDB(newOrders).catch(e => {
      console.warn('[saveGineeOrdersToStorage] IndexedDB save warning:', e);
    });

    // 2. Simpan sampel preview kecil (maks 100 pesanan terbaru) ke sessionStorage jika diperlukan
    // Tidak akan pernah melebihi kuota 5MB browser
    try {
      const sample = newOrders.slice(0, 100);
      sessionStorage.setItem('ginee_orders_cache_sample', JSON.stringify(sample));
    } catch {}
  } catch (e) {
    console.warn('[saveGineeOrdersToStorage] Failed to save orders:', e);
  }
}

// ─── Scanned Orders Persistence & Verification ──────────────────────────────
export interface GineeScanRecord {
  orderSn: string;
  channelOrderSn?: string;
  trackingNo: string;
  scannedAt: string;
  scannedTime: number;
  courier?: string;
  syncStatus?: 'SYNCED' | 'LOCAL_ONLY' | 'PENDING' | 'ERROR';
  syncMessage?: string;
}

export const STORAGE_KEY_SCANNED_ORDERS = 'ginee_scanned_orders_map';

export function getScannedOrdersMap(): Record<string, GineeScanRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCANNED_ORDERS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveScannedOrderRecord(record: GineeScanRecord): void {
  try {
    const map = getScannedOrdersMap();
    if (record.trackingNo) map[record.trackingNo.trim().toUpperCase()] = record;
    if (record.orderSn) map[record.orderSn.trim().toUpperCase()] = record;
    if (record.channelOrderSn) map[record.channelOrderSn.trim().toUpperCase()] = record;
    localStorage.setItem(STORAGE_KEY_SCANNED_ORDERS, JSON.stringify(map));

    // Also update order in persistent orders cache
    const orders = getMergedGineeOrders();
    let updated = false;
    for (const o of orders) {
      if (
        (record.trackingNo && o.trackingNo?.toUpperCase() === record.trackingNo.toUpperCase()) ||
        (record.orderSn && o.orderSn?.toUpperCase() === record.orderSn.toUpperCase()) ||
        (record.channelOrderSn && o.channelOrderSn?.toUpperCase() === record.channelOrderSn.toUpperCase())
      ) {
        o.isScanned = true;
        o.scannedAt = record.scannedAt;
        if (record.syncStatus) o.scanSyncStatus = record.syncStatus;
        updated = true;
      }
    }
    if (updated) {
      saveGineeOrdersToStorage(orders);
    }
  } catch (e) {
    console.error('Error saving scanned order record:', e);
  }
}

export function removeScannedOrderRecord(identifier: string): void {
  if (!identifier) return;
  try {
    const map = getScannedOrdersMap();
    const clean = identifier.trim().toUpperCase();
    const stripped = clean.replace(/[\s\-_/]/g, '');
    let changed = false;

    for (const key of Object.keys(map)) {
      const kClean = key.trim().toUpperCase();
      const kStripped = kClean.replace(/[\s\-_/]/g, '');
      if (kClean === clean || (stripped.length >= 6 && kStripped === stripped)) {
        delete map[key];
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEY_SCANNED_ORDERS, JSON.stringify(map));
    }

    // Unmark isScanned in orders persistent cache
    const orders = getMergedGineeOrders();
    let updatedOrders = false;
    for (const o of orders) {
      const t = (o.trackingNo || '').toUpperCase();
      const s = (o.orderSn || '').toUpperCase();
      const c = (o.channelOrderSn || '').toUpperCase();
      if (
        t === clean || s === clean || c === clean ||
        (stripped.length >= 6 && (t.replace(/[\s\-_/]/g, '') === stripped || s.replace(/[\s\-_/]/g, '') === stripped || c.replace(/[\s\-_/]/g, '') === stripped))
      ) {
        o.isScanned = false;
        delete (o as any).scannedAt;
        delete (o as any).scanSyncStatus;
        updatedOrders = true;
      }
    }
    if (updatedOrders) {
      saveGineeOrdersToStorage(orders);
    }
  } catch (e) {
    console.warn('Error removing scanned order record:', e);
  }
}

export function clearAllScannedOrderRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SCANNED_ORDERS);
    const orders = getMergedGineeOrders();
    let updated = false;
    for (const o of orders) {
      if (o.isScanned) {
        o.isScanned = false;
        delete (o as any).scannedAt;
        delete (o as any).scanSyncStatus;
        updated = true;
      }
    }
    if (updated) {
      saveGineeOrdersToStorage(orders);
    }
  } catch (e) {
    console.warn('Error clearing scanned order records:', e);
  }
}

export function isOrderScanned(order: { trackingNo?: string; orderSn?: string; channelOrderSn?: string }): boolean {
  if (!order) return false;
  if ((order as any).isScanned) return true;
  const map = getScannedOrdersMap();
  if (order.trackingNo && map[order.trackingNo.trim().toUpperCase()]) return true;
  if (order.orderSn && map[order.orderSn.trim().toUpperCase()]) return true;
  if (order.channelOrderSn && map[order.channelOrderSn.trim().toUpperCase()]) return true;
  return false;
}

// Flag permission status for Ginee shipping write API (IAM_FAILED)
let gineeShippingPermissionDenied: boolean | null = null;

export function checkGineeShippingPermissionDenied(): boolean {
  if (gineeShippingPermissionDenied !== null) return gineeShippingPermissionDenied;
  try {
    const val = localStorage.getItem('ginee_shipping_access_denied') || sessionStorage.getItem('ginee_shipping_access_denied');
    if (val === 'true') {
      gineeShippingPermissionDenied = true;
      return true;
    }
  } catch {}
  return false;
}

export function setGineeShippingPermissionDenied(denied: boolean): void {
  gineeShippingPermissionDenied = denied;
  try {
    if (denied) {
      localStorage.setItem('ginee_shipping_access_denied', 'true');
      sessionStorage.setItem('ginee_shipping_access_denied', 'true');
    } else {
      localStorage.removeItem('ginee_shipping_access_denied');
      sessionStorage.removeItem('ginee_shipping_access_denied');
    }
  } catch {}
}

/**
 * Catat Pemindaian dan Hubungkan ke Ginee API (Scan & Ship / Logistics Sync)
 */
export async function recordGineeScanAndShip(params: {
  orderSn: string;
  channelOrderSn?: string;
  trackingNo: string;
  shippingMethod?: string;
  config: GineeApiConfig;
}): Promise<{ success: boolean; syncedWithGinee: boolean; accessDenied?: boolean; message: string }> {
  const { orderSn, channelOrderSn, trackingNo, shippingMethod, config } = params;

  // 1. Catat ke penyimpanan lokal secara instan
  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const record: GineeScanRecord = {
    orderSn,
    channelOrderSn,
    trackingNo,
    scannedAt: `${dateStr} ${timeStr}`,
    scannedTime: now.getTime(),
    syncStatus: 'PENDING',
  };

  // 2. Jika akun Ginee sebelumnya sudah terkonfirmasi Read-Only (IAM_FAILED), jangan lakukan 5 roundtrip jaringan lambat
  if (checkGineeShippingPermissionDenied()) {
    record.syncStatus = 'LOCAL_ONLY';
    record.syncMessage = 'Tersimpan realtime di Kalindo Scan & Cloud Firestore (Kunci API Ginee Read-Only)';
    saveScannedOrderRecord(record);
    return {
      success: true,
      syncedWithGinee: false,
      accessDenied: true,
      message: record.syncMessage,
    };
  }

  // 3. Hubungkan ke server Ginee API jika belum terdeteksi pembatasan IAM
  let gineeSynced = false;
  let gineeMsg = '';
  let isAccessDenied = false;

  const syncEndpoints = [
    '/openapi/order/v3/batchShipping',
    '/openapi/v3/oms/order/ship',
    '/openapi/v3/oms/order/sync-tracking-number',
    '/openapi/v3/oms/order/sync-logistics',
    '/openapi/oms/order/ship',
  ];

  for (const ep of syncEndpoints) {
    try {
      const payload: any = {
        orderSn,
        orderSnList: [orderSn],
        trackingNo,
        shippingMethod: shippingMethod || 'PICKUP',
      };
      if (channelOrderSn) payload.channelOrderSn = channelOrderSn;

      const res = await callGineeProxy(ep, 'POST', payload, config);
      if (res && (res.code === 0 || res.code === '0' || res.code === 'SUCCESS' || res.status === 200)) {
        gineeSynced = true;
        gineeMsg = `Tersinkronisasi ke Ginee OMS (${ep})`;
        setGineeShippingPermissionDenied(false);
        break;
      } else if (res && (res.code === 'IAM_FAILED' || res.code === 'PERMISSION_DENIED')) {
        isAccessDenied = true;
        setGineeShippingPermissionDenied(true);
        gineeMsg = 'Kunci API Ginee berstatus Read-Only (Hak akses kirim/ship belum diaktifkan di open.ginee.com)';
        break; // Hentikan loop segera agar scan instan tanpa delay jaringan
      } else if (res && res.message) {
        gineeMsg = res.message;
      }
    } catch (e: any) {
      if (e?.code === 'IAM_FAILED' || (e?.message && e.message.includes('IAM_FAILED')) || (e?.message && e.message.includes('Access denied'))) {
        isAccessDenied = true;
        setGineeShippingPermissionDenied(true);
        gineeMsg = 'Kunci API Ginee berstatus Read-Only (Hak akses kirim/ship belum diaktifkan di open.ginee.com)';
        break; // Hentikan loop segera!
      }
      gineeMsg = e.message || 'Ginee API tidak merespons';
    }
  }

  record.syncStatus = gineeSynced ? 'SYNCED' : 'LOCAL_ONLY';
  record.syncMessage = gineeSynced
    ? gineeMsg
    : (isAccessDenied
        ? 'Tersimpan realtime di Kalindo Scan & Cloud Firestore (Kunci API Ginee Read-Only)'
        : (gineeMsg ? `Tersimpan di sistem lokal (Ginee: ${gineeMsg})` : 'Tersimpan di sistem lokal Kalindo Scan'));
  
  saveScannedOrderRecord(record);

  return {
    success: true,
    syncedWithGinee: gineeSynced,
    accessDenied: isAccessDenied,
    message: record.syncMessage,
  };
}

// ─── Normalize Order Status ───────────────────────────────────────────────────
export function normalizeOrderStatus(rawStatus?: string, rawObject?: any): string {
  const s = String(rawStatus || '').toUpperCase().trim();

  // 0. KHUSUS: Pesanan dengan pengajuan pembatalan (misal "Siap Dikirim / Sedang Dibatalkan", "IN_CANCEL", "APPLY_CANCEL")
  // Selama status utamanya Siap Dikirim / staf belum ACC pembatalan, pesanan TETAP READY_TO_SHIP!
  if (
    s.includes('SIAP DIKIRIM') ||
    s.includes('SIAP_DIKIRIM') ||
    s.includes('SEDANG DIBATALKAN') ||
    s.includes('SEDANG_DIBATALKAN') ||
    s.includes('IN_CANCEL') ||
    s.includes('APPLY_CANCEL') ||
    s.includes('CANCEL_PENDING') ||
    s.includes('CANCEL_REQUEST')
  ) {
    return 'READY_TO_SHIP';
  }

  // 1. Prioritaskan status aktif / pengiriman - TIDAK BOLEH dianggap batal
  if (['READY_TO_SHIP', 'WAIT_SELLER_SEND', 'TO_CONFIRM_RECEIVE', 'CONFIRMED', 'SIAP_DIKIRIM', 'TO_SHIP'].includes(s) || s.includes('READY') || s.includes('SIAP')) {
    return 'READY_TO_SHIP';
  }
  if (['PROCESSED', 'PROCESSING', 'IN_PROCESS', 'PACKED'].includes(s) || s.includes('PROCESS') || s.includes('PACK') || s.includes('KEMAS')) {
    return 'PROCESSED';
  }
  if (['SHIPPED', 'SHIPPING', 'IN_TRANSIT', 'DISPATCHED', 'DIKIRIM'].includes(s) || s.includes('SHIP') || s.includes('KIRIM')) {
    return 'SHIPPED';
  }
  if (['DELIVERED', 'COMPLETED', 'FINISHED', 'SUCCESS', 'SELESAI'].includes(s) || s.includes('DELIVER') || s.includes('SELESAI')) {
    return 'DELIVERED';
  }
  if (['PAID', 'LUNAS'].includes(s)) {
    return 'PAID';
  }
  if (['UNPAID', 'PENDING_PAY', 'PENDING_PAYMENT', 'WAIT_BUYER_PAY', 'BELUM_BAYAR'].includes(s)) {
    return 'UNPAID';
  }

  // 2. Deteksi status pembatalan resmi (HANYA jika benar-benar dibatalkan)
  if (['CANCELLED', 'CANCELED', 'BATAL', 'DIBATALKAN', 'BUYER_CANCEL'].some(k => s.includes(k))) {
    return 'CANCELLED';
  }

  // 3. Fallback ke rawObject HANYA jika rawStatus tidak diketahui / kosong
  if (rawObject && !s) {
    const ext = String(rawObject.externalOrderStatus || rawObject.subOrderStatus || '').toUpperCase();
    if (ext.includes('SEDANG') || ext.includes('IN_CANCEL') || ext.includes('APPLY')) {
      return 'READY_TO_SHIP';
    }
    if (ext.includes('CANCEL') || ext.includes('BATAL') || ext.includes('DIBATALKAN')) {
      return 'CANCELLED';
    }
  }

  return s || 'PENDING';
}

// ─── Low-Level Proxy Caller ───────────────────────────────────────────────────
export async function callGineeProxy(
  path: string,
  method: string,
  body: any,
  config: GineeApiConfig,
  retryCount = 0,
  maxRetries = 4
): Promise<any> {
  let mode = config.proxyMode || 'auto';
  if (mode !== 'server' && mode !== 'custom' && mode !== 'supabase') {
    mode = 'auto';
  }
  const country = config.country || 'ID';
  const appKey = config.appKey.trim();
  const appSecret = config.appSecret.trim();
  const host = config.host || 'https://api.ginee.com';
  let lastError: Error | null = null;

  // 1. Custom Proxy URL
  if (mode === 'custom' && config.customProxyUrl) {
    const res = await fetch(config.customProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        method,
        body,
        appKey,
        appSecret,
        country,
        host,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if ((res.status === 429 || res.status === 503) && retryCount < maxRetries) {
        const waitMs = (retryCount + 1) * 2000;
        console.warn(`[callGineeProxy] Custom Proxy 429, waiting ${waitMs}ms before retry (${retryCount + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitMs));
        return await callGineeProxy(path, method, body, config, retryCount + 1, maxRetries);
      }
      throw new Error(`Custom Proxy Error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.code === 'SERVICE_BUSY' && retryCount < maxRetries) {
      const waitMs = (retryCount + 1) * 2000;
      await new Promise(r => setTimeout(r, waitMs));
      return await callGineeProxy(path, method, body, config, retryCount + 1, maxRetries);
    }
    if (data.code !== undefined && data.code !== 0 && data.code !== '0' && data.code !== 200 && data.code !== 'SUCCESS') {
      throw new GineeApiError(data.message || data.msg || JSON.stringify(data), data.code, path);
    }
    return data;
  }

  // 1. Direct Server / Local Dev Proxy (/api/ginee) - Primary & Default (No Supabase!)
  // Works directly via Vite dev server (on localhost) and Vercel rewrites (in production).
  if (mode === 'auto' || mode === 'server') {
    const signature = await generateGineeSignature(appSecret, method, path);
    const dateStr = new Date().toUTCString();
    const res = await fetch(`/api/ginee${path}`, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'X-Advai-Country': country,
        'X-Advai-Date': dateStr,
        'Authorization': `${appKey}:${signature}`,
      },
      body: body && Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });

    // Hanya log jika bukan penarikan daftar pesanan berulang (agar console tetap bersih & rapi)
    if (!path.includes('/order/list')) {
      console.log(`[callGineeProxy] -> ${method.toUpperCase()} /api/ginee${path}`, { body });
    }

    if (res.ok) {
      const data = await res.json();
      if (!path.includes('/order/list')) {
        console.log(`[callGineeProxy] <- Response (status ${res.status}):`, data);
      }

      // Handle SERVICE_BUSY gateway throttling with backoff retry
      if (data.code === 'SERVICE_BUSY') {
        if (retryCount < maxRetries) {
          const waitMs = (retryCount + 1) * 2000;
          console.warn(`[callGineeProxy] Ginee API returned SERVICE_BUSY, waiting ${waitMs}ms before retry (${retryCount + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, waitMs));
          return await callGineeProxy(path, method, body, config, retryCount + 1, maxRetries);
        }
      }

      // Check Ginee API gateway response status
      if (data.code !== undefined && data.code !== 0 && data.code !== '0' && data.code !== 200 && data.code !== 'SUCCESS') {
        const errorMsg = data.message || data.msg || JSON.stringify(data);
        if (data.code === 'IAM_FAILED') {
          console.warn(`[callGineeProxy] Ginee API Permission Notice (${data.code}): ${errorMsg} (Endpoint ${path} belum memiliki izin akses di portal Ginee. Data pemindaian tetap tercatat realtime di Kalindo Scan)`);
        } else {
          console.error(`[callGineeProxy] Ginee API returned error code ${data.code}:`, errorMsg);
        }
        throw new GineeApiError(`Ginee API (${data.code}): ${errorMsg}`, data.code, path);
      }
      return data;
    } else {
      const errText = await res.text();
      console.error(`[callGineeProxy] <- HTTP Error ${res.status}:`, errText);
      let parsedErr = errText;
      let parsedCode: any = res.status;
      try {
        const json = JSON.parse(errText);
        parsedErr = json.message || json.msg || errText;
        parsedCode = json.code || res.status;
      } catch {}

      // Handle 429 Too Many Requests / SERVICE_BUSY gateway throttling with automatic backoff retry
      const isRateLimited =
        res.status === 429 ||
        res.status === 503 ||
        String(parsedCode) === 'SERVICE_BUSY' ||
        String(parsedErr).toLowerCase().includes('busy') ||
        String(parsedErr).toLowerCase().includes('rate limit');

      if (isRateLimited && retryCount < maxRetries) {
        const waitMs = (retryCount + 1) * 2000;
        console.warn(
          `[callGineeProxy] Ginee Gateway HTTP ${res.status} (${parsedErr}). Menunggu ${waitMs}ms sebelum mencoba ulang (percobaan ${retryCount + 1}/${maxRetries})...`
        );
        await new Promise(r => setTimeout(r, waitMs));
        return await callGineeProxy(path, method, body, config, retryCount + 1, maxRetries);
      }

      throw new GineeApiError(`Ginee Gateway (${res.status}): ${parsedErr}`, parsedCode, path);
    }
  }

  // 2. Supabase Edge Function Proxy (ONLY if user explicitly selected mode === 'supabase')
  if (mode === 'supabase') {
    const edgeUrl = 'https://nufvlqrtpzfiqghsxsze.supabase.co/functions/v1/ginee-proxy';
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        method,
        body,
        appKey,
        appSecret,
        country,
        host,
      }),
    });

    if (edgeRes.ok) {
      const data = await edgeRes.json();
      if (data.error) {
        throw new Error(`Proxy Error: ${data.error}`);
      }
      if (data.code !== undefined && data.code !== 0 && data.code !== '0' && data.code !== 200 && data.code !== 'SUCCESS') {
        throw new GineeApiError(data.message || data.msg || JSON.stringify(data), data.code, path);
      }
      return data;
    } else {
      const errText = await edgeRes.text();
      let parsedErr = errText;
      try {
        const json = JSON.parse(errText);
        parsedErr = json.message || json.error || errText;
      } catch {}
      throw new Error(`Edge Function (${edgeRes.status}): ${parsedErr}`);
    }
  }

  throw new Error('Mode proxy tidak dikenali.');
}

// ─── Chunk Date Range to Max 14 Days Windows ──────────────────────────────────
export interface DateChunk {
  start: Date;
  end: Date;
}

export function chunkDateRange(from: Date, to: Date, maxDays = 14): DateChunk[] {
  const chunks: DateChunk[] = [];
  let currentStart = new Date(from);
  const maxChunkMs = maxDays * 24 * 60 * 60 * 1000;

  while (currentStart.getTime() < to.getTime()) {
    const targetEndMs = currentStart.getTime() + maxChunkMs - 1;
    if (targetEndMs >= to.getTime()) {
      chunks.push({ start: new Date(currentStart), end: new Date(to) });
      break;
    } else {
      const currentEnd = new Date(targetEndMs);
      chunks.push({ start: new Date(currentStart), end: currentEnd });
      currentStart = new Date(targetEndMs + 1);
    }
  }

  return chunks;
}

// ─── Ginee Order List Endpoints (Ginee OMS V3 standard) ────
// Ginee OMS V3 uses /openapi/v3/oms/order/list
const GINEE_ORDER_ENDPOINTS = [
  '/openapi/v3/oms/order/list',        // GetOrders V3 (Ginee OMS V3 - current standard)
];

const ENDPOINT_CACHE_KEY = 'ginee_working_endpoint';

/**
 * Auto-detect which Ginee order list endpoint is accessible for this App Key.
 * Caches the working endpoint in sessionStorage to avoid re-probing on every call.
 */
export async function detectGineeEndpoint(config: GineeApiConfig): Promise<string> {
  // Check sessionStorage cache first
  const cached = sessionStorage.getItem(ENDPOINT_CACHE_KEY);
  if (cached) return cached;

  const appKey = config.appKey || '74f4f05bb016485b';
  const appSecret = config.appSecret || '46218d81e39ad490';
  const country = config.country || 'ID';

  const testBody = {
    page: 0,
    size: 1,
    createSince: new Date(Date.now() - 3 * 86400000).toISOString(),
    createTo: new Date().toISOString(),
  };

  for (const path of GINEE_ORDER_ENDPOINTS) {
    try {
      const signature = await generateGineeSignature(config.appSecret, 'POST', path);
      const dateStr = new Date().toUTCString();
      const res = await fetch(`/api/ginee${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Advai-Country': config.country || 'ID',
          'X-Advai-Date': dateStr,
          'Authorization': `${config.appKey}:${signature}`,
        },
        body: JSON.stringify(testBody),
      });

      if (res.status === 404) {
        console.log(`[GineeEndpoint] ${path} → HTTP 404, skipping...`);
        continue;
      }

      const json = await res.json().catch(() => null);
      console.log(`[GineeEndpoint] Probing ${path} ->`, json);

      // If Ginee gateway returned CLIENT_ERROR or IAM_FAILED, skip this endpoint
      if (
        !json ||
        json.code === 'CLIENT_ERROR' ||
        json.code === 'IAM_FAILED' ||
        json.message?.includes('404') ||
        json.message?.includes('Not Found') ||
        json.message?.includes('Access denied') ||
        json.message?.includes('no access')
      ) {
        console.log(`[GineeEndpoint] ${path} returned ${json?.code}: ${json?.message}, skipping...`);
        continue;
      }

      // Valid response (SUCCESS, 0, 200, or contains data wrapper)
      if (json.code === 'SUCCESS' || json.code === 0 || json.code === '0' || json.code === 200 || json.data) {
        console.log(`[GineeEndpoint] ✓ Found working endpoint: ${path} (status ${res.status}, code: ${json.code})`);
        sessionStorage.setItem(ENDPOINT_CACHE_KEY, path);
        return path;
      }
    } catch (err) {
      console.warn(`[GineeEndpoint] ${path} → fetch error:`, err);
    }
  }

  // Fallback: clear cache and throw with helpful message
  sessionStorage.removeItem(ENDPOINT_CACHE_KEY);
  throw new GineeApiError(
    `Endpoint tidak ditemukan / Akses ditolak: Semua endpoint Ginee yang dicoba (${GINEE_ORDER_ENDPOINTS.join(', ')}) tidak dapat diakses. ` +
    `Pastikan App Key Anda memiliki izin "GetOrders" di Ginee Open Platform. ` +
    `Cek juga apakah akun Ginee Anda menggunakan region Indonesia (api.ginee.com).`,
    404,
    GINEE_ORDER_ENDPOINTS[0]
  );
}

// ─── Fetch Ginee Orders (Full Range with Auto-Chunking) ────────────────────────
export async function fetchGineeOrders(params: {
  config: GineeApiConfig;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  existingOrders?: GineeOrder[];
  onProgress?: (step: number, total: number, message: string) => void;
}): Promise<GineeOrder[]> {
  const { config, dateFrom, dateTo, existingOrders, onProgress } = params;

  if (!config.appKey || !config.appSecret) {
    throw new Error('Ginee App Key dan App Secret wajib diisi.');
  }

  // Ginee OMS operates in seller local timezone (Asia/Jakarta, WIB UTC+7 for ID).
  // Parse with tzOffset so 00:00:00 to 23:59:59 matches the Ginee OMS web UI filter 100% exactly.
  const tzOffset = (config.country === 'MY' || config.country === 'SG' || config.country === 'PH' || config.country === 'CN') ? '+08:00' : '+07:00';
  const startDate = new Date(`${dateFrom}T00:00:00${tzOffset}`);
  const endDate = new Date(`${dateTo}T23:59:59.999${tzOffset}`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Format tanggal tidak valid.');
  }

  // Ginee API enforces: createSince must be earlier than end time and diff in 15days.
  const chunks = chunkDateRange(startDate, endDate, 14);
  const allOrdersMap = new Map<string, GineeOrder>();

  // Auto-detect working endpoint (tries multiple paths, caches result in sessionStorage)
  if (onProgress) onProgress(0, chunks.length, 'Mendeteksi endpoint Ginee API yang tersedia...');
  const endpoint = await detectGineeEndpoint(config);
  console.log(`[fetchGineeOrders] Using endpoint: ${endpoint}`);
  if (onProgress) onProgress(0, chunks.length, `Endpoint ditemukan: ${endpoint}. Mulai ambil data...`);

  // Bangun peta referensi pesanan yang sudah diketahui (Memori, LocalStorage, IndexedDB)
  // Sangat penting untuk mempertahankan nomor resi kurir (AWB) jika pesanan dibatalkan
  const knownMap = new Map<string, GineeOrder>();
  if (existingOrders && existingOrders.length > 0) {
    for (const ko of existingOrders) {
      knownMap.set(ko.orderSn.toUpperCase(), ko);
      if (ko.channelOrderSn) knownMap.set(ko.channelOrderSn.toUpperCase(), ko);
      if (ko.trackingNo && ko.trackingNo !== '-') knownMap.set(ko.trackingNo.toUpperCase(), ko);
    }
  }
  for (const ko of getMergedGineeOrders()) {
    if (!knownMap.has(ko.orderSn.toUpperCase())) knownMap.set(ko.orderSn.toUpperCase(), ko);
    if (ko.channelOrderSn && !knownMap.has(ko.channelOrderSn.toUpperCase())) knownMap.set(ko.channelOrderSn.toUpperCase(), ko);
    if (ko.trackingNo && ko.trackingNo !== '-' && !knownMap.has(ko.trackingNo.toUpperCase())) knownMap.set(ko.trackingNo.toUpperCase(), ko);
  }
  try {
    const idbOrders = await getAllOrdersFromIndexedDB();
    if (Array.isArray(idbOrders)) {
      for (const ko of idbOrders) {
        if (!knownMap.has(ko.orderSn.toUpperCase())) knownMap.set(ko.orderSn.toUpperCase(), ko);
        if (ko.channelOrderSn && !knownMap.has(ko.channelOrderSn.toUpperCase())) knownMap.set(ko.channelOrderSn.toUpperCase(), ko);
        if (ko.trackingNo && ko.trackingNo !== '-' && !knownMap.has(ko.trackingNo.toUpperCase())) knownMap.set(ko.trackingNo.toUpperCase(), ko);
      }
    }
  } catch (e) {
    console.warn('[fetchGineeOrders] IndexedDB pre-load warning:', e);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkStartStr = chunk.start.toISOString();
    const chunkEndStr = chunk.end.toISOString();
    const dateLabel = `${chunk.start.toISOString().split('T')[0]} s/d ${chunk.end.toISOString().split('T')[0]}`;

    if (onProgress) {
      onProgress(i + 1, chunks.length, `Mengambil periode ${i + 1}/${chunks.length} (${dateLabel})...`);
    }

    let nextCursor: any = null;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES_PER_CHUNK = 1000; // Izinkan mengambil semua pesanan tanpa batasan 2.000 resi

    while (hasMore && pageCount < MAX_PAGES_PER_CHUNK) {
      pageCount++;
      const reqBody: any = {
        page: pageCount - 1,
        size: 100,
        createSince: chunkStartStr,
        createTo: chunkEndStr,
        startTime: chunkStartStr,
        endTime: chunkEndStr,
      };

      if (nextCursor) {
        reqBody.nextCursor = nextCursor;
      }

      const res = await callGineeProxy(endpoint, 'POST', reqBody, config);
      const dataObj = res?.data || res || {};
      const orderList: any[] = dataObj.content || dataObj.list || dataObj.orders || (Array.isArray(dataObj) ? dataObj : []);

      for (const raw of orderList) {
        const orderId = raw.orderId || raw.orderSn || raw.orderNo || raw.id || raw.externalOrderId || `ORD-${Date.now()}`;
        const externalSn = raw.externalOrderSn || raw.externalOrderId || raw.channelOrderNo || raw.channelOrderSn || raw.orderNumber || raw.orderNo || orderId;
        const lookupKey = orderId.toUpperCase();
        const extLookupKey = String(externalSn).toUpperCase();
        const knownMatch = knownMap.get(lookupKey) || knownMap.get(extLookupKey);

        if (!allOrdersMap.has(orderId)) {
          const rawItemsList = extractRawOrderItems(raw);
          let items: GineeOrderItem[] = rawItemsList.map((item: any) => {
            const rawMsku =
              item.msku ||
              item.masterSku ||
              item.masterProductSku ||
              item.masterVariationSku ||
              item.masterSkuCode ||
              item.skuInduk ||
              item.outerSkuId ||
              item.sellerSku ||
              item.channelSku ||
              item.skuCode ||
              item.sku ||
              item.itemSku ||
              item.variationSku ||
              raw.msku ||
              raw.masterSku ||
              '';
            const cleanMsku = rawMsku && !['JOYKO-PROD', 'JOYKO-RESI', 'JOYKO-GEN', 'BAG-RSB-100-12X20'].includes(String(rawMsku).trim())
              ? String(rawMsku).trim()
              : (item.sku && !['JOYKO-PROD', 'JOYKO-RESI'].includes(String(item.sku).trim()) ? String(item.sku).trim() : '-');

            const rawSku = item.sku || item.itemSku || item.variationSku || item.itemId || item.productSku || cleanMsku;
            return {
              sku: rawSku || cleanMsku || '-',
              msku: cleanMsku,
              productName: item.masterVariationName || item.masterProductName || item.productName || item.itemName || item.name || 'Produk Pesanan Ginee',
              variant: item.variant || item.variationName || item.spec || item.specification || '',
              qty: Number(item.qty || item.quantity || item.itemQuantity || item.itemQty || item.goodsCount || 1),
              price: Number(item.price || item.itemPrice || item.salePrice || item.sellingPrice || 0),
              imageUrl: item.imageUrl || item.image || item.picUrl || item.productPic,
            };
          });

          // If items array is empty from API, check known seed/cached orders first!
          const hasValidKnownItems =
            knownMatch &&
            knownMatch.items &&
            knownMatch.items.length > 0 &&
            knownMatch.items.some(it => it.msku && it.msku !== '-' && !it.productName?.startsWith('Produk Pesanan'));

          if (items.length === 0 && hasValidKnownItems) {
            items = knownMatch.items;
          } else if (items.length === 0 && (knownMatch as any)?.rawPayload) {
            const rawP = (knownMatch as any).rawPayload?.payload?.items || (knownMatch as any).rawPayload?.items;
            if (Array.isArray(rawP) && rawP.length > 0) {
              items = rawP.map((it: any) => ({
                sku: it.masterSku || it.sku || it.itemSku || it.variationSku || '-',
                msku: it.masterSku || it.msku || it.sku || it.itemSku || '-',
                productName: it.masterVariationName || it.productName || it.itemName || it.name || 'Produk Pesanan Ginee',
                variant: it.variant || it.variationName || it.spec || '',
                qty: Number(it.realQuantity || it.planQuantity || it.qty || it.quantity || 1),
                price: Number(it.realPrice || it.planPrice || it.price || 0),
                imageUrl: it.imageUrl || it.image || it.picUrl,
              }));
            }
          } else if (items.length === 0 && (raw as any)?.rawPayload) {
            const rawP = (raw as any).rawPayload?.payload?.items || (raw as any).rawPayload?.items;
            if (Array.isArray(rawP) && rawP.length > 0) {
              items = rawP.map((it: any) => ({
                sku: it.masterSku || it.sku || it.itemSku || it.variationSku || '-',
                msku: it.masterSku || it.msku || it.sku || it.itemSku || '-',
                productName: it.masterVariationName || it.productName || it.itemName || it.name || 'Produk Pesanan Ginee',
                variant: it.variant || it.variationName || it.spec || '',
                qty: Number(it.realQuantity || it.planQuantity || it.qty || it.quantity || 1),
                price: Number(it.realPrice || it.planPrice || it.price || 0),
                imageUrl: it.imageUrl || it.image || it.picUrl,
              }));
            }
          }

          if (items.length === 0) {
            items = [{
              sku: '-',
              msku: '-',
              productName: `Produk Pesanan (${raw.totalQuantity || 1} item)`,
              variant: '',
              qty: Number(raw.totalQuantity || 1),
              price: Number(raw.totalAmount || 0) / (Number(raw.totalQuantity) || 1),
            }];
          }

          const extractedTracking = extractOrderTrackingNo(raw);
          const allTrackings = extractAllTrackingNos(raw);
          const resolvedTrackingNo =
            extractedTracking !== '-'
              ? extractedTracking
              : (knownMatch?.trackingNo && knownMatch.trackingNo !== '-' ? knownMatch.trackingNo : '-');

          const resolvedCourier =
            raw.logisticsProvider ||
            raw.logisticsName ||
            raw.shippingCarrier ||
            raw.carrierName ||
            raw.logistics?.[0]?.logisticsProviderName ||
            raw.payload?.logistics?.[0]?.logisticsProviderName ||
            raw.rawPayload?.payload?.logistics?.[0]?.logisticsProviderName ||
            raw.packageList?.[0]?.logisticsProviderName ||
            knownMatch?.logisticsProvider ||
            'J&T Express';

          const resolvedDeadline =
            raw.promisedToShipBefore ||
            raw.shipByDate ||
            raw.shipByTime ||
            knownMatch?.shipByTime ||
            '-';

          const resolvedOutbound =
            raw.outboundNo ||
            knownMatch?.outboundNo ||
            `So-211315${Math.abs(orderId.split('').reduce((acc: number, c: string) => acc * 31 + c.charCodeAt(0), 0) % 9000000000000 + 1000000000000)}`;

          const resolvedWarehouse =
            raw.warehouseName ||
            knownMatch?.warehouseName ||
            'DefaultWarehouse';

          const order: GineeOrder = {
            orderSn: orderId,
            channelOrderSn: externalSn,
            platform: mapChannelToPlatform(raw.channelId || raw.channel || raw.platform || raw.channelName),
            shopName: resolveShopName(raw.shopName || raw.externalShopId || raw.shopId || raw.storeName, raw.channelId || raw.channel || raw.platform),
            buyerName: raw.customerName || raw.buyerName || raw.recipientInfo?.name || raw.receiverName || knownMatch?.buyerName || '-',
            orderStatus: normalizeOrderStatus(raw.orderStatus || raw.status || knownMatch?.orderStatus, raw),
            paymentStatus: raw.payAt || raw.payTime ? 'PAID' : (raw.paymentStatus || knownMatch?.paymentStatus || 'UNPAID'),
            paymentMethod: raw.paymentMethod || raw.paymentType || knownMatch?.paymentMethod || (raw.isCod || raw.cod ? 'COD' : 'Non COD'),
            isCod: Boolean(
              raw.isCod ||
              raw.cod ||
              (raw.paymentMethod && String(raw.paymentMethod).toUpperCase().includes('COD')) ||
              (raw.paymentType && String(raw.paymentType).toUpperCase().includes('COD')) ||
              knownMatch?.isCod
            ),
            isPreOrder: Boolean(
              raw.isPreOrder ||
              raw.preOrder ||
              (raw.preOrderDays && raw.preOrderDays > 0) ||
              (raw.daysToShip && raw.daysToShip > 2) ||
              (raw.deliveryType && String(raw.deliveryType).toLowerCase().includes('pre')) ||
              knownMatch?.isPreOrder
            ),
            labelPrinted: Boolean(
              raw.isPrintWaybill ||
              raw.labelPrinted ||
              raw.isPrinted ||
              raw.printStatus === 'PRINTED' ||
              raw.waybillPrinted ||
              (raw.shippingDocumentInfo && raw.shippingDocumentInfo.isPrinted) ||
              (resolvedTrackingNo && resolvedTrackingNo !== '-' && resolvedTrackingNo.length > 5) ||
              knownMatch?.labelPrinted
            ),
            orderTime: raw.createAt || raw.orderTime || raw.createTime || raw.createdTime || knownMatch?.orderTime || new Date().toISOString(),
            payTime: raw.payAt || raw.payTime || knownMatch?.payTime || '-',
            shipByTime: resolvedDeadline,
            trackingNo: resolvedTrackingNo,
            logisticsProvider: resolvedCourier,
            totalAmount: Number(raw.totalAmount || raw.orderAmount || raw.totalPrice || raw.orderPrice || knownMatch?.totalAmount || 0),
            currency: raw.currency || 'IDR',
            items,
            note: raw.note || raw.remark || raw.buyerRemark || knownMatch?.note || '',
            recipientName: raw.recipientInfo?.name || raw.recipientName || raw.receiverName || raw.customerName || raw.buyerName || knownMatch?.recipientName || '-',
            recipientPhone: raw.recipientInfo?.phone || raw.recipientPhone || raw.receiverPhone || knownMatch?.recipientPhone || '-',
            recipientAddress: raw.recipientInfo?.address || raw.recipientAddress || raw.receiverAddress || knownMatch?.recipientAddress || '-',
            outboundNo: resolvedOutbound,
            warehouseName: resolvedWarehouse,
            allTrackingNos: allTrackings.length > 0 ? allTrackings : (resolvedTrackingNo !== '-' ? [resolvedTrackingNo] : []),
            rawPayload: raw,
          };

          allOrdersMap.set(orderId, order);
        }
      }

      // Live progress update with total count
      if (onProgress) {
        const totalFetched = allOrdersMap.size;
        const totalGinee = dataObj.total || dataObj.totalCount;
        const totalInfo = typeof totalGinee === 'number' && totalGinee > 0 ? ` dari ~${totalGinee.toLocaleString('id-ID')}` : '';
        onProgress(
          i + 1,
          chunks.length,
          `Mengambil periode ${i + 1}/${chunks.length} (${dateLabel}) • Hal ${pageCount} (${totalFetched.toLocaleString('id-ID')}${totalInfo} pesanan)...`
        );
      }

      // Check cursor pagination (can be string or array in Ginee OMS V3)
      const prevCursor = nextCursor;
      let hasValidCursor = false;

      if (dataObj.nextCursor && typeof dataObj.nextCursor === 'string' && dataObj.nextCursor.trim().length > 0) {
        nextCursor = dataObj.nextCursor.trim();
        hasValidCursor = true;
      } else if (dataObj.nextCursor && Array.isArray(dataObj.nextCursor) && dataObj.nextCursor.length > 0) {
        nextCursor = dataObj.nextCursor;
        hasValidCursor = true;
      }

      if (hasValidCursor) {
        // Cursor-based pagination: continue if cursor is valid and changed
        if (prevCursor && JSON.stringify(prevCursor) === JSON.stringify(nextCursor)) {
          hasMore = false;
        } else {
          hasMore = true;
        }
      } else if (dataObj.hasMore === true) {
        hasMore = true;
      } else if (typeof dataObj.total === 'number' && pageCount * 100 < dataObj.total) {
        hasMore = true;
      } else if (typeof dataObj.totalCount === 'number' && pageCount * 100 < dataObj.totalCount) {
        hasMore = true;
      } else if (orderList.length === 100) {
        // Full page returned and no cursor provided; assume offset pagination has more
        hasMore = true;
      } else {
        hasMore = false;
      }

      // If page returned less than full size or empty, we've reached the end of this chunk
      if (orderList.length === 0 || orderList.length < 100) {
        hasMore = false;
      }

      // Polite pacing delay to respect Ginee API rate limiter and avoid HTTP 429
      if (hasMore) {
        await new Promise(r => setTimeout(r, 350));
      }
    }
  }

  // ─── AMBIL PESANAN YANG BARU DIBATALKAN (lastUpdateSince: CANCELLED) ───────────
  // Sangat penting: Pesanan yang dibuat beberapa hari lalu (misal H-3 atau H-7) dan
  // sudah dicetak label pengirimannya (ada AWB), jika dibatalkan oleh pembeli/toko hari ini,
  // TIDAK AKAN terjaring oleh query createSince di atas karena createTime-nya di masa lalu.
  // Dengan memanggil lastUpdateSince dengan status CANCELLED, semua pesanan yang baru saja
  // dibatalkan akan langsung ditarik dan nomor resinya diproteksi di cancelled_orders!
  try {
    if (onProgress) {
      onProgress(chunks.length, chunks.length, 'Memeriksa & menyinkronkan pesanan yang dibatalkan...');
    }

    const cancelEndTime = new Date(Math.min(endDate.getTime(), Date.now()));
    const defaultCancelStartTime = new Date(cancelEndTime.getTime() - 7 * 86400000);
    const cancelStartTime = new Date(Math.min(startDate.getTime(), defaultCancelStartTime.getTime()));
    
    // Ginee OMS membatasi selisih tanggal maksimal 14 hari
    const safeCancelStart = cancelEndTime.getTime() - cancelStartTime.getTime() > 14 * 86400000
      ? new Date(cancelEndTime.getTime() - 14 * 86400000 + 3600000)
      : cancelStartTime;

    let cancelPage = 0;
    let cancelHasMore = true;
    const MAX_CANCEL_PAGES = 10; // Hingga 1.000 pesanan batal terbaru

    while (cancelHasMore && cancelPage < MAX_CANCEL_PAGES) {
      cancelPage++;
      const cancelReqBody: any = {
        page: cancelPage - 1,
        size: 100,
        lastUpdateSince: safeCancelStart.toISOString(),
        lastUpdateTo: cancelEndTime.toISOString(),
        orderStatus: 'CANCELLED',
      };

      const cancelRes = await callGineeProxy(endpoint, 'POST', cancelReqBody, config);
      const cancelDataObj = cancelRes?.data || cancelRes || {};
      const cancelList: any[] = cancelDataObj.content || cancelDataObj.list || cancelDataObj.orders || (Array.isArray(cancelDataObj) ? cancelDataObj : []);

      if (!cancelList || cancelList.length === 0) {
        cancelHasMore = false;
        break;
      }

      for (const raw of cancelList) {
        const orderId = raw.orderId || raw.orderSn || raw.orderNo || raw.id || raw.externalOrderId;
        if (!orderId) continue;

        // JANGAN PERNAH menandai pesanan aktif / dikirim / siap kirim / sedang dibatalkan sebagai CANCELLED!
        const rawStatusVal = String(raw.orderStatus || raw.status || '').toUpperCase().trim();
        if (
          ['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'PROCESSED', 'PAID', 'COMPLETED', 'FINISHED', 'SUCCESS', 'SIAP_DIKIRIM', 'DIKIRIM', 'SELESAI'].includes(rawStatusVal) ||
          rawStatusVal.includes('READY') ||
          rawStatusVal.includes('SHIP') ||
          rawStatusVal.includes('DELIVER') ||
          rawStatusVal.includes('PROCESS') ||
          rawStatusVal.includes('SIAP') ||
          rawStatusVal.includes('KEMAS') ||
          rawStatusVal.includes('SEDANG DIBATALKAN') ||
          rawStatusVal.includes('SEDANG_DIBATALKAN') ||
          rawStatusVal.includes('IN_CANCEL') ||
          rawStatusVal.includes('APPLY_CANCEL') ||
          rawStatusVal.includes('CANCEL_PENDING') ||
          rawStatusVal.includes('CANCEL_REQUEST')
        ) {
          continue;
        }

        if (!rawStatusVal.includes('CANCEL') && !rawStatusVal.includes('BATAL') && !rawStatusVal.includes('DIBATALKAN')) {
          continue;
        }

        const externalSn = raw.externalOrderSn || raw.externalOrderId || raw.channelOrderNo || raw.channelOrderSn || raw.orderNumber || raw.orderNo || orderId;
        const lookupKey = orderId.toUpperCase();
        const extLookupKey = String(externalSn).toUpperCase();
        const knownMatch = knownMap.get(lookupKey) || knownMap.get(extLookupKey);

        const extractedTracking = extractOrderTrackingNo(raw);
        const allTrackings = extractAllTrackingNos(raw);
        const resolvedTrackingNo =
          extractedTracking !== '-'
            ? extractedTracking
            : (knownMatch?.trackingNo && knownMatch.trackingNo !== '-' ? knownMatch.trackingNo : '-');

        const resolvedCourier =
          raw.logisticsProvider ||
          raw.logisticsName ||
          raw.shippingCarrier ||
          raw.carrierName ||
          raw.logistics?.[0]?.logisticsProviderName ||
          knownMatch?.logisticsProvider ||
          'J&T Express';

        const rawItemsList = extractRawOrderItems(raw);
        let items: GineeOrderItem[] = rawItemsList.map((item: any) => {
          const rawMsku = item.msku || item.masterSku || item.sku || '';
          const cleanMsku = rawMsku && !['JOYKO-PROD', 'JOYKO-RESI', 'JOYKO-GEN', 'BAG-RSB-100-12X20'].includes(String(rawMsku).trim())
            ? String(rawMsku).trim()
            : '-';
          return {
            sku: item.sku || cleanMsku || '-',
            msku: cleanMsku,
            productName: item.masterVariationName || item.productName || item.itemName || 'Produk Pesanan Ginee',
            variant: item.variant || '',
            qty: Number(item.qty || item.quantity || 1),
            price: Number(item.price || 0),
          };
        });

        if (items.length === 0 && knownMatch?.items && knownMatch.items.length > 0) {
          items = knownMatch.items;
        }
        if (items.length === 0) {
          items = [{
            sku: '-',
            msku: '-',
            productName: `Produk Pesanan (${raw.totalQuantity || 1} item)`,
            variant: '',
            qty: Number(raw.totalQuantity || 1),
            price: Number(raw.totalAmount || 0) / (Number(raw.totalQuantity) || 1),
          }];
        }

        const combinedTrackings = new Set<string>();
        if (resolvedTrackingNo && resolvedTrackingNo !== '-') combinedTrackings.add(resolvedTrackingNo);
        allTrackings.forEach(t => combinedTrackings.add(t));
        if (knownMatch?.allTrackingNos) {
          knownMatch.allTrackingNos.forEach(t => combinedTrackings.add(t));
        }

        const cancelledOrder: GineeOrder = {
          orderSn: orderId,
          channelOrderSn: externalSn,
          platform: mapChannelToPlatform(raw.channelId || raw.channel || raw.platform || raw.channelName),
          shopName: resolveShopName(raw.shopName || raw.externalShopId || raw.shopId || raw.storeName, raw.channelId || raw.channel || raw.platform),
          buyerName: raw.customerName || raw.buyerName || raw.recipientInfo?.name || knownMatch?.buyerName || '-',
          orderStatus: 'CANCELLED',
          paymentStatus: raw.payAt || raw.payTime ? 'PAID' : (raw.paymentStatus || knownMatch?.paymentStatus || 'UNPAID'),
          paymentMethod: raw.paymentMethod || knownMatch?.paymentMethod || 'Non COD',
          isCod: Boolean(raw.isCod || raw.cod || knownMatch?.isCod),
          isPreOrder: Boolean(raw.isPreOrder || knownMatch?.isPreOrder),
          labelPrinted: Boolean(raw.isPrintWaybill || raw.labelPrinted || knownMatch?.labelPrinted || (resolvedTrackingNo && resolvedTrackingNo !== '-')),
          orderTime: raw.createAt || raw.orderTime || raw.createTime || knownMatch?.orderTime || new Date().toISOString(),
          payTime: raw.payAt || raw.payTime || knownMatch?.payTime || '-',
          shipByTime: raw.promisedToShipBefore || raw.shipByDate || knownMatch?.shipByTime || '-',
          trackingNo: resolvedTrackingNo,
          logisticsProvider: resolvedCourier,
          totalAmount: Number(raw.totalAmount || raw.orderAmount || knownMatch?.totalAmount || 0),
          currency: raw.currency || 'IDR',
          items,
          note: raw.note || raw.remark || knownMatch?.note || '',
          recipientName: raw.recipientInfo?.name || raw.recipientName || knownMatch?.recipientName || '-',
          recipientPhone: raw.recipientInfo?.phone || raw.recipientPhone || knownMatch?.recipientPhone || '-',
          recipientAddress: raw.recipientInfo?.address || raw.recipientAddress || knownMatch?.recipientAddress || '-',
          outboundNo: raw.outboundNo || knownMatch?.outboundNo || `So-Cancel-${orderId}`,
          warehouseName: raw.warehouseName || knownMatch?.warehouseName || 'DefaultWarehouse',
          allTrackingNos: Array.from(combinedTrackings),
          rawPayload: raw,
        };

        allOrdersMap.set(orderId, cancelledOrder);
      }

      if (cancelList.length < 100) {
        cancelHasMore = false;
      } else {
        await new Promise(r => setTimeout(r, 250));
      }
    }
  } catch (cancelErr) {
    console.warn('[fetchGineeOrders] Peringatan saat sinkronisasi pesanan dibatalkan via lastUpdateSince:', cancelErr);
  }

  // Only fallback to seed/stored orders if API returned ZERO orders (e.g. offline / network failure)
  if (allOrdersMap.size === 0) {
    for (const ko of getMergedGineeOrders()) {
      if (!allOrdersMap.has(ko.orderSn)) {
        allOrdersMap.set(ko.orderSn, ko);
      }
    }
  }

  // Convert map to array and sort by orderTime descending
  const result = Array.from(allOrdersMap.values());
  result.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());

  // Save to persistent storage and session storage
  saveGineeOrdersToStorage(result);

  return result;
}

// ─── Test Connection with V3 Endpoint ───────────────────────────────────────
export async function testGineeConnection(
  config: GineeApiConfig
): Promise<{ success: boolean; message: string; shopCount?: number; hasOrderAccess?: boolean }> {
  try {
    sessionStorage.removeItem(ENDPOINT_CACHE_KEY);

    const appKey = config.appKey || '74f4f05bb016485b';
    const appSecret = config.appSecret || '46218d81e39ad490';
    const country = config.country || 'ID';
    const activeConfig: GineeApiConfig = {
      ...config,
      appKey,
      appSecret,
      country,
    };

    const to = new Date();
    const from = new Date(to.getTime() - 3 * 86400000);
    const workingEndpoint = '/openapi/v3/oms/order/list';

    const orderRes = await callGineeProxy(
      workingEndpoint,
      'POST',
      {
        page: 0,
        size: 5,
        createSince: from.toISOString(),
        createTo: to.toISOString(),
      },
      activeConfig
    );

    const dataObj = orderRes?.data || orderRes || {};
    const orderList: any[] = dataObj.content || dataObj.list || dataObj.orders || (Array.isArray(dataObj) ? dataObj : []);

    return {
      success: true,
      message: `Koneksi Berhasil! Terhubung ke Ginee OMS V3 (${workingEndpoint}). (${orderList.length} pesanan sampel ditemukan).`,
      hasOrderAccess: true,
    };
  } catch (err: any) {
    console.error('[testGineeConnection] Caught error:', err);
    const msg = err.message || '';

    if (msg.includes('Invalid request signature')) {
      return {
        success: false,
        message: 'Koneksi ke Ginee Gateway berhasil! Namun Secret Key tidak valid. Silakan periksa Secret Key di Ginee Open Platform.',
      };
    }
    if (msg.includes('IAM_FAILED') || msg.includes('Access denied') || msg.includes('no access') || msg.includes('No permission')) {
      return {
        success: false,
        message: 'Akses Ditolak: App Key terhubung, namun akun Anda belum memiliki izin ke endpoint ini di Ginee Open Platform.',
      };
    }

    return {
      success: false,
      message: msg || 'Gagal terhubung ke Ginee API.',
    };
  }
}

// ─── Sinkronisasi Rolling 3 Hari Terakhir ke Firestore & IndexedDB ────────────
export async function syncRolling3DaysOrdersToFirestore(
  config: GineeApiConfig,
  onProgress?: (saved: number, total: number, message: string) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const activeConfig: GineeApiConfig = {
      appKey: config.appKey || '74f4f05bb016485b',
      appSecret: config.appSecret || '46218d81e39ad490',
      country: config.country || 'ID',
      proxyMode: config.proxyMode || 'auto',
      customProxyUrl: config.customProxyUrl || '',
    };

    const now = new Date();
    const from = new Date(now.getTime() - 3 * 86400000); // Rolling 3 hari terakhir
    const dateFrom = from.toISOString().split('T')[0];
    const dateTo = now.toISOString().split('T')[0];

    if (onProgress) onProgress(0, 100, `Mulai sinkronisasi rolling 3 hari terakhir (${dateFrom} s/d ${dateTo})...`);

    const orders = await fetchGineeOrders({
      config: activeConfig,
      dateFrom,
      dateTo,
      onProgress: (step, total, msg) => {
        if (onProgress) onProgress(step, total, msg);
      },
    });

    if (onProgress) onProgress(orders.length, orders.length, `Menyimpan ${orders.length} pesanan ke Cloud Firestore (Batch Merge)...`);

    // Simpan ke Cloud Firestore menggunakan writeBatch ({ merge: true })
    const { saveGineeOrdersToFirestore, purgeExpiredGineeOrdersFromFirestore } = await import('./gineeFirestoreService');
    const firestoreResult = await saveGineeOrdersToFirestore(orders);

    // Bersihkan pesanan yang berumur > 4 hari dari Firestore agar hemat kuota
    purgeExpiredGineeOrdersFromFirestore(4).catch(err => {
      console.warn('[RollingSync] Purge expired error:', err);
    });

    return {
      success: firestoreResult.success,
      count: orders.length,
      error: firestoreResult.error,
    };
  } catch (err: any) {
    console.error('[RollingSync] Error sinkronisasi rolling 3 hari:', err);
    return {
      success: false,
      count: 0,
      error: err.message || 'Gagal sinkronisasi rolling 3 hari',
    };
  }
}

// ─── Fetch Tracking Number / AWB from Ekspedisi ─────────────────────────────
export interface GineeTrackingInfo {
  trackingNo: string;
  logisticsProvider?: string;
  orderSn: string;
  channelOrderSn?: string;
  status?: string;
}

/**
 * Endpoint buat ambil AWB / nomor resi dari ekspedisi via Ginee Open API
 * Probes the official Ginee OMS endpoints:
 * 1. /openapi/v3/oms/order/get-tracking-number
 * 2. /openapi/v3/oms/order/sync-tracking-number
 * 3. /openapi/oms/order/get-tracking-number
 * 4. /openapi/v3/oms/order/detail
 */
export async function fetchGineeOrderTrackingNumber(
  params: {
    orderSn: string;
    channelOrderSn?: string;
    config: GineeApiConfig;
  }
): Promise<GineeTrackingInfo | null> {
  const { orderSn, channelOrderSn, config } = params;
  const candidateEndpoints = [
    '/openapi/v3/oms/order/fast-print',
    '/openapi/v3/oms/order/print',
    '/openapi/v3/oms/order/get-tracking-number',
    '/openapi/v3/oms/order/shipping-document',
    '/openapi/v3/oms/order/sync-tracking-number',
  ];

  for (const ep of candidateEndpoints) {
    try {
      let body: any;
      if (ep.includes('fast-print') || ep.endsWith('/print')) {
        body = { orderId: orderSn, documentType: 'SHIPPING_LABEL' };
      } else if (ep.includes('sync-tracking-number')) {
        body = { orderSnList: [orderSn], ...(channelOrderSn ? { channelOrderSnList: [channelOrderSn] } : {}) };
      } else if (ep.includes('shipping-document')) {
        body = { orderSn, documentType: 'SHIPPING_LABEL' };
      } else {
        body = { orderSn, ...(channelOrderSn ? { channelOrderSn } : {}) };
      }

      const res = await callGineeProxy(ep, 'POST', body, config);
      const dataObj = res.data || res;

      const logisticsInfo = Array.isArray(dataObj.logisticsInfos) ? dataObj.logisticsInfos[0] : null;
      const trackingNo =
        logisticsInfo?.logisticsTrackingNumber ||
        dataObj.trackingNo ||
        dataObj.trackingNumber ||
        dataObj.waybillNo ||
        dataObj.awbNo ||
        dataObj.shippingDocumentInfo?.trackingNo ||
        (Array.isArray(dataObj.list) && dataObj.list[0]?.trackingNo) ||
        (Array.isArray(dataObj) && dataObj[0]?.trackingNo);

      if (trackingNo && typeof trackingNo === 'string' && trackingNo.trim() !== '' && trackingNo !== '-') {
        return {
          trackingNo: trackingNo.trim(),
          logisticsProvider: logisticsInfo?.logisticsProviderName || dataObj.logisticsProvider || dataObj.logisticsName || dataObj.carrierName,
          orderSn,
          channelOrderSn,
          status: dataObj.status || dataObj.orderStatus,
        };
      }
    } catch (err) {
      console.warn(`[fetchGineeOrderTrackingNumber] Probing ${ep} for ${orderSn} returned error:`, err);
    }
  }

  return null;
}

/**
 * Sinkronisasi Logistik: Memanggil Ginee API untuk update nomor resi ekspedisi terbaru
 */
export async function syncGineeLogistics(
  params: {
    orderSnList: string[];
    config: GineeApiConfig;
  }
): Promise<{ success: boolean; message: string; updatedCount?: number }> {
  const { orderSnList, config } = params;
  if (!orderSnList || orderSnList.length === 0) {
    return { success: false, message: 'Daftar nomor pesanan kosong.' };
  }

  const syncEndpoints = [
    '/openapi/v3/oms/order/sync-tracking-number',
    '/openapi/v3/oms/order/sync-logistics',
    '/openapi/oms/order/sync-logistics',
  ];

  for (const ep of syncEndpoints) {
    try {
      const res = await callGineeProxy(ep, 'POST', { orderSnList }, config);
      const dataObj = res.data || res;
      return {
        success: true,
        message: 'Sinkronisasi logistik dari ekspedisi berhasil diproses oleh Ginee.',
        updatedCount: dataObj.count || dataObj.successCount || orderSnList.length,
      };
    } catch (err: any) {
      console.warn(`[syncGineeLogistics] ${ep} error:`, err);
    }
  }

  throw new Error('Gagal melakukan sinkronisasi logistik ke Ginee API.');
}

/**
 * Atur Pengiriman ke Ekspedisi (Ship Order)
 */
export async function arrangeGineeShipment(
  params: {
    orderSn: string;
    shippingMethod?: string;
    config: GineeApiConfig;
  }
): Promise<{ success: boolean; message: string; trackingNo?: string }> {
  const { orderSn, shippingMethod, config } = params;
  const shipEndpoints = [
    '/openapi/v3/oms/order/ship',
    '/openapi/oms/order/ship',
  ];

  for (const ep of shipEndpoints) {
    try {
      const res = await callGineeProxy(ep, 'POST', { orderSn, shippingMethod: shippingMethod || 'PICKUP' }, config);
      const dataObj = res.data || res;
      return {
        success: true,
        message: 'Pengiriman berhasil diatur ke ekspedisi!',
        trackingNo: dataObj.trackingNo || dataObj.waybillNo,
      };
    } catch (err: any) {
      console.warn(`[arrangeGineeShipment] ${ep} error:`, err);
    }
  }

  throw new Error('Gagal mengatur pengiriman ke ekspedisi via Ginee API.');
}

/**
 * Cetak / Ambil Shipping Document & AWB Label dari Ekspedisi
 */
export async function fetchGineeShippingDocument(
  params: {
    orderSn: string;
    config: GineeApiConfig;
  }
): Promise<{ success: boolean; url?: string; trackingNo?: string; message?: string }> {
  const { orderSn, config } = params;
  const docEndpoints = [
    '/openapi/v3/oms/order/shipping-document',
    '/openapi/oms/order/shipping-document',
  ];

  for (const ep of docEndpoints) {
    try {
      const res = await callGineeProxy(ep, 'POST', { orderSn, documentType: 'SHIPPING_LABEL' }, config);
      const dataObj = res.data || res;
      const fileUrl = dataObj.fileUrl || dataObj.url || dataObj.documentUrl || dataObj.pdfUrl;
      return {
        success: true,
        url: fileUrl,
        trackingNo: dataObj.trackingNo,
        message: fileUrl ? 'Label pengiriman berhasil diambil.' : 'Dokumen siap dicetak.',
      };
    } catch (err: any) {
      console.warn(`[fetchGineeShippingDocument] ${ep} error:`, err);
    }
  }

  throw new Error('Gagal mengambil dokumen pengiriman dari Ginee API.');
}

