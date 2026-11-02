import { GineeOrder } from './gineeService';

const DB_NAME = 'KalindoGineeDB';
const DB_VERSION = 4;
const STORE_NAME = 'orders';
const SCAN_STORE_NAME = 'scanned_history';

export interface PersistentScanRecord {
  id: string;
  barcode: string;
  trackingNo: string;
  orderSn: string;
  channelOrderSn?: string;
  scannedAt: string;
  scannedDate: string;
  scannedDayName?: string;
  timestamp: number;
  totalQty: number;
  totalAmount: number;
  platform?: string;
  shopName?: string;
  status: string;
}

/**
 * Mendeteksi apakah pesanan merupakan data dummy/mock buatan (misal fallback lama atau tes).
 * Pesanan mock TIDAK BOLEH disimpan ke database atau ditampilkan sebagai hasil scan valid!
 */
export function isMockOrder(o: any): boolean {
  if (!o) return false;
  if (o.trackingNo === 'SPXID9988776655' || o.orderSn === 'ORD-TEST-123') return true;
  if (o.platform === 'Ginee Logistics') return true;
  if (o.buyerName === 'Pelanggan Terverifikasi') return true;
  if (typeof o.note === 'string' && (
    o.note.includes('anti-cancel') ||
    o.note.includes('lolos verifikasi') ||
    o.note.includes('Resi kurir fisik')
  )) return true;
  if (Array.isArray(o.items) && o.items.some((it: any) =>
    it.sku === 'JOYKO-RESI' || it.msku === 'JOYKO-RESI' ||
    (typeof it.productName === 'string' && (it.productName.includes('Resi Fisik') || it.productName.includes('Resi Logistik')))
  )) return true;
  return false;
}

/**
 * Membersihkan semua pesanan dummy / mock / corrupted dari IndexedDB
 */
export async function purgeMockOrdersFromIndexedDB(): Promise<number> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let count = 0;
      req.onsuccess = (e: any) => {
        const cursor: IDBCursorWithValue = e.target.result;
        if (cursor) {
          if (isMockOrder(cursor.value)) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          if (count > 0) {
            console.log(`[IndexedDB Cleanup] ✓ Berhasil menghapus ${count} pesanan mock/dummy dari IndexedDB.`);
          }
          resolve(count);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Membuka koneksi ke IndexedDB browser lokal.
 * IndexedDB mendukung penyimpanan ratusan Megabyte hingga Puluhan Gigabyte
 * tanpa batasan kuota 5MB seperti sessionStorage / localStorage.
 */
function openGineeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'orderSn' });
        store.createIndex('orderTime', 'orderTime', { unique: false });
        store.createIndex('orderStatus', 'orderStatus', { unique: false });
        store.createIndex('trackingNo', 'trackingNo', { unique: false });
        store.createIndex('channelOrderSn', 'channelOrderSn', { unique: false });
      } else {
        store = req.transaction!.objectStore(STORE_NAME);
      }

      // Indeks cepat pencarian (B-tree) untuk pencarian sub-milidetik (<1ms)
      if (!store.indexNames.contains('trackingNoUpper')) {
        store.createIndex('trackingNoUpper', 'trackingNoUpper', { unique: false });
      }
      if (!store.indexNames.contains('channelOrderSnUpper')) {
        store.createIndex('channelOrderSnUpper', 'channelOrderSnUpper', { unique: false });
      }
      if (!store.indexNames.contains('trackingNoStripped')) {
        store.createIndex('trackingNoStripped', 'trackingNoStripped', { unique: false });
      }
      if (!store.indexNames.contains('bookingSnUpper')) {
        store.createIndex('bookingSnUpper', 'bookingSnUpper', { unique: false });
      }

      if (!db.objectStoreNames.contains(SCAN_STORE_NAME)) {
        const scanStore = db.createObjectStore(SCAN_STORE_NAME, { keyPath: 'barcode' });
        scanStore.createIndex('trackingNo', 'trackingNo', { unique: false });
        scanStore.createIndex('orderSn', 'orderSn', { unique: false });
        scanStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Menyimpan atau memperbarui daftar pesanan ke IndexedDB.
 * Mendukung puluhan ribu pesanan secara asynchronous tanpa memblokir antarmuka UI.
 */
export async function saveOrdersToIndexedDB(orders: GineeOrder[]): Promise<void> {
  if (!orders || orders.length === 0) return;
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const order of orders) {
        if (order && order.orderSn) {
          // JANGAN PERNAH menyimpan mock/dummy order ke database!
          if (isMockOrder(order)) continue;

          const t = (order.trackingNo || '').trim();
          const sn = (order.channelOrderSn || '').trim();
          const b = String((order as any).externalBookingSn || (order as any).bookingSn || (order as any).bookingNo || '').trim();

          // Auto-heal items from rawPayload jika items masih placeholder '-'
          const rawItems = (order as any).rawPayload?.payload?.items || (order as any).rawPayload?.items;
          const isPlaceholder =
            !order.items ||
            order.items.length === 0 ||
            order.items.every((it: any) => !it.msku || it.msku === '-' || String(it.productName || '').startsWith('Produk Pesanan'));

          let itemsToSave = order.items;
          if (isPlaceholder && Array.isArray(rawItems) && rawItems.length > 0) {
            itemsToSave = rawItems.map((it: any) => ({
              sku: it.masterSku || it.sku || it.itemSku || it.variationSku || '-',
              msku: it.masterSku || it.msku || it.sku || it.itemSku || '-',
              productName: it.masterVariationName || it.productName || it.itemName || it.name || 'Produk Pesanan Ginee',
              variant: it.variant || it.variationName || it.spec || '',
              qty: Number(it.realQuantity || it.planQuantity || it.qty || it.quantity || 1),
              price: Number(it.realPrice || it.planPrice || it.price || 0),
              imageUrl: it.imageUrl || it.image || it.picUrl || '',
            }));
          }

          const enriched: any = {
            ...order,
            items: itemsToSave,
            trackingNoUpper: t.toUpperCase(),
            channelOrderSnUpper: sn.toUpperCase(),
            trackingNoStripped: t.replace(/[\s\-_/]/g, '').toUpperCase(),
            bookingSnUpper: b.toUpperCase(),
          };
          store.put(enriched);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn('[IndexedDB] Transaction error:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] saveOrdersToIndexedDB failed:', err);
  }
}

/**
 * Mengambil seluruh data pesanan dari IndexedDB secara cepat.
 * Default tidak melakukan sorting berat agar UI thread tidak freeze pada data ratusan ribu.
 */
export async function getAllOrdersFromIndexedDB(shouldSort: boolean = false): Promise<GineeOrder[]> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rawList: GineeOrder[] = req.result || [];
        const list = rawList.filter(o => !isMockOrder(o));
        if (shouldSort && list.length > 0) {
          list.sort((a, b) => {
            const ta = Date.parse(a.orderTime) || 0;
            const tb = Date.parse(b.orderTime) || 0;
            return tb - ta;
          });
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] getAllOrdersFromIndexedDB failed:', err);
    return [];
  }
}

