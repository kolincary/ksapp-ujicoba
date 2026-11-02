import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../services/supabaseClient';
import { 
   Search, Calendar as CalendarIcon, RefreshCw, Download, Copy, AlertTriangle, 
   CheckCircle2, Clock, Layers, ArrowRightLeft, ShieldAlert, FileSpreadsheet, 
   User, Filter, Loader2, Check, X, Upload, FileUp, Trash2, Plus, FileText
} from 'lucide-react';

interface ComparisonRecord {
   barcode: string;
   roleA: string; // e.g. PACKING
   employeeNameA?: string;
   timestampA?: number;
   excelFilenameA?: string;
   destinationA?: string;
   
   roleB: string; // e.g. PICKER
   employeeNameB?: string;
   timestampB?: number;
   excelFilenameB?: string;
   destinationB?: string;
   
   status: 'MATCH' | 'ONLY_A' | 'ONLY_B'; // ONLY_A = Resi Gaib / Anomali (Packing ada, Picker tidak ada)
}

interface ExcelOrderRow {
   awb: string;
   orderId: string;
   fileName: string;
}

interface ExcelComparisonRecord {
   barcode: string;
   awb?: string;
   orderId?: string;
   source: 'EXCEL' | 'PACKING' | 'BOTH';
   matchedBy?: 'AWB' | 'ORDER_ID';
   employeeName?: string;
   timestamp?: number;
   excelFilename?: string;
   destination?: string;
   excelFileName?: string;
}

interface DataComparisonViewProps {
   isDarkMode: boolean;
}

// Top-level mode: internal comparison vs excel import comparison
type TopMode = 'INTERNAL' | 'EXCEL_IMPORT';

// Excel comparison active tab
type ExcelTab = 'ONLY_EXCEL' | 'ONLY_PACKING' | 'MATCH_EXCEL' | 'ALL_EXCEL';

// AWB column candidates from marketplace / Ginee exports
const AWB_COLUMN_CANDIDATES = [
   'awb', 'no. tracking', 'no tracking', 'tracking number', 'no.tracking',
   'no_tracking', 'no resi', 'noresi', 'no. resi', 'resi', 'awb/no. tracking',
   'awb / no. tracking', 'awb/no.tracking', 'nomor resi', 'tracking', 'tracking_number',
   'nomor tracking', 'shipping awb', 'no pengiriman', 'nomor pengiriman', 'kode resi',
   'awb number', 'awb no', 'awb_number'
];

// ID Pesanan column candidates from marketplace / Ginee exports
const ORDER_ID_COLUMN_CANDIDATES = [
   'id pesanan', 'no. pesanan', 'no pesanan', 'order id', 'order_id',
   'nomor pesanan', 'order no', 'order_no', 'no. order', 'no order',
   'id_pesanan', 'order number', 'ordernumber', 'kode pesanan',
   'no. transaksi', 'no transaksi', 'id transaksi', 'id_transaksi',
   'transaksi id', 'transaction id', 'reference no', 'ref no'
];