/**
 * Mengambil jumlah pesanan yang tersimpan di IndexedDB.
 */
export async function countOrdersInIndexedDB(): Promise<number> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Menghapus seluruh data pesanan dari IndexedDB.
 */
export async function clearOrdersIndexedDB(): Promise<void> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] clearOrdersIndexedDB failed:', err);
  }
}

/**
 * Mencari pesanan secara instan di IndexedDB (<1ms) menggunakan Indeks B-Tree.
 * TIDAK MENGGUNAKAN store.getAll() yang lambat dan memakan memori untuk ratusan ribu data.
 */
export async function findOrderInIndexedDB(query: string): Promise<GineeOrder | null> {
  const clean = (query || '')
    .trim()
    .replace(/^\][a-zA-Z0-9]{2}/, '')
    .trim()
    .toUpperCase();
  if (!clean) return null;
  const strippedClean = clean.replace(/[\s\-_/]/g, '');

  try {
    const db = await openGineeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const tryIndexGet = (indexName: string | null, key: string): Promise<GineeOrder | null> => {
        return new Promise((res) => {
          try {
            if (indexName && !store.indexNames.contains(indexName)) {
              res(null);
              return;
            }
            const req = indexName ? store.index(indexName).get(key) : store.get(key);
            req.onsuccess = () => {
              const result: GineeOrder | null = req.result || null;
              if (result && isMockOrder(result)) {
                // Hapus data mock/dummy dari IndexedDB agar bersih selamanya
                deleteOrderFromIndexedDB(result.orderSn).catch(() => {});
                res(null);
              } else {
                res(result);
              }
            };
            req.onerror = () => res(null);
          } catch {
            res(null);
          }
        });
      };

      (async () => {
        // 1. Cek langsung Primary Key (orderSn)
        let found = await tryIndexGet(null, clean);
        if (found) { resolve(found); return; }

        // 2. Cek index trackingNoUpper & trackingNo (AWB / Nomor Resi)
        found = await tryIndexGet('trackingNoUpper', clean);
        if (found) { resolve(found); return; }

        found = await tryIndexGet('trackingNo', clean);
        if (found) { resolve(found); return; }
        if (query.trim() !== clean) {
          found = await tryIndexGet('trackingNo', query.trim());
          if (found) { resolve(found); return; }
        }

        // 3. Cek index channelOrderSnUpper & channelOrderSn (Nomor Pesanan Marketplace)
        found = await tryIndexGet('channelOrderSnUpper', clean);
        if (found) { resolve(found); return; }

        found = await tryIndexGet('channelOrderSn', clean);
        if (found) { resolve(found); return; }
        found = await tryIndexGet('channelOrderSn', clean.toLowerCase());
        if (found) { resolve(found); return; }
        if (query.trim() !== clean) {
          found = await tryIndexGet('channelOrderSn', query.trim());
          if (found) { resolve(found); return; }
        }

        // 4. Cek index bookingSnUpper (Nomor Booking Ginee OMS)
        found = await tryIndexGet('bookingSnUpper', clean);
        if (found) { resolve(found); return; }

        // 5. Cek trackingNoStripped jika barcode tanpa tanda strip/spasi
        if (strippedClean.length >= 6) {
          found = await tryIndexGet('trackingNoStripped', strippedClean);
          if (found) { resolve(found); return; }

          found = await tryIndexGet('trackingNo', strippedClean);
          if (found) { resolve(found); return; }
        }

        // 6. Cek awalan kurir dihilangkan (SPXID / SPX / JP / JX / TK / GTL / LX / NL / POS / SAP)
        const stripCourierPrefix = (s: string) => s.replace(/^(SPXID|SPX|JP|JX|TK|GTL|LX|NL|POS|SAP)/i, '');
        const normClean = stripCourierPrefix(strippedClean);
        if (normClean.length >= 7 && normClean !== strippedClean) {
          found = await tryIndexGet('trackingNoStripped', normClean);
          if (found) { resolve(found); return; }

          found = await tryIndexGet('trackingNo', normClean);
          if (found) { resolve(found); return; }
        }

        // Semua B-tree lookup selesai dalam <1ms tanpa lagging
        resolve(null);
      })();
    });
  } catch (err) {
    console.warn('[IndexedDB] findOrderInIndexedDB failed:', err);
    return null;
  }
}