export const DataComparisonView: React.FC<DataComparisonViewProps> = ({ isDarkMode }) => {
   // =================== TOP-LEVEL MODE ===================
   const [topMode, setTopMode] = useState<TopMode>('INTERNAL');

   // =================== INTERNAL COMPARISON STATE ===================
   const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      return d.toISOString().split('T')[0];
   });
   const [endDate, setEndDate] = useState(() => {
      const d = new Date();
      return d.toISOString().split('T')[0];
   });

   const [roleA, setRoleA] = useState<string>('PACKING');
   const [roleB, setRoleB] = useState<string>('PICKER');
   
   const [isLoading, setIsLoading] = useState(false);
   const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
   const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
   const [searchQuery, setSearchQuery] = useState('');
   const [activeTab, setActiveTab] = useState<'ALL' | 'ONLY_A' | 'ONLY_B' | 'MATCH'>('ONLY_A');
   
   const [records, setRecords] = useState<ComparisonRecord[]>([]);
   const [stats, setStats] = useState({
      totalA: 0,
      totalB: 0,
      match: 0,
      onlyA: 0, // Resi Gaib
      onlyB: 0  // Belum Packing
   });

   // Pagination
   const [currentPage, setCurrentPage] = useState(1);
   const [rowsPerPage, setRowsPerPage] = useState(100);
   const [copied, setCopied] = useState(false);

   // DevMode Row Deletion States
   const isDevModeActive = localStorage.getItem('showSecretMenu') === 'true';
   const [selectedComparisonKeys, setSelectedComparisonKeys] = useState<string[]>([]);

   useEffect(() => {
      setSelectedComparisonKeys([]);
   }, [startDate, endDate, roleA, roleB, activeTab]);

   const handleDeleteSingleComparison = async (item: ComparisonRecord) => {
      let targetRole = '';
      if (item.status === 'ONLY_A') targetRole = roleA;
      else if (item.status === 'ONLY_B') targetRole = roleB;
      else targetRole = 'BOTH';

      let msg = '';
      if (targetRole === 'BOTH') {
         msg = `Hapus data scan barcode ${item.barcode} untuk kedua role (${roleA} & ${roleB}) dari database?`;
      } else {
         msg = `Hapus data scan barcode ${item.barcode} untuk role ${targetRole} dari database?`;
      }

      if (!window.confirm(msg)) return;

      try {
         let query = supabase.from('scanned_items').delete().eq('barcode', item.barcode);
         if (targetRole !== 'BOTH') {
            query = query.eq('role', targetRole);
         }
         
         const { error } = await query;
         if (error) throw error;

         alert('Data berhasil dihapus dari database.');
         fetchAndCompareData();
      } catch (err: any) {
         console.error('Error deleting comparison item:', err);
         alert('Gagal menghapus data: ' + err.message);
      }
   };

   const handleBulkDeleteComparison = async () => {
      if (selectedComparisonKeys.length === 0) return;
      if (!window.confirm(`Yakin ingin menghapus ${selectedComparisonKeys.length} records data scan terpilih dari database?`)) {
         return;
      }

      setIsLoading(true);
      try {
         const selectedRecords = records.filter(r => selectedComparisonKeys.includes(`${r.barcode}-${r.status}`));
         const CHUNK_SIZE = 200;

         for (let i = 0; i < selectedRecords.length; i += CHUNK_SIZE) {
            const chunk = selectedRecords.slice(i, i + CHUNK_SIZE);
            
            // ONLY_A
            const chunkOnlyA = chunk.filter(r => r.status === 'ONLY_A').map(r => r.barcode);
            if (chunkOnlyA.length > 0) {
               const { error: errA } = await supabase
                  .from('scanned_items')
                  .delete()
                  .in('barcode', chunkOnlyA)
                  .eq('role', roleA);
               if (errA) throw errA;
            }

            // ONLY_B
            const chunkOnlyB = chunk.filter(r => r.status === 'ONLY_B').map(r => r.barcode);
            if (chunkOnlyB.length > 0) {
               const { error: errB } = await supabase
                  .from('scanned_items')
                  .delete()
                  .in('barcode', chunkOnlyB)
                  .eq('role', roleB);
               if (errB) throw errB;
            }

            // MATCH
            const chunkMatch = chunk.filter(r => r.status === 'MATCH').map(r => r.barcode);
            if (chunkMatch.length > 0) {
               const { error: errMatch } = await supabase
                  .from('scanned_items')
                  .delete()
                  .in('barcode', chunkMatch)
                  .in('role', [roleA, roleB]);
               if (errMatch) throw errMatch;
            }
         }

         alert(`Berhasil menghapus ${selectedRecords.length} data scan.`);
         setSelectedComparisonKeys([]);
         fetchAndCompareData();
      } catch (err: any) {
         console.error('Error bulk deleting comparison items:', err);
         alert('Gagal menghapus data: ' + err.message);
      } finally {
         if (!isBackground) setIsLoading(false);
         else setIsBackgroundRefreshing(false);
      }
   };

   // =================== EXCEL IMPORT STATE ===================
   const [isDragging, setIsDragging] = useState(false);
   const [importedFiles, setImportedFiles] = useState<{ name: string; rows: number }[]>([]);
   const [excelOrderRows, setExcelOrderRows] = useState<ExcelOrderRow[]>([]);
   const [detectedAwbColumn, setDetectedAwbColumn] = useState<string>('');
   const [detectedOrderIdColumn, setDetectedOrderIdColumn] = useState<string>('');
   const [excelRecords, setExcelRecords] = useState<ExcelComparisonRecord[]>([]);
   const [excelStats, setExcelStats] = useState({
      totalExcelOrders: 0,
      totalPacking: 0,
      match: 0,
      onlyExcel: 0,   // Ada di Excel tapi belum di-scan Packing
      onlyPacking: 0   // Ada di Packing tapi tidak ada di Excel (Resi Gaib / Anomali)
   });
   const [excelIsLoading, setExcelIsLoading] = useState(false);
   const [excelProgress, setExcelProgress] = useState<{ current: number; total: number; percent: number; currentFileName: string } | null>(null);
   const [excelSearchQuery, setExcelSearchQuery] = useState('');
   const [excelActiveTab, setExcelActiveTab] = useState<ExcelTab>('ONLY_PACKING');
   const [excelCurrentPage, setExcelCurrentPage] = useState(1);
   const [excelRowsPerPage, setExcelRowsPerPage] = useState(100);
   const [excelCopied, setExcelCopied] = useState(false);
   const [excelStartDate, setExcelStartDate] = useState(() => {
      const d = new Date();
      return d.toISOString().split('T')[0];
   });
   const [excelEndDate, setExcelEndDate] = useState(() => {
      const d = new Date();
      return d.toISOString().split('T')[0];
   });
   const [excelParseError, setExcelParseError] = useState('');
   const fileInputRef = useRef<HTMLInputElement>(null);

   // =================== INTERNAL COMPARISON LOGIC ===================
   const fetchAndCompareData = async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      else setIsBackgroundRefreshing(true);
      try {
         const startMs = new Date(`${startDate}T00:00:00.000`).getTime();
         const endMs = new Date(`${endDate}T23:59:59.999`).getTime();

         // Fetch data for Role A and Role B in parallel with loop pagination
         const fetchRoleDataInChunks = async (isRoleB: boolean) => {
            const buildQuery = (isCount = false) => {
               let q = supabase.from('scanned_items');
               if (isCount) q = q.select('*', { count: 'exact', head: true });
               else q = q.select('barcode, employee_name, timestamp, excel_filename, destination, role');
               
               if (isRoleB) {
                  q = q.in('role', roleB === 'PICKER' ? ['PICKER', 'PICKER_2'] : [roleB]);
               } else {
                  q = q.eq('role', roleA);
               }
               return q.gte('timestamp', startMs).lte('timestamp', endMs);
            };

            const { count, error: countErr } = await buildQuery(true);
            if (countErr) throw countErr;
            if (!count) return [];

            const chunkSize = 1000;
            const promises = [];
            for (let i = 0; i < count; i += chunkSize) {
               promises.push(buildQuery(false).range(i, i + chunkSize - 1));
            }

            let allRows: any[] = [];
            for (let i = 0; i < promises.length; i += 10) {
               const results = await Promise.all(promises.slice(i, i + 10));
               for (const res of results) {
                  if (res.error) throw res.error;
                  if (res.data) allRows.push(...res.data);
               }
            }
            return allRows;
         };

         const [dataA, dataB] = await Promise.all([
            fetchRoleDataInChunks(false),
            fetchRoleDataInChunks(true)
         ]);

         // Build fast Hash Maps for O(1) matching
         const mapA = new Map<string, any>();
         dataA.forEach(item => {
            if (item.barcode) {
               const normBC = item.barcode.trim().toUpperCase();
               if (!mapA.has(normBC)) {
                  mapA.set(normBC, item);
               }
            }
         });

         const mapB = new Map<string, any>();
         dataB.forEach(item => {
            if (item.barcode) {
               const normBC = item.barcode.trim().toUpperCase();
               if (!mapB.has(normBC)) {
                  mapB.set(normBC, item);
               }
            }
         });

         // All unique barcodes across A and B
         const allBarcodesSet = new Set<string>([...mapA.keys(), ...mapB.keys()]);
         
         const compResults: ComparisonRecord[] = [];
         let matchCount = 0;
         let onlyACount = 0;
         let onlyBCount = 0;

         allBarcodesSet.forEach(bc => {
            const itemA = mapA.get(bc);
            const itemB = mapB.get(bc);

            let status: 'MATCH' | 'ONLY_A' | 'ONLY_B';

            if (itemA && itemB) {
               status = 'MATCH';
               matchCount++;
            } else if (itemA && !itemB) {
               status = 'ONLY_A';
               onlyACount++;
            } else {
               status = 'ONLY_B';
               onlyBCount++;
            }

            compResults.push({
               barcode: bc,
               roleA: roleA,
               employeeNameA: itemA?.employee_name || '-',
               timestampA: itemA ? Number(itemA.timestamp) : undefined,
               excelFilenameA: itemA?.excel_filename || '-',
               destinationA: itemA?.destination || '-',
               
               roleB: roleB,
               employeeNameB: itemB?.employee_name || '-',
               timestampB: itemB ? Number(itemB.timestamp) : undefined,
               excelFilenameB: itemB?.excel_filename || '-',
               destinationB: itemB?.destination || '-',
               
               status: status
            });
         });

         setRecords(compResults);
         setStats({
            totalA: mapA.size,
            totalB: mapB.size,
            match: matchCount,
            onlyA: onlyACount,
            onlyB: onlyBCount
         });
         setCurrentPage(1);
      } catch (err: any) {
         console.error('Error fetching comparison data:', err);
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      let interval: any;
      if (topMode === 'INTERNAL') {
         fetchAndCompareData();
         
         if (autoRefreshEnabled) {
            interval = setInterval(() => {
               fetchAndCompareData(true);
            }, 30000);
         }
      }
      return () => {
         if (interval) clearInterval(interval);
      };
   }, [startDate, endDate, roleA, roleB, topMode, autoRefreshEnabled]);

   // Filter records by tab & search query
   const filteredRecords = useMemo(() => {
      return records.filter(r => {
         // Filter tab
         if (activeTab === 'ONLY_A' && r.status !== 'ONLY_A') return false;
         if (activeTab === 'ONLY_B' && r.status !== 'ONLY_B') return false;
         if (activeTab === 'MATCH' && r.status !== 'MATCH') return false;

         // Search query
         if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            const matchBC = r.barcode.toLowerCase().includes(q);
            const matchNameA = r.employeeNameA?.toLowerCase().includes(q);
            const matchNameB = r.employeeNameB?.toLowerCase().includes(q);
            const matchFileA = r.excelFilenameA?.toLowerCase().includes(q);
            return matchBC || matchNameA || matchNameB || matchFileA;
         }
         return true;
      });
   }, [records, activeTab, searchQuery]);

   // Paginated records
   const paginatedRecords = useMemo(() => {
      const start = (currentPage - 1) * rowsPerPage;
      return filteredRecords.slice(start, start + rowsPerPage);
   }, [filteredRecords, currentPage, rowsPerPage]);

   const totalPages = Math.ceil(filteredRecords.length / rowsPerPage) || 1;

   // Export to CSV
   const handleExportCSV = () => {
      if (filteredRecords.length === 0) return;
      const headers = ['Barcode', 'Status', `Staff (${roleA})`, `Waktu (${roleA})`, `Staff (${roleB})`, `Waktu (${roleB})`, 'Excel Filename'];
      const rows = filteredRecords.map(r => [
         `"${r.barcode}"`,
         r.status === 'ONLY_A' ? 'RESI GAIB / ANOMALI' : r.status === 'ONLY_B' ? 'BELUM PACKING' : 'VALID MATCH',
         `"${r.employeeNameA || '-'}"`,
         r.timestampA ? `"${new Date(r.timestampA).toLocaleString('id-ID')}"` : '-',
         `"${r.employeeNameB || '-'}"`,
         r.timestampB ? `"${new Date(r.timestampB).toLocaleString('id-ID')}"` : '-',
         `"${r.excelFilenameA || r.excelFilenameB || '-'}"`
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Komparasi_${roleA}_vs_${roleB}_${startDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   // Copy Barcode List
   const handleCopyBarcodes = () => {
      let list = '';
      if (selectedComparisonKeys.length > 0) {
         list = records
            .filter(r => selectedComparisonKeys.includes(`${r.barcode}-${r.status}`))
            .map(r => r.barcode)
            .join('\n');
      } else {
         list = filteredRecords.map(r => r.barcode).join('\n');
      }
      navigator.clipboard.writeText(list);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
   };

   // =================== EXCEL IMPORT LOGIC ===================

   const detectColumn = (headers: string[], candidates: string[]): string | null => {
      for (const header of headers) {
         const norm = header.toLowerCase().trim().replace(/\s+/g, ' ');
         for (const candidate of candidates) {
            if (norm === candidate || norm.includes(candidate)) {
               return header;
            }
         }
      }
      return null;
   };

   const processExcelFiles = useCallback(async (files: File[]) => {
      setExcelParseError('');
      setExcelIsLoading(true);

      try {
         const newImportedFiles: { name: string; rows: number }[] = [];
         const newOrderRows: ExcelOrderRow[] = [];
         let foundAwbColName = '';
         let foundOrderIdColName = '';
         const errors: string[] = [];

         const totalFiles = files.length;
         setExcelProgress({ current: 0, total: totalFiles, percent: 0, currentFileName: files[0]?.name || '' });

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pct = Math.round(((i + 1) / totalFiles) * 100);
            setExcelProgress({
               current: i + 1,
               total: totalFiles,
               percent: pct,
               currentFileName: file.name
            });

            // Brief yield to render UI frame
            await new Promise(r => setTimeout(r, 40));

            try {
               const arrayBuffer = await file.arrayBuffer();
               const wb = XLSX.read(arrayBuffer, { type: 'array' });

               let fileRowsCount = 0;
               let fileFound = false;

               for (const sheetName of wb.SheetNames) {
                  const ws = wb.Sheets[sheetName];
                  const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
                  if (jsonData.length === 0) continue;

                  const headers = Object.keys(jsonData[0]);
                  const awbCol = detectColumn(headers, AWB_COLUMN_CANDIDATES);
                  const orderIdCol = detectColumn(headers, ORDER_ID_COLUMN_CANDIDATES);

                  if (awbCol || orderIdCol) {
                     fileFound = true;
                     if (awbCol && !foundAwbColName) foundAwbColName = awbCol;
                     if (orderIdCol && !foundOrderIdColName) foundOrderIdColName = orderIdCol;

                     jsonData.forEach(row => {
                        const awbVal = awbCol ? String(row[awbCol] || '').trim().toUpperCase() : '';
                        const orderIdVal = orderIdCol ? String(row[orderIdCol] || '').trim().toUpperCase() : '';

                        const cleanAwb = (awbVal && awbVal !== '-' && awbVal !== 'UNDEFINED' && awbVal !== 'NULL') ? awbVal : '';
                        const cleanOrderId = (orderIdVal && orderIdVal !== '-' && orderIdVal !== 'UNDEFINED' && orderIdVal !== 'NULL') ? orderIdVal : '';

                        if (cleanAwb || cleanOrderId) {
                           newOrderRows.push({
                              awb: cleanAwb,
                              orderId: cleanOrderId,
                              fileName: file.name
                           });
                           fileRowsCount++;
                        }
                     });

                     break; // Sheet handled
                  }
               }

               if (fileFound) {
                  newImportedFiles.push({ name: file.name, rows: fileRowsCount });
               } else {
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
                  const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
                  errors.push(`File "${file.name}": Kolom AWB / ID Pesanan tidak terdeteksi. Kolom yang ada: ${headers.join(', ')}`);
               }
            } catch (err: any) {
               errors.push(`File "${file.name}": Gagal membaca file (${err.message})`);
            }
         }

         if (errors.length > 0 && newImportedFiles.length === 0) {
            setExcelParseError(errors.join('\n'));
            setExcelIsLoading(false);
            return;
         } else if (errors.length > 0) {
            setExcelParseError(`Beberapa file memiliki catatan:\n` + errors.join('\n'));
         }

         setImportedFiles(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            const filteredNew = newImportedFiles.filter(f => !existingNames.has(f.name));
            return [...prev, ...filteredNew];
         });

         setExcelOrderRows(prev => {
            const existingKeys = new Set(prev.map(r => `${r.awb}|${r.orderId}`));
            const uniqueNew = newOrderRows.filter(r => !existingKeys.has(`${r.awb}|${r.orderId}`));
            return [...prev, ...uniqueNew];
         });

         if (foundAwbColName) setDetectedAwbColumn(foundAwbColName);
         if (foundOrderIdColName) setDetectedOrderIdColumn(foundOrderIdColName);

      } catch (globalErr: any) {
         setExcelParseError(`Terjadi kesalahan saat memproses file: ${globalErr.message}`);
      } finally {
         setExcelIsLoading(false);
         setExcelProgress(null);
      }
   }, []);

   // Drag & Drop handlers
   const handleDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
   }, []);

   const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget === e.target) {
         setIsDragging(false);
      }
   }, []);

   const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
   }, []);

   const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter((file: File) => {
         const ext = file.name.split('.').pop()?.toLowerCase();
         return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
      });

      if (validFiles.length > 0) {
         processExcelFiles(validFiles);
      } else {
         setExcelParseError('Format file tidak didukung. Gunakan file .xlsx, .xls, atau .csv');
      }
   }, [processExcelFiles]);

   const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
         processExcelFiles(files);
      }
      if (fileInputRef.current) {
         fileInputRef.current.value = '';
      }
   }, [processExcelFiles]);

   // Compare Excel order rows vs Packing data
   const compareExcelVsPacking = useCallback(async () => {
      if (excelOrderRows.length === 0) return;
      
      setExcelIsLoading(true);
      try {
         const startMs = new Date(`${excelStartDate}T00:00:00.000`).getTime();
         const endMs = new Date(`${excelEndDate}T23:59:59.999`).getTime();

         // Fetch ALL packing data in date range using loop pagination to bypass 1000 limit
         let packingData: any[] = [];
         let pOffset = 0;
         const pChunkSize = 1000;
         while (true) {
            const { data, error } = await supabase
               .from('scanned_items')
               .select('barcode, employee_name, timestamp, excel_filename, destination, role')
               .eq('role', 'PACKING')
               .gte('timestamp', startMs)
               .lte('timestamp', endMs)
               .range(pOffset, pOffset + pChunkSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;
            packingData.push(...data);
            if (data.length < pChunkSize) break;
            pOffset += pChunkSize;
         }

         const dataP = packingData;

         // Build packing scan hash map: barcode -> packingItem
         const packingMap = new Map<string, any>();
         dataP.forEach(item => {
            if (item.barcode) {
               const norm = item.barcode.trim().toUpperCase();
               if (!packingMap.has(norm)) {
                  packingMap.set(norm, item);
               }
            }
         });

         // Build lookup maps from Excel AWBs and Order IDs
         const awbToExcelMap = new Map<string, ExcelOrderRow>();
         const orderIdToExcelMap = new Map<string, ExcelOrderRow>();

         excelOrderRows.forEach(row => {
            if (row.awb) awbToExcelMap.set(row.awb, row);
            if (row.orderId) orderIdToExcelMap.set(row.orderId, row);
         });

         const results: ExcelComparisonRecord[] = [];
         let matchCount = 0;
         let onlyExcelCount = 0;
         let onlyPackingCount = 0;

         const matchedExcelOrders = new Set<ExcelOrderRow>();
         const matchedPackingBarcodes = new Set<string>();

         // 1. Process all Excel Orders (Check if AWB or ID Pesanan was scanned by Packing)
         excelOrderRows.forEach(row => {
            const packingItemAwb = row.awb ? packingMap.get(row.awb) : null;
            const packingItemOrderId = row.orderId ? packingMap.get(row.orderId) : null;
            
            const packingMatch = packingItemAwb || packingItemOrderId;

            if (packingMatch) {
               matchedExcelOrders.add(row);
               if (row.awb && packingItemAwb) matchedPackingBarcodes.add(row.awb);
               if (row.orderId && packingItemOrderId) matchedPackingBarcodes.add(row.orderId);

               matchCount++;
               results.push({
                  barcode: packingItemAwb ? row.awb : (row.orderId || row.awb),
                  awb: row.awb,
                  orderId: row.orderId,
                  source: 'BOTH',
                  matchedBy: packingItemAwb ? 'AWB' : 'ORDER_ID',
                  employeeName: packingMatch.employee_name || '-',
                  timestamp: Number(packingMatch.timestamp),
                  excelFilename: packingMatch.excel_filename || '-',
                  destination: packingMatch.destination || '-',
                  excelFileName: row.fileName
               });
            } else {
               onlyExcelCount++;
               results.push({
                  barcode: row.awb || row.orderId,
                  awb: row.awb,
                  orderId: row.orderId,
                  source: 'EXCEL',
                  excelFileName: row.fileName
               });
            }
         });

         // 2. Process Packing Scans that did not match any AWB or Order ID in Excel
         packingMap.forEach((item, bc) => {
            if (!matchedPackingBarcodes.has(bc) && !awbToExcelMap.has(bc) && !orderIdToExcelMap.has(bc)) {
               onlyPackingCount++;
               results.push({
                  barcode: bc,
                  source: 'PACKING',
                  employeeName: item.employee_name || '-',
                  timestamp: Number(item.timestamp),
                  excelFilename: item.excel_filename || '-',
                  destination: item.destination || '-'
               });
            }
         });

         setExcelRecords(results);
         setExcelStats({
            totalExcelOrders: excelOrderRows.length,
            totalPacking: packingMap.size,
            match: matchCount,
            onlyExcel: onlyExcelCount,
            onlyPacking: onlyPackingCount
         });
         setExcelCurrentPage(1);
         setExcelActiveTab('ONLY_PACKING');
      } catch (err: any) {
         console.error('Error comparing Excel vs Packing:', err);
         setExcelParseError(`Gagal memuat data packing: ${err.message}`);
      } finally {
         setExcelIsLoading(false);
      }
   }, [excelOrderRows, excelStartDate, excelEndDate]);

   // Auto-compare when excel data and dates change
   useEffect(() => {
      if (excelOrderRows.length > 0 && topMode === 'EXCEL_IMPORT') {
         compareExcelVsPacking();
      }
   }, [excelOrderRows, excelStartDate, excelEndDate, topMode]);

   // Filter excel records
   const filteredExcelRecords = useMemo(() => {
      return excelRecords.filter(r => {
         if (excelActiveTab === 'ONLY_EXCEL' && r.source !== 'EXCEL') return false;
         if (excelActiveTab === 'ONLY_PACKING' && r.source !== 'PACKING') return false;
         if (excelActiveTab === 'MATCH_EXCEL' && r.source !== 'BOTH') return false;

         if (excelSearchQuery) {
            const q = excelSearchQuery.toLowerCase().trim();
            const matchBC = r.barcode.toLowerCase().includes(q);
            const matchAwb = r.awb?.toLowerCase().includes(q);
            const matchOrderId = r.orderId?.toLowerCase().includes(q);
            const matchName = r.employeeName?.toLowerCase().includes(q);
            const matchFile = r.excelFilename?.toLowerCase().includes(q);
            return matchBC || matchAwb || matchOrderId || matchName || matchFile;
         }
         return true;
      });
   }, [excelRecords, excelActiveTab, excelSearchQuery]);

   const paginatedExcelRecords = useMemo(() => {
      const start = (excelCurrentPage - 1) * excelRowsPerPage;
      return filteredExcelRecords.slice(start, start + excelRowsPerPage);
   }, [filteredExcelRecords, excelCurrentPage, excelRowsPerPage]);

   const excelTotalPages = Math.ceil(filteredExcelRecords.length / excelRowsPerPage) || 1;

   const handleExcelExportCSV = () => {
      if (filteredExcelRecords.length === 0) return;
      const headers = ['Barcode Scanned / Order', 'Status', 'AWB (No Resi)', 'ID Pesanan', 'Metode Match', 'Staff Packing', 'Waktu Scan', 'File Sumber'];
      const rows = filteredExcelRecords.map(r => [
         `"${r.barcode}"`,
         r.source === 'BOTH' ? 'VALID MATCH' : r.source === 'EXCEL' ? 'HANYA DI EXCEL' : 'RESI GAIB (HANYA PACKING)',
         `"${r.awb || '-'}"`,
         `"${r.orderId || '-'}"`,
         r.matchedBy ? `Matched via ${r.matchedBy}` : '-',
         `"${r.employeeName || '-'}"`,
         r.timestamp ? `"${new Date(r.timestamp).toLocaleString('id-ID')}"` : '-',
         `"${r.excelFileName || r.excelFilename || '-'}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Excel_vs_Packing_${excelStartDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const handleExcelCopyBarcodes = () => {
      let list = '';
      if (selectedComparisonKeys.length > 0) {
         list = excelRecords
            .filter(r => selectedComparisonKeys.includes(`${r.barcode}-${r.source}`))
            .map(r => r.barcode)
            .join('\n');
      } else {
         list = filteredExcelRecords.map(r => r.barcode).join('\n');
      }
      navigator.clipboard.writeText(list);
      setExcelCopied(true);
      setTimeout(() => setExcelCopied(false), 2500);
   };

   const clearExcelData = () => {
      setImportedFiles([]);
      setExcelOrderRows([]);
      setDetectedAwbColumn('');
      setDetectedOrderIdColumn('');
      setExcelRecords([]);
      setExcelStats({ totalExcelOrders: 0, totalPacking: 0, match: 0, onlyExcel: 0, onlyPacking: 0 });
      setExcelParseError('');
      setExcelSearchQuery('');
      setExcelCurrentPage(1);
   };

   const removeImportedFile = (fileName: string) => {
      const remainingFiles = importedFiles.filter(f => f.name !== fileName);
      if (remainingFiles.length === 0) {
         clearExcelData();
      } else {
         setImportedFiles(remainingFiles);
         setExcelOrderRows(prev => prev.filter(r => r.fileName !== fileName));
      }
   };

   return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
         
         {/* HEADER TITLE & MODE SWITCHER */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
            <div>
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl">
                     <ShieldAlert size={26} className="text-indigo-400" />
                  </div>
                  <div>
                     <h1 className="text-xl md:text-2xl font-black tracking-tight">Komparasi Data & Cek Resi Gaib</h1>
                     <p className="text-xs text-indigo-200/80 mt-0.5">Deteksi resi anomali / orderan gaib yang di-scan tanpa data pembanding</p>
                  </div>
               </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm p-1.5 rounded-2xl border border-white/10">
               <button
                  onClick={() => setTopMode('INTERNAL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                     topMode === 'INTERNAL'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-indigo-200 hover:text-white hover:bg-white/10'
                  }`}
               >
                  <ArrowRightLeft size={14} />
                  Komparasi Internal
               </button>
               <button
                  onClick={() => setTopMode('EXCEL_IMPORT')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                     topMode === 'EXCEL_IMPORT'
                        ? 'bg-emerald-600 text-white shadow-lg'
                        : 'text-indigo-200 hover:text-white hover:bg-white/10'
                  }`}
               >
                  <FileUp size={14} />
                  Import Excel Multi-File (Marketplace)
               </button>
            </div>
         </div>

         {/* =================== INTERNAL COMPARISON MODE =================== */}
         {topMode === 'INTERNAL' && (
            <>
               {/* ACTION BUTTONS */}
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={fetchAndCompareData}
                     disabled={isLoading}
                     className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                     <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                     <span>Refresh Data</span>
                  </button>
                  <button
                     onClick={handleExportCSV}
                     disabled={filteredRecords.length === 0}
                     className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                     <FileSpreadsheet size={15} />
                     <span>Export CSV</span>
                  </button>
                  <button
                     onClick={handleCopyBarcodes}
                     disabled={filteredRecords.length === 0}
                     className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                     {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                     <span>{copied ? 'Tersalin!' : 'Salin Barcode'}</span>
                  </button>
                  
                  {isDevModeActive && selectedComparisonKeys.length > 0 && (
                     <button
                        onClick={handleBulkDeleteComparison}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                     >
                        <Trash2 size={15} />
                        <span>Hapus Terpilih ({selectedComparisonKeys.length})</span>
                     </button>
                  )}
               </div>

               {/* FILTER PANEL */}
               <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Start Date */}
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tanggal Mulai</label>
                     <div className="relative">
                        <input
                           type="date"
                           value={startDate}
                           onChange={(e) => setStartDate(e.target.value)}
                           className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                     </div>
                  </div>
                  {/* End Date */}
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tanggal Akhir</label>
                     <div className="relative">
                        <input
                           type="date"
                           value={endDate}
                           onChange={(e) => setEndDate(e.target.value)}
                           className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                     </div>
                  </div>
                  {/* Role A */}
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role Acuan (Target A)</label>
                     <select
                        value={roleA}
                        onChange={(e) => setRoleA(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                        <option value="PACKING">PACKING</option>
                        <option value="PICKER">PICKER</option>
                        <option value="CHECKER">CHECKER</option>
                        <option value="OJOL">OJOL</option>
                        <option value="SORTIR">SORTIR</option>
                     </select>
                  </div>
                  {/* Role B */}
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role Pembanding (Target B)</label>
                     <select
                        value={roleB}
                        onChange={(e) => setRoleB(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-purple-600 dark:text-purple-400 outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                        <option value="PICKER">PICKER (Semua Picker)</option>
                        <option value="PACKING">PACKING</option>
                        <option value="CHECKER">CHECKER</option>
                        <option value="OJOL">OJOL</option>
                        <option value="SORTIR">SORTIR</option>
                     </select>
                  </div>
               </div>

               {/* KPI STAT CARDS */}
               <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Total Role A */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                     <div className="text-xs font-bold text-gray-500 uppercase">Total {roleA}</div>
                     <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                        {stats.totalA.toLocaleString('id-ID')}
                     </div>
                     <div className="text-[11px] text-gray-400 mt-1 font-medium">Data terscan {roleA}</div>
                  </div>
                  {/* Total Role B */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                     <div className="text-xs font-bold text-gray-500 uppercase">Total {roleB}</div>
                     <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
                        {stats.totalB.toLocaleString('id-ID')}
                     </div>
                     <div className="text-[11px] text-gray-400 mt-1 font-medium">Data terscan {roleB}</div>
                  </div>
                  {/* Resi Gaib */}
                  <div 
                     onClick={() => setActiveTab('ONLY_A')}
                     className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                        activeTab === 'ONLY_A'
                           ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800 ring-2 ring-rose-500'
                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-rose-300'
                     }`}
                  >
                     <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase">🚨 Resi Gaib / Anomali</div>
                        <AlertTriangle size={16} className="text-rose-500" />
                     </div>
                     <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
                        {stats.onlyA.toLocaleString('id-ID')}
                     </div>
                     <div className="text-[11px] text-rose-500/80 font-bold mt-1">Ada di {roleA}, Tidak ada di {roleB}</div>
                  </div>
                  {/* Belum Packing */}
                  <div 
                     onClick={() => setActiveTab('ONLY_B')}
                     className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                        activeTab === 'ONLY_B'
                           ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800 ring-2 ring-amber-500'
                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-300'
                     }`}
                  >
                     <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">⏳ Belum Dipacking</div>
                        <Clock size={16} className="text-amber-500" />
                     </div>
                     <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                        {stats.onlyB.toLocaleString('id-ID')}
                     </div>
                     <div className="text-[11px] text-amber-600/80 font-medium mt-1">Ada di {roleB}, Belum di {roleA}</div>
                  </div>
                  {/* Matched */}
                  <div 
                     onClick={() => setActiveTab('MATCH')}
                     className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                        activeTab === 'MATCH'
                           ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 ring-2 ring-emerald-500'
                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                     }`}
                  >
                     <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">✅ Valid & Matched</div>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                     </div>
                     <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                        {stats.match.toLocaleString('id-ID')}
                     </div>
                     <div className="text-[11px] text-emerald-600/80 font-medium mt-1">Ada di {roleA} & {roleB}</div>
                  </div>
               </div>

               {/* MAIN TABLE SECTION */}
               <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                  
                  {/* TABLE CONTROLS BAR */}
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
                     
                     {/* TABS FILTER */}
                     <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
                        <button
                           onClick={() => { setActiveTab('ONLY_A'); setCurrentPage(1); }}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeTab === 'ONLY_A'
                                 ? 'bg-rose-600 text-white shadow-md'
                                 : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                        >
                           🚨 Resi Gaib ({stats.onlyA})
                        </button>
                        <button
                           onClick={() => { setActiveTab('ONLY_B'); setCurrentPage(1); }}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeTab === 'ONLY_B'
                                 ? 'bg-amber-500 text-white shadow-md'
                                 : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                        >
                           ⏳ Belum Dipacking ({stats.onlyB})
                        </button>
                        <button
                           onClick={() => { setActiveTab('MATCH'); setCurrentPage(1); }}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeTab === 'MATCH'
                                 ? 'bg-emerald-600 text-white shadow-md'
                                 : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                        >
                           ✅ Matched ({stats.match})
                        </button>
                        <button
                           onClick={() => { setActiveTab('ALL'); setCurrentPage(1); }}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeTab === 'ALL'
                                 ? 'bg-gray-800 dark:bg-gray-700 text-white shadow-md'
                                 : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                           }`}
                        >
                           Semua ({records.length})
                        </button>
                     </div>

                     {/* SEARCH INPUT */}
                     <div className="relative w-full md:w-80">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                           type="text"
                           value={searchQuery}
                           onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                           placeholder="Cari barcode / nama staff..."
                           className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {searchQuery && (
                           <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <X size={14} />
                           </button>
                        )}
                     </div>

                  </div>

                  {/* TABLE */}
                  <div className="overflow-x-auto min-h-[400px]">
                     {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-indigo-500 gap-3">
                           <Loader2 size={36} className="animate-spin" />
                           <span className="text-xs font-bold text-gray-500">Memproses & Membandingkan Data...</span>
                        </div>
                     ) : paginatedRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                           <CheckCircle2 size={44} className="opacity-30 text-emerald-500" />
                           <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Tidak ada data untuk kategori ini</p>
                           <p className="text-xs text-gray-400">Semua data terverifikasi cocok atau ubah filter tanggal.</p>
                        </div>
                     ) : (
                        <table className="w-full text-left text-xs">
                           <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                  <th className="p-4 w-12">
                                     <input
                                        type="checkbox"
                                        checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedComparisonKeys.includes(`${r.barcode}-${r.status}`))}
                                        onChange={(e) => {
                                           if (e.target.checked) {
                                              const toAdd = paginatedRecords.map(r => `${r.barcode}-${r.status}`);
                                              setSelectedComparisonKeys(prev => Array.from(new Set([...prev, ...toAdd])));
                                           } else {
                                              const toRemove = paginatedRecords.map(r => `${r.barcode}-${r.status}`);
                                              setSelectedComparisonKeys(prev => prev.filter(k => !toRemove.includes(k)));
                                           }
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                     />
                                  </th>
                                  <th className="p-4 w-12">No</th>
                                  <th className="p-4">Barcode Resi</th>
                                  <th className="p-4">Status Komparasi</th>
                                  <th className="p-4">{roleA} (Acuan)</th>
                                  <th className="p-4">{roleB} (Pembanding)</th>
                                  <th className="p-4">File / Halaman</th>
                                  {isDevModeActive && <th className="p-4 text-right w-24">Aksi</th>}
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                              {paginatedRecords.map((item, idx) => {
                                 const rowNum = (currentPage - 1) * rowsPerPage + idx + 1;
                                 
                                 return (
                                    <tr 
                                       key={`${item.barcode}-${idx}`}
                                       className={`transition-colors ${
                                          item.status === 'ONLY_A'
                                             ? 'bg-rose-50/40 hover:bg-rose-50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20'
                                             : item.status === 'ONLY_B'
                                             ? 'bg-amber-50/30 hover:bg-amber-50/60 dark:bg-amber-950/10 dark:hover:bg-amber-950/20'
                                             : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                                       }`}
                                    >
                                       <td className="p-4 w-12">
                                          <input
                                             type="checkbox"
                                             checked={selectedComparisonKeys.includes(`${item.barcode}-${item.status}`)}
                                             onChange={(e) => {
                                                const key = `${item.barcode}-${item.status}`;
                                                if (e.target.checked) {
                                                   setSelectedComparisonKeys(prev => [...prev, key]);
                                                } else {
                                                   setSelectedComparisonKeys(prev => prev.filter(k => k !== key));
                                                }
                                             }}
                                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                       </td>
                                       <td className="p-4 text-gray-400 font-mono text-[11px]">{rowNum}</td>
                                       
                                       {/* Barcode */}
                                       <td className="p-4">
                                          <div className="font-mono font-black text-sm text-gray-900 dark:text-white select-all">
                                             {item.barcode}
                                          </div>
                                       </td>

                                       {/* Status */}
                                       <td className="p-4">
                                          {item.status === 'ONLY_A' && (
                                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                <AlertTriangle size={12} /> Resi Gaib ({roleA})
                                             </span>
                                          )}
                                          {item.status === 'ONLY_B' && (
                                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                <Clock size={12} /> Belum {roleA}
                                             </span>
                                          )}
                                          {item.status === 'MATCH' && (
                                             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                <CheckCircle2 size={12} /> Valid Match
                                             </span>
                                          )}
                                       </td>

                                       {/* Role A Info */}
                                       <td className="p-4">
                                          {item.timestampA ? (
                                             <div>
                                                <div className="font-bold text-gray-800 dark:text-gray-200">{item.employeeNameA}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                   {new Date(item.timestampA).toLocaleString('id-ID')}
                                                </div>
                                             </div>
                                          ) : (
                                             <span className="text-gray-400 italic text-[11px]">- Tidak ada scan -</span>
                                          )}
                                       </td>

                                       {/* Role B Info */}
                                       <td className="p-4">
                                          {item.timestampB ? (
                                             <div>
                                                <div className="font-bold text-gray-800 dark:text-gray-200">{item.employeeNameB}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                   {new Date(item.timestampB).toLocaleString('id-ID')}
                                                </div>
                                             </div>
                                          ) : (
                                             <span className="text-gray-400 italic text-[11px]">- Tidak ada scan -</span>
                                          )}
                                       </td>

                                       {/* Excel / Destination Info */}
                                       <td className="p-4 text-[11px] text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                          {item.excelFilenameA !== '-' ? item.excelFilenameA : (item.excelFilenameB !== '-' ? item.excelFilenameB : (item.destinationA !== '-' ? item.destinationA : item.destinationB))}
                                       </td>
                                    {isDevModeActive && (
                                           <td className="p-4 text-right">
                                              <button
                                                 onClick={() => handleDeleteSingleComparison(item)}
                                                 className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                 title="Hapus data terkait dari database"
                                              >
                                                 <Trash2 size={14} />
                                              </button>
                                           </td>
                                        )}
                                     </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     )}
                  </div>

                  {/* PAGINATION FOOTER */}
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                     <div className="text-xs text-gray-500 font-semibold">
                        Menampilkan {filteredRecords.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} - {Math.min(currentPage * rowsPerPage, filteredRecords.length)} dari {filteredRecords.length} data
                     </div>

                     <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-400 font-bold">Baris per halaman:</span>
                           <select
                              value={rowsPerPage}
                              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold px-2 py-1 outline-none"
                           >
                              <option value={100}>100</option>
                              <option value={200}>200</option>
                              <option value={500}>500</option>
                           </select>
                        </div>

                        <div className="flex items-center gap-1">
                           <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                           >
                              Sebelumnya
                           </button>
                           <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                              {currentPage} / {totalPages}
                           </span>
                           <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage >= totalPages}
                              className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                           >
                              Selanjutnya
                           </button>
                        </div>
                     </div>
                  </div>

               </div>
            </>
         )}

         {/* =================== EXCEL IMPORT MODE =================== */}
         {topMode === 'EXCEL_IMPORT' && (
            <>
               {/* EXCEL DRAG & DROP ZONE */}
               {importedFiles.length === 0 ? (
                  <div className="space-y-4">
                     {/* Instructions */}
                     <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                           <FileSpreadsheet size={18} className="text-emerald-500" />
                           Import Banyak File Excel dari Marketplace / Ginee
                        </h3>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                           Upload <strong>satu atau banyak file Excel sekaligus</strong> (.xlsx, .xls) atau CSV yang berisi data tarikan dari marketplace (Shopee, Tokopedia, Lazada, dll) atau export Ginee. 
                           Sistem secara otomatis membaca 2 kolom utama: <strong className="text-emerald-600 dark:text-emerald-400">AWB / No. Tracking</strong> dan <strong className="text-indigo-600 dark:text-indigo-400">ID Pesanan</strong> untuk mencegah kesalahan deteksi resi gaib jika staff di lapangan ter-scan barcode ID Pesanan.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                           {['AWB', 'No. Tracking', 'No Resi', 'ID Pesanan', 'No. Pesanan', 'Order ID', 'Tracking Number'].map(col => (
                              <span key={col} className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-800">
                                 {col}
                              </span>
                           ))}
                        </div>
                     </div>

                     {/* Progress Bar during Import */}
                     {excelProgress && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-emerald-300 dark:border-emerald-700 shadow-xl space-y-4">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl">
                                    <Loader2 size={24} className="animate-spin text-emerald-600 dark:text-emerald-400" />
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-200">
                                       Meng-import & Membaca File Excel... ({excelProgress.current} / {excelProgress.total})
                                    </h4>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-0.5 truncate max-w-[450px]">
                                       {excelProgress.currentFileName}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                 {excelProgress.percent}%
                              </div>
                           </div>

                           <div className="w-full bg-gray-100 dark:bg-gray-700 h-4 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-600">
                              <div 
                                 className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 h-full rounded-full transition-all duration-300 shadow-sm"
                                 style={{ width: `${excelProgress.percent}%` }}
                              />
                           </div>
                        </div>
                     )}

                     {/* Drop Zone */}
                     <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[280px] ${
                           isDragging
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 scale-[1.02] shadow-xl shadow-emerald-500/10'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
                        }`}
                     >
                        <input
                           ref={fileInputRef}
                           type="file"
                           multiple
                           accept=".xlsx,.xls,.csv"
                           onChange={handleFileInputChange}
                           className="hidden"
                        />
                        
                        <div className={`p-5 rounded-3xl mb-5 transition-all duration-300 ${
                           isDragging
                              ? 'bg-emerald-500 text-white scale-110 shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                        }`}>
                           {isDragging ? <Upload size={40} /> : <FileUp size={40} />}
                        </div>

                        <p className={`text-lg font-black transition-colors ${
                           isDragging 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-gray-700 dark:text-gray-300'
                        }`}>
                           {isDragging ? '📥 Lepaskan file Excel di sini!' : 'Seret & Lepas Banyak File Excel di sini'}
                        </p>
                        <p className="text-xs text-gray-400 mt-2 font-medium">
                           bisa pilih <span className="text-emerald-600 dark:text-emerald-400 font-bold underline">banyak file sekaligus dari File Explorer</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-4 font-semibold">
                           Mendukung format: .xlsx, .xls, .csv (Multi-file)
                        </p>
                     </div>

                     {/* Parse Error */}
                     {excelParseError && (
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-5">
                           <div className="flex items-start gap-3">
                              <AlertTriangle size={20} className="text-rose-500 mt-0.5 flex-shrink-0" />
                              <div>
                                 <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Catatan Import File</p>
                                 <pre className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-2 whitespace-pre-wrap font-mono leading-relaxed">{excelParseError}</pre>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               ) : (
                  <>
                     {/* Hidden Multi-file input for adding more files */}
                     <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInputChange}
                        className="hidden"
                     />

                     {/* File Info & Multi-file Badge List */}
                     <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
                                 <FileSpreadsheet size={22} className="text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                 <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                                    {importedFiles.length} File Excel Di-import ({excelOrderRows.length.toLocaleString('id-ID')} Total Order Unique)
                                 </p>
                                 <div className="flex flex-wrap items-center gap-2.5 mt-1">
                                    {detectedAwbColumn && (
                                       <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-md">
                                          AWB: {detectedAwbColumn}
                                       </span>
                                    )}
                                    {detectedOrderIdColumn && (
                                       <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 rounded-md">
                                          ID Pesanan: {detectedOrderIdColumn}
                                       </span>
                                    )}
                                 </div>
                              </div>
                           </div>

                           <div className="flex flex-wrap items-center gap-2">
                              <button
                                 onClick={() => fileInputRef.current?.click()}
                                 className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                 <Plus size={14} />
                                 Tambah File Excel
                              </button>
                              <button
                                 onClick={compareExcelVsPacking}
                                 disabled={excelIsLoading}
                                 className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                              >
                                 <RefreshCw size={14} className={excelIsLoading ? 'animate-spin' : ''} />
                                 Refresh Perbandingan
                              </button>
                              <button
                                 onClick={clearExcelData}
                                 className="px-3.5 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-gray-700 hover:text-rose-600 dark:text-gray-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                 <Trash2 size={14} />
                                 Hapus Semua File
                              </button>
                           </div>
                        </div>

                        {/* List of imported files */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                           {importedFiles.map((file, idx) => (
                              <div 
                                 key={`${file.name}-${idx}`}
                                 className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 rounded-xl shadow-sm text-xs font-semibold text-gray-800 dark:text-gray-200"
                              >
                                 <FileText size={13} className="text-emerald-500" />
                                 <span className="font-bold">{file.name}</span>
                                 <span className="text-[10px] text-gray-400 font-mono">({file.rows} baris)</span>
                                 <button
                                    onClick={() => removeImportedFile(file.name)}
                                    className="text-gray-400 hover:text-rose-500 ml-1"
                                    title="Hapus file ini"
                                 >
                                    <X size={13} />
                                 </button>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Parse Warnings */}
                     {excelParseError && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                           <div className="flex items-start gap-3">
                              <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <pre className="text-xs text-amber-700 dark:text-amber-300 font-mono whitespace-pre-wrap">{excelParseError}</pre>
                           </div>
                        </div>
                     )}

                     {/* Excel Date Range Filter */}
                     <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tanggal Mulai (Data Scan Packing)</label>
                           <input
                              type="date"
                              value={excelStartDate}
                              onChange={(e) => setExcelStartDate(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tanggal Akhir (Data Scan Packing)</label>
                           <input
                              type="date"
                              value={excelEndDate}
                              onChange={(e) => setExcelEndDate(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
                           />
                        </div>
                     </div>

                     {/* Excel KPI Cards */}
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Total Excel */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                           <div className="text-xs font-bold text-gray-500 uppercase">Total Order Excel</div>
                           <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{excelStats.totalExcelOrders.toLocaleString('id-ID')}</div>
                           <div className="text-[11px] text-gray-400 mt-1 font-medium">Order dari {importedFiles.length} file</div>
                        </div>
                        {/* Total Packing */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                           <div className="text-xs font-bold text-gray-500 uppercase">Total Scan Packing</div>
                           <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{excelStats.totalPacking.toLocaleString('id-ID')}</div>
                           <div className="text-[11px] text-gray-400 mt-1 font-medium">Data scan PACKING</div>
                        </div>
                        {/* Resi Gaib (Only Packing) */}
                        <div 
                           onClick={() => { setExcelActiveTab('ONLY_PACKING'); setExcelCurrentPage(1); }}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                              excelActiveTab === 'ONLY_PACKING'
                                 ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800 ring-2 ring-rose-500'
                                 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-rose-300'
                           }`}
                        >
                           <div className="flex items-center justify-between">
                              <div className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase">🚨 Resi Gaib</div>
                              <AlertTriangle size={16} className="text-rose-500" />
                           </div>
                           <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{excelStats.onlyPacking.toLocaleString('id-ID')}</div>
                           <div className="text-[11px] text-rose-500/80 font-bold mt-1">Scan Packing, TIDAK ada di Excel (AWB / ID)</div>
                        </div>
                        {/* Only Excel (belum scan packing) */}
                        <div 
                           onClick={() => { setExcelActiveTab('ONLY_EXCEL'); setExcelCurrentPage(1); }}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                              excelActiveTab === 'ONLY_EXCEL'
                                 ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800 ring-2 ring-amber-500'
                                 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-300'
                           }`}
                        >
                           <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">⏳ Belum Dipacking</div>
                              <Clock size={16} className="text-amber-500" />
                           </div>
                           <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{excelStats.onlyExcel.toLocaleString('id-ID')}</div>
                           <div className="text-[11px] text-amber-600/80 font-medium mt-1">Ada di Excel, belum di-scan</div>
                        </div>
                        {/* Matched */}
                        <div 
                           onClick={() => { setExcelActiveTab('MATCH_EXCEL'); setExcelCurrentPage(1); }}
                           className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                              excelActiveTab === 'MATCH_EXCEL'
                                 ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800 ring-2 ring-emerald-500'
                                 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                           }`}
                        >
                           <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">✅ Valid Match</div>
                              <CheckCircle2 size={16} className="text-emerald-500" />
                           </div>
                           <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{excelStats.match.toLocaleString('id-ID')}</div>
                           <div className="text-[11px] text-emerald-600/80 font-medium mt-1">Cocok via AWB / ID Pesanan</div>
                        </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex flex-wrap items-center gap-3">
                        <button
                           onClick={handleExcelExportCSV}
                           disabled={filteredExcelRecords.length === 0}
                           className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                           <FileSpreadsheet size={15} />
                           <span>Export CSV</span>
                        </button>
                        <button
                           onClick={handleExcelCopyBarcodes}
                           disabled={filteredExcelRecords.length === 0}
                           className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                           {excelCopied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                           <span>{excelCopied ? 'Tersalin!' : 'Salin Barcode'}</span>
                        </button>

                        {isDevModeActive && selectedComparisonKeys.length > 0 && (
                           <button
                              onClick={handleBulkDeleteComparison}
                              className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                           >
                              <Trash2 size={15} />
                              <span>Hapus Terpilih ({selectedComparisonKeys.length})</span>
                           </button>
                        )}
                     </div>

                     {/* Excel Comparison Table */}
                     <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                        
                        {/* Table Controls */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
                           <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
                              <button
                                 onClick={() => { setExcelActiveTab('ONLY_PACKING'); setExcelCurrentPage(1); }}
                                 className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    excelActiveTab === 'ONLY_PACKING'
                                       ? 'bg-rose-600 text-white shadow-md'
                                       : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                 }`}
                              >
                                 🚨 Resi Gaib ({excelStats.onlyPacking})
                              </button>
                              <button
                                 onClick={() => { setExcelActiveTab('ONLY_EXCEL'); setExcelCurrentPage(1); }}
                                 className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    excelActiveTab === 'ONLY_EXCEL'
                                       ? 'bg-amber-500 text-white shadow-md'
                                       : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                 }`}
                              >
                                 ⏳ Belum Dipacking ({excelStats.onlyExcel})
                              </button>
                              <button
                                 onClick={() => { setExcelActiveTab('MATCH_EXCEL'); setExcelCurrentPage(1); }}
                                 className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    excelActiveTab === 'MATCH_EXCEL'
                                       ? 'bg-emerald-600 text-white shadow-md'
                                       : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                 }`}
                              >
                                 ✅ Matched ({excelStats.match})
                              </button>
                              <button
                                 onClick={() => { setExcelActiveTab('ALL_EXCEL'); setExcelCurrentPage(1); }}
                                 className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    excelActiveTab === 'ALL_EXCEL'
                                       ? 'bg-gray-800 dark:bg-gray-700 text-white shadow-md'
                                       : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                 }`}
                              >
                                 Semua ({excelRecords.length})
                              </button>
                           </div>

                           {/* Search */}
                           <div className="relative w-full md:w-80">
                              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                 type="text"
                                 value={excelSearchQuery}
                                 onChange={(e) => { setExcelSearchQuery(e.target.value); setExcelCurrentPage(1); }}
                                 placeholder="Cari barcode / AWB / ID Pesanan..."
                                 className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              {excelSearchQuery && (
                                 <button onClick={() => setExcelSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                 </button>
                              )}
                           </div>
                        </div>

                        {/* Table Body */}
                        <div className="overflow-x-auto min-h-[400px]">
                           {excelIsLoading ? (
                              <div className="flex flex-col items-center justify-center py-20 text-emerald-500 gap-3">
                                 <Loader2 size={36} className="animate-spin" />
                                 <span className="text-xs font-bold text-gray-500">Mencocokkan data Excel (AWB + ID Pesanan) vs Scan Packing...</span>
                              </div>
                           ) : paginatedExcelRecords.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                                 <CheckCircle2 size={44} className="opacity-30 text-emerald-500" />
                                 <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Tidak ada data untuk kategori ini</p>
                                 <p className="text-xs text-gray-400">Ubah tab atau filter tanggal.</p>
                              </div>
                           ) : (
                              <table className="w-full text-left text-xs">
                                 <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                       <th className="p-4 w-12">
                                          <input
                                             type="checkbox"
                                             checked={paginatedExcelRecords.length > 0 && paginatedExcelRecords.every(r => selectedComparisonKeys.includes(`${r.barcode}-${r.source}`))}
                                             onChange={(e) => {
                                                if (e.target.checked) {
                                                   const toAdd = paginatedExcelRecords.map(r => `${r.barcode}-${r.source}`);
                                                   setSelectedComparisonKeys(prev => Array.from(new Set([...prev, ...toAdd])));
                                                } else {
                                                   const toRemove = paginatedExcelRecords.map(r => `${r.barcode}-${r.source}`);
                                                   setSelectedComparisonKeys(prev => prev.filter(k => !toRemove.includes(k)));
                                                }
                                             }}
                                             className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                          />
                                       </th>
                                       <th className="p-4 w-12">No</th>
                                       <th className="p-4">Barcode Scanned</th>
                                       <th className="p-4">Status</th>
                                       <th className="p-4">Detail Order Excel (AWB & ID)</th>
                                       <th className="p-4">Staff Packing</th>
                                       <th className="p-4">Waktu Scan</th>
                                       <th className="p-4">File Sumber</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                                    {paginatedExcelRecords.map((item, idx) => {
                                       const rowNum = (excelCurrentPage - 1) * excelRowsPerPage + idx + 1;
                                       
                                       return (
                                          <tr 
                                             key={`excel-${item.barcode}-${idx}`}
                                             className={`transition-colors ${
                                                item.source === 'PACKING'
                                                   ? 'bg-rose-50/40 hover:bg-rose-50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20'
                                                   : item.source === 'EXCEL'
                                                   ? 'bg-amber-50/30 hover:bg-amber-50/60 dark:bg-amber-950/10 dark:hover:bg-amber-950/20'
                                                   : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                                             }`}
                                          >
                                          <td className="p-4 w-12">
                                             <input
                                                type="checkbox"
                                                checked={selectedComparisonKeys.includes(`${item.barcode}-${item.source}`)}
                                                onChange={(e) => {
                                                   const key = `${item.barcode}-${item.source}`;
                                                   if (e.target.checked) {
                                                      setSelectedComparisonKeys(prev => [...prev, key]);
                                                   } else {
                                                      setSelectedComparisonKeys(prev => prev.filter(k => k !== key));
                                                   }
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                             />
                                          </td>
                                       <td className="p-4 text-gray-400 font-mono text-[11px]">{rowNum}</td>
                                             
                                             {/* Barcode Scanned */}
                                             <td className="p-4">
                                                <div className="font-mono font-black text-sm text-gray-900 dark:text-white select-all">
                                                   {item.barcode}
                                                </div>
                                             </td>

                                             {/* Status */}
                                             <td className="p-4">
                                                {item.source === 'PACKING' && (
                                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                      <AlertTriangle size={12} /> Resi Gaib (Packing)
                                                   </span>
                                                )}
                                                {item.source === 'EXCEL' && (
                                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                      <Clock size={12} /> Belum Dipacking
                                                   </span>
                                                )}
                                                {item.source === 'BOTH' && (
                                                   <div className="flex flex-col gap-1">
                                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                         <CheckCircle2 size={12} /> Valid Match
                                                      </span>
                                                      {item.matchedBy && (
                                                         <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                                            Matched via <strong className="text-emerald-600 dark:text-emerald-400">{item.matchedBy}</strong>
                                                         </span>
                                                      )}
                                                   </div>
                                                )}
                                             </td>

                                             {/* Detail Order Excel (AWB + ID Pesanan) */}
                                             <td className="p-4">
                                                <div className="space-y-0.5">
                                                   {item.awb && (
                                                      <div className="text-[11px] font-mono">
                                                         <span className="text-gray-400 font-sans font-medium">AWB: </span>
                                                         <span className="font-bold text-emerald-700 dark:text-emerald-300 select-all">{item.awb}</span>
                                                      </div>
                                                   )}
                                                   {item.orderId && (
                                                      <div className="text-[11px] font-mono">
                                                         <span className="text-gray-400 font-sans font-medium">ID Pesanan: </span>
                                                         <span className="font-bold text-indigo-700 dark:text-indigo-300 select-all">{item.orderId}</span>
                                                      </div>
                                                   )}
                                                   {!item.awb && !item.orderId && (
                                                      <span className="text-gray-400 italic text-[11px]">- Tidak ada di Excel -</span>
                                                   )}
                                                </div>
                                             </td>

                                             {/* Staff Packing */}
                                             <td className="p-4">
                                                {item.employeeName && item.employeeName !== '-' ? (
                                                   <div className="font-bold text-gray-800 dark:text-gray-200">{item.employeeName}</div>
                                                ) : (
                                                   <span className="text-gray-400 italic text-[11px]">-</span>
                                                )}
                                             </td>

                                             {/* Waktu Scan */}
                                             <td className="p-4">
                                                {item.timestamp ? (
                                                   <div className="text-[11px] text-gray-500 font-mono">
                                                      {new Date(item.timestamp).toLocaleString('id-ID')}
                                                   </div>
                                                ) : (
                                                   <span className="text-gray-400 italic text-[11px]">-</span>
                                                )}
                                             </td>

                                             {/* File Sumber */}
                                             <td className="p-4 text-[11px] text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                                {item.source === 'PACKING' || item.source === 'BOTH' 
                                                   ? (item.excelFilename || item.excelFileName || '-')
                                                   : (item.excelFileName || 'Excel Import')
                                                }
                                             </td>
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                              </table>
                           )}
                        </div>

                        {/* Excel Pagination Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                           <div className="text-xs text-gray-500 font-semibold">
                              Menampilkan {filteredExcelRecords.length > 0 ? (excelCurrentPage - 1) * excelRowsPerPage + 1 : 0} - {Math.min(excelCurrentPage * excelRowsPerPage, filteredExcelRecords.length)} dari {filteredExcelRecords.length} data
                           </div>

                           <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-400 font-bold">Baris per halaman:</span>
                                 <select
                                    value={excelRowsPerPage}
                                    onChange={(e) => { setExcelRowsPerPage(Number(e.target.value)); setExcelCurrentPage(1); }}
                                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold px-2 py-1 outline-none"
                                 >
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                    <option value={500}>500</option>
                                 </select>
                              </div>

                              <div className="flex items-center gap-1">
                                 <button
                                    onClick={() => setExcelCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={excelCurrentPage === 1}
                                    className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                                 >
                                    Sebelumnya
                                 </button>
                                 <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                                    {excelCurrentPage} / {excelTotalPages}
                                 </span>
                                 <button
                                    onClick={() => setExcelCurrentPage(p => Math.min(excelTotalPages, p + 1))}
                                    disabled={excelCurrentPage >= excelTotalPages}
                                    className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
                                 >
                                    Selanjutnya
                                 </button>
                              </div>
                           </div>
                        </div>

                     </div>
                  </>
               )}
            </>
         )}

      </div>
   );
};