/**
 * Memperbarui status pesanan tunggal di IndexedDB secara cepat.
 */
export async function updateOrderStatusInIndexedDB(orderSnOrTracking: string, newStatus: string): Promise<boolean> {
  try {
    const existing = await findOrderInIndexedDB(orderSnOrTracking);
    if (!existing) return false;
    existing.orderStatus = newStatus;
    await saveOrdersToIndexedDB([existing]);
    return true;
  } catch (err) {
    console.warn('[IndexedDB] updateOrderStatusInIndexedDB failed:', err);
    return false;
  }
}

/**
 * Menghapus pesanan tunggal dari IndexedDB berdasarkan orderSn atau tracking.
 */
export async function deleteOrderFromIndexedDB(orderSnOrTracking: string): Promise<boolean> {
  try {
    const db = await openGineeDB();
    const existing = await findOrderInIndexedDB(orderSnOrTracking);
    const keyToDelete = existing?.orderSn || orderSnOrTracking;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(keyToDelete);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] deleteOrderFromIndexedDB failed:', err);
    return false;
  }
}

/**
 * Menyimpan riwayat scan permanen ke IndexedDB.
 * Data bertahan permanen (lintas hari, lintas minggu) untuk deteksi resi duplikat.
 */
export async function saveScannedRecordToIndexedDB(record: PersistentScanRecord): Promise<void> {
  if (!record || !record.barcode) return;
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SCAN_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SCAN_STORE_NAME);
      store.put(record);
      // Simpan juga berdasarkan trackingNo dan orderSn jika berbeda
      if (record.trackingNo && record.trackingNo !== record.barcode) {
        store.put({ ...record, barcode: record.trackingNo });
      }
      if (record.orderSn && record.orderSn !== record.barcode) {
        store.put({ ...record, barcode: record.orderSn });
      }
      if (record.channelOrderSn && record.channelOrderSn !== record.barcode && record.channelOrderSn !== record.trackingNo && record.channelOrderSn !== record.orderSn) {
        store.put({ ...record, barcode: record.channelOrderSn });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] saveScannedRecordToIndexedDB failed:', err);
  }
}

/**
 * Mencari apakah resi/pesanan sudah pernah discan sebelumnya (lintas hari/minggu) di IndexedDB.
 * Menggunakan indeks B-Tree agar sub-milidetik (<1ms).
 */
export async function findScannedRecordInIndexedDB(query: string): Promise<PersistentScanRecord | null> {
  const clean = (query || '')
    .trim()
    .replace(/^\][a-zA-Z0-9]{2}/, '')
    .trim()
    .toUpperCase();
  if (!clean) return null;
  const strippedClean = clean.replace(/[\s\-_/]/g, '');

  try {
    const db = await openGineeDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SCAN_STORE_NAME, 'readonly');
      const store = tx.objectStore(SCAN_STORE_NAME);

      const tryGet = (indexName: string | null, val: string): Promise<PersistentScanRecord | null> => {
        return new Promise((res) => {
          try {
            if (indexName && !store.indexNames.contains(indexName)) {
              res(null);
              return;
            }
            const r = indexName ? store.index(indexName).get(val) : store.get(val);
            r.onsuccess = () => res(r.result || null);
            r.onerror = () => res(null);
          } catch {
            res(null);
          }
        });
      };

      (async () => {
        // 1. Cek langsung primary key barcode
        let found = await tryGet(null, clean);
        if (found) { resolve(found); return; }

        // 2. Cek index trackingNo
        found = await tryGet('trackingNo', clean);
        if (found) { resolve(found); return; }

        // 3. Cek index orderSn
        found = await tryGet('orderSn', clean);
        if (found) { resolve(found); return; }

        // 4. Cek stripped
        if (strippedClean.length >= 6) {
          found = await tryGet(null, strippedClean);
          if (found) { resolve(found); return; }
          found = await tryGet('trackingNo', strippedClean);
          if (found) { resolve(found); return; }
        }

        // 5. Cek awalan kurir dihilangkan (SPXID / SPX / JP / JX / TK / GTL / LX / NL / POS / SAP)
        const stripCourierPrefix = (s: string) => s.replace(/^(SPXID|SPX|JP|JX|TK|GTL|LX|NL|POS|SAP)/i, '');
        const normClean = stripCourierPrefix(strippedClean);
        if (normClean.length >= 7 && normClean !== strippedClean) {
          found = await tryGet(null, normClean);
          if (found) { resolve(found); return; }
          found = await tryGet('trackingNo', normClean);
          if (found) { resolve(found); return; }
        }

        resolve(null);
      })();
    });
  } catch (err) {
    console.warn('[IndexedDB] findScannedRecordInIndexedDB failed:', err);
    return null;
  }
}

/**
 * Mengambil seluruh riwayat scan permanen dari IndexedDB.
 */
export async function getAllScannedRecordsFromIndexedDB(): Promise<PersistentScanRecord[]> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SCAN_STORE_NAME, 'readonly');
      const store = tx.objectStore(SCAN_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list: PersistentScanRecord[] = req.result || [];
        // Deduplikasi agar tidak ada catatan scan ganda untuk resi yang sama
        const seen = new Set<string>();
        const uniqueList: PersistentScanRecord[] = [];
        for (const item of list) {
          const key = (item.trackingNo && item.trackingNo !== '-' ? item.trackingNo : (item.channelOrderSn || item.orderSn || item.barcode)).toUpperCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push(item);
          }
        }
        uniqueList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(uniqueList);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] getAllScannedRecordsFromIndexedDB failed:', err);
    return [];
  }
}

/**
 * Menghapus satu riwayat scan dari IndexedDB berdasarkan barcode/trackingNo/orderSn/channelOrderSn/id.
 */
export async function deleteScannedRecordFromIndexedDB(identifier: string): Promise<void> {
  if (!identifier) return;
  try {
    const db = await openGineeDB();
    return new Promise((resolve) => {
      const tx = db.transaction([SCAN_STORE_NAME, STORE_NAME], 'readwrite');
      const store = tx.objectStore(SCAN_STORE_NAME);

      const clean = identifier.trim().toUpperCase();
      const stripped = clean.replace(/[\s\-_/]/g, '');

      // Coba hapus langsung via key primer
      try { store.delete(identifier); } catch {}
      try { store.delete(clean); } catch {}

      // Scan cursor untuk menghapus semua rekaman terkait (misal barcode, trackingNo, orderSn, channelOrderSn, id)
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const val = cursor.value;
          const vBarcode = (val.barcode || '').trim().toUpperCase();
          const vTracking = (val.trackingNo || '').trim().toUpperCase();
          const vOrderSn = (val.orderSn || '').trim().toUpperCase();
          const vChannel = (val.channelOrderSn || '').trim().toUpperCase();
          const vId = (val.id || '').trim();

          const match =
            vId === identifier ||
            val.id === identifier ||
            vBarcode === clean ||
            val.barcode === identifier ||
            (stripped.length >= 6 && vBarcode.replace(/[\s\-_/]/g, '') === stripped) ||
            vTracking === clean ||
            (stripped.length >= 6 && vTracking.replace(/[\s\-_/]/g, '') === stripped) ||
            vOrderSn === clean ||
            (stripped.length >= 6 && vOrderSn.replace(/[\s\-_/]/g, '') === stripped) ||
            vChannel === clean ||
            (stripped.length >= 6 && vChannel.replace(/[\s\-_/]/g, '') === stripped);

          if (match) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      // Reset juga flag isScanned pada orders store jika order ini cocok
      const orderStore = tx.objectStore(STORE_NAME);
      const reqO = orderStore.openCursor();
      reqO.onsuccess = () => {
        const cursor = reqO.result;
        if (cursor) {
          const o = cursor.value;
          const t = (o.trackingNo || '').trim().toUpperCase();
          const sn = (o.orderSn || '').trim().toUpperCase();
          const csn = (o.channelOrderSn || '').trim().toUpperCase();
          if (t === clean || sn === clean || csn === clean || (stripped.length >= 6 && (t.replace(/[\s\-_/]/g, '') === stripped || sn.replace(/[\s\-_/]/g, '') === stripped))) {
            if (o.isScanned) {
              o.isScanned = false;
              delete o.scannedAt;
              cursor.update(o);
            }
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[IndexedDB] deleteScannedRecordFromIndexedDB failed:', err);
  }
}

/**
 * Menghapus seluruh riwayat scan dari IndexedDB (bersih total permanen).
 */
export async function clearScannedRecordsFromIndexedDB(): Promise<void> {
  try {
    const db = await openGineeDB();
    return new Promise((resolve) => {
      const tx = db.transaction([SCAN_STORE_NAME, STORE_NAME], 'readwrite');
      const scanStore = tx.objectStore(SCAN_STORE_NAME);
      scanStore.clear();

      // Reset juga flag isScanned pada seluruh pesanan di orders store
      const orderStore = tx.objectStore(STORE_NAME);
      const req = orderStore.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const val = cursor.value;
          if (val && val.isScanned) {
            val.isScanned = false;
            delete val.scannedAt;
            cursor.update(val);
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[IndexedDB] clearScannedRecordsFromIndexedDB failed:', err);
  }
}

/**
 * Menghapus otomatis pesanan di IndexedDB yang berada di luar rentang 7 hari aktif.
 * Menggunakan cursor streaming tanpa memuat seluruh data ke RAM, aman untuk ratusan ribu pesanan.
 */
export async function purgeExpiredOrdersFromIndexedDB(windowDays = 7): Promise<number> {
  try {
    const db = await openGineeDB();
    const now = new Date();
    // 7 hari window: misal hari ini 24 Okt, rentang 18-24 Okt. Cutoff 18 Okt 00:00:00 WIB
    const cutoffDate = new Date(now.getTime() - (windowDays - 1) * 86400000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    const cutoffThreshold = new Date(`${cutoffDateStr}T00:00:00+07:00`).getTime();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let deletedCount = 0;

      // Iterasi streaming via cursor
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const o = cursor.value;
          const timeVal = o?.orderTime || o?.createAt || o?.updatedAt || o?.payTime;
          let isExpired = false;
          if (timeVal) {
            const t = new Date(timeVal).getTime();
            if (!isNaN(t) && t < cutoffThreshold) {
              isExpired = true;
            }
          } else {
            // Data tanpa tanggal valid dianggap data usang di luar rentang 7 hari aktif
            isExpired = true;
          }
          if (isExpired) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            console.log(`[IndexedDB Cleanup] ✓ Menghapus ${deletedCount} pesanan kadaluarsa sebelum ${cutoffDateStr}.`);
          }
          resolve(deletedCount);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch (err) {
    console.warn('[IndexedDB] purgeExpiredOrdersFromIndexedDB error:', err);
    return 0;
  }
}



