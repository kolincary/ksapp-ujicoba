import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';
import { Database, UploadCloud, CheckCircle2, AlertCircle, RefreshCw, FileText, Loader2, Play, Check, X, ShieldAlert, Calendar, Clock, Sparkles } from 'lucide-react';

interface InjectExpiredResiViewProps {
   isDarkMode?: boolean;
}

interface ProcessResult {
   barcode: string;
   role: string;
   status: 'INJECTED' | 'SKIPPED' | 'FAILED';
   message: string;
}

export const InjectExpiredResiView: React.FC<InjectExpiredResiViewProps> = () => {
   const [rawBarcodes, setRawBarcodes] = useState('');
   const [employeeName, setEmployeeName] = useState('RESI KEDALUWARSA');
   const [customInjectDate, setCustomInjectDate] = useState(() => new Date().toISOString().split('T')[0]);
   const [customInjectTime, setCustomInjectTime] = useState(() => {
      const now = new Date();
      // If executed in early morning / midnight (00:00 - 07:00), default to realistic daytime shift 14:30
      if (now.getHours() >= 0 && now.getHours() < 7) {
         return '14:30';
      }
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
   });
   const [selectedRoles, setSelectedRoles] = useState<string[]>([
      UserRole.PICKER,
      UserRole.CHECKER,
      UserRole.PACKING
   ]);
   const [isProcessing, setIsProcessing] = useState(false);
   const [progress, setProgress] = useState({ current: 0, total: 0 });
   const [results, setResults] = useState<ProcessResult[]>([]);
   const [summaryStats, setSummaryStats] = useState({ injected: 0, skipped: 0, failed: 0 });

   const handleRoleToggle = (role: string) => {
      setSelectedRoles(prev => 
         prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
      );
   };

   const parseBarcodes = (input: string): string[] => {
      if (!input.trim()) return [];
      const lines = input.split(/[\n,;\s]+/);
      const cleaned = lines
         .map(b => b.trim())
         .filter(b => b.length > 0);
      
      // Remove duplicates from input array while preserving order
      return Array.from(new Set(cleaned));
   };

   const handleProcessInject = async (e: React.FormEvent) => {
      e.preventDefault();
      const barcodes = parseBarcodes(rawBarcodes);
      if (barcodes.length === 0) {
         alert("Silakan masukkan minimal 1 barcode / resi.");
         return;
      }

      if (selectedRoles.length === 0) {
         alert("Silakan pilih minimal 1 role target (PICKER, CHECKER, atau PACKING).");
         return;
      }

      if (!window.confirm(`Konfirmasi Inject Resi Massal:\n- Total Resi Unik: ${barcodes.length}\n- Target Role: ${selectedRoles.join(', ')}\n- Nama Staff: "${employeeName}"\n- Tanggal & Waktu: ${customInjectDate} pukul ${customInjectTime}\n\nApakah Anda yakin ingin memproses?`)) {
         return;
      }

      setIsProcessing(true);
      setResults([]);
      setSummaryStats({ injected: 0, skipped: 0, failed: 0 });
      
      const totalOperations = barcodes.length * selectedRoles.length;
      setProgress({ current: 0, total: totalOperations });

      const newResults: ProcessResult[] = [];
      let injectedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let completedOps = 0;

      try {
         // Dynamically import Firestore db if available
         let firestoreDb: any = null;
         let fsDoc: any = null;
         let fsSetDoc: any = null;
         try {
            const { db } = await import('../services/supabaseClient').then(() => import('../services/firebaseClient'));
            const { doc, setDoc } = await import('firebase/firestore');
            firestoreDb = db;
            fsDoc = doc;
            fsSetDoc = setDoc;
         } catch (fsErr) {
            console.warn("Firestore not available for dual sync:", fsErr);
         }

         for (let bIndex = 0; bIndex < barcodes.length; bIndex++) {
            const barcode = barcodes[bIndex];
            for (const role of selectedRoles) {
               completedOps++;
               setProgress({ current: completedOps, total: totalOperations });

               try {
                  // 1. Check if scan record for (barcode, role) already exists in Supabase
                  const { data: existing, error: checkErr } = await supabase
                     .from('scanned_items')
                     .select('id, employee_name')
                     .eq('barcode', barcode)
                     .eq('role', role)
                     .limit(1)
                     .maybeSingle();

                  if (checkErr) throw checkErr;

                  if (existing) {
                     // Record already exists for this role -> SKIP
                     skippedCount++;
                     newResults.push({
                        barcode,
                        role,
                        status: 'SKIPPED',
                        message: `Sudah ada data (Oleh: ${existing.employee_name || 'User'})`
                     });
                  } else {
                     // Record does NOT exist -> INSERT NEW with custom date and time
                     let targetTimestamp = Date.now();
                     if (customInjectDate) {
                        const [y, m, d] = customInjectDate.split('-').map(Number);
                        let hour = 14;
                        let minute = 30;
                        let second = Math.floor(Math.random() * 50);

                        if (customInjectTime) {
                           const parts = customInjectTime.split(':').map(Number);
                           if (!isNaN(parts[0])) hour = parts[0];
                           if (!isNaN(parts[1])) minute = parts[1];
                           if (parts.length > 2 && !isNaN(parts[2])) second = parts[2];
                        }

                        // Add realistic incremental second variance per barcode (e.g. 2-4 seconds apart)
                        const secondJitter = (bIndex * 3) + Math.floor(Math.random() * 2);
                        const dateObj = new Date(y, m - 1, d, hour, minute, second, Math.floor(Math.random() * 999));
                        targetTimestamp = dateObj.getTime() + (secondJitter * 1000);
                     }

                     const uniqueId = `${targetTimestamp}-${Math.random().toString(36).substring(2, 9)}`;
                     const newItem = {
                        id: uniqueId,
                        barcode,
                        role,
                        user_email: 'expired@kalindo.com',
                        employee_name: employeeName.trim() || 'RESI KEDALUWARSA',
                        timestamp: targetTimestamp,
                        created_at: new Date(targetTimestamp).toISOString(),
                        status: 'COMPLETED',
                        menu_context: 'DEFAULT'
                     };

                     // Insert to Supabase
                     const { error: insertErr } = await supabase
                        .from('scanned_items')
                        .insert([newItem]);

                     if (insertErr) throw insertErr;

                     // Dual sync to Firestore if enabled
                     if (firestoreDb && fsDoc && fsSetDoc) {
                        try {
                           await fsSetDoc(fsDoc(firestoreDb, 'scanned_items', uniqueId), newItem);
                        } catch (fErr) {
                           console.warn("Firestore inject notice:", fErr);
                        }
                     }

                     injectedCount++;
                     newResults.push({
                        barcode,
                        role,
                        status: 'INJECTED',
                        message: `Berhasil diinject (${employeeName})`
                     });
                  }
               } catch (opErr: any) {
                  console.error(`Error processing barcode ${barcode} role ${role}:`, opErr);
                  failedCount++;
                  newResults.push({
                     barcode,
                     role,
                     status: 'FAILED',
                     message: opErr.message || 'Gagal menyimpan ke database'
                  });
               }
            }
         }

         setResults(newResults);
         setSummaryStats({ injected: injectedCount, skipped: skippedCount, failed: failedCount });
      } catch (err: any) {
         console.error("Fatal error during batch inject:", err);
         alert("Terjadi kesalahan fatal saat memproses: " + (err.message || 'Unknown error'));
      } finally {
         setIsProcessing(false);
      }
   };

   const parsedBarcodesCount = parseBarcodes(rawBarcodes).length;

   return (
      <div className="w-full h-full min-h-full bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 overflow-y-auto">
         <div className="w-full space-y-6">
            
            {/* Top Header Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60 shadow-sm">
                     <Database className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                           Auto Inject Resi Kedaluwarsa
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200">
                           DEVMODE NEW
                        </span>
                     </div>
                     <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-0.5">
                        Isi otomatis data scan resi kedaluwarsa ke Supabase & Firestore untuk role PICKER, CHECKER, dan PACKING.
                     </p>
                  </div>
               </div>
            </div>

            {/* Main Form Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               
               {/* Left Form (7 cols) */}
               <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-5">
                  <form onSubmit={handleProcessInject} className="space-y-5">
                     
                     {/* Textarea Input */}
                     <div>
                        <div className="flex items-center justify-between mb-2">
                           <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Paste List Resi / Barcode
                           </label>
                           <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              {parsedBarcodesCount} Resi Unik
                           </span>
                        </div>
                        <textarea
                           value={rawBarcodes}
                           onChange={(e) => setRawBarcodes(e.target.value)}
                           rows={8}
                           placeholder={"Contoh:\nSPXID064916118738\nSPXID063059694698\nSPXID069271472598\nJY1345770615\nJY1319650665"}
                           className="w-full p-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-xs sm:text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed resize-y"
                           disabled={isProcessing}
                           required
                        />
                        <p className="text-[11px] text-gray-400 mt-1 italic">
                           Bisa paste langsung dari Excel/Catatan (1 resi per baris, koma, atau spasi).
                        </p>
                     </div>

                     {/* Role Selection Checkboxes */}
                     <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                           Target Role Scan (Diisi Otomatis)
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                           {[
                              { role: UserRole.PICKER, label: 'PICKER' },
                              { role: UserRole.CHECKER, label: 'CHECKER' },
                              { role: UserRole.PACKING, label: 'PACKING' }
                           ].map(item => {
                              const isChecked = selectedRoles.includes(item.role);
                              return (
                                 <button
                                    key={item.role}
                                    type="button"
                                    onClick={() => handleRoleToggle(item.role)}
                                    disabled={isProcessing}
                                    className={`p-3 rounded-xl border flex items-center justify-between font-bold text-xs transition-all cursor-pointer ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300' : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700'}`}
                                 >
                                    <span>{item.label}</span>
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${isChecked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                       {isChecked && <Check size={14} />}
                                    </div>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Staff Name */}
                     <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                           Nama Staff (`employee_name`)
                        </label>
                        <input
                           type="text"
                           value={employeeName}
                           onChange={(e) => setEmployeeName(e.target.value)}
                           className="w-full h-11 px-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                           disabled={isProcessing}
                           required
                        />
                        <p className="text-[11px] text-gray-400 mt-1 italic">
                           Nama staff yang tercatat di database.
                        </p>
                     </div>

                     {/* Tanggal & Jam Input Grid */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Tanggal Scan */}
                        <div>
                           <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                              Tanggal Scan Inject
                           </label>
                           <div className="relative flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 h-11 overflow-hidden select-none">
                              <Calendar size={18} className="text-gray-400 shrink-0 pointer-events-none" />
                              <input
                                 type="date"
                                 value={customInjectDate}
                                 onChange={(e) => setCustomInjectDate(e.target.value)}
                                 disabled={isProcessing}
                                 className="bg-transparent text-gray-900 dark:text-white outline-none w-full h-full text-sm font-bold cursor-pointer select-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                              />
                           </div>
                           <p className="text-[11px] text-gray-400 mt-1 italic">
                              Target tanggal timestamp data.
                           </p>
                        </div>

                        {/* Waktu / Jam Scan */}
                        <div>
                           <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                 Jam / Waktu Scan
                              </label>
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">
                                 Realistic Time
                              </span>
                           </div>
                           <div className="relative flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 h-11 overflow-hidden select-none">
                              <Clock size={18} className="text-gray-400 shrink-0 pointer-events-none" />
                              <input
                                 type="time"
                                 value={customInjectTime}
                                 onChange={(e) => setCustomInjectTime(e.target.value)}
                                 disabled={isProcessing}
                                 className="bg-transparent text-gray-900 dark:text-white outline-none w-full h-full text-sm font-bold cursor-pointer select-none"
                              />
                           </div>

                           {/* Quick Presets */}
                           <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {[
                                 { label: 'Pagi 09:30', val: '09:30' },
                                 { label: 'Siang 14:30', val: '14:30' },
                                 { label: 'Sore 17:45', val: '17:45' },
                                 { label: 'Malam 20:15', val: '20:15' },
                                 { 
                                    label: 'Sekarang', 
                                    val: () => {
                                       const now = new Date();
                                       return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                    }
                                 }
                              ].map((preset, idx) => (
                                 <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCustomInjectTime(typeof preset.val === 'function' ? preset.val() : preset.val)}
                                    disabled={isProcessing}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                                       (typeof preset.val === 'string' && customInjectTime === preset.val)
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                 >
                                    {preset.label}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center gap-3 pt-2">
                        <button
                           type="button"
                           onClick={() => {
                              if (window.confirm("Kosongkan form input?")) {
                                 setRawBarcodes('');
                                 setResults([]);
                              }
                           }}
                           disabled={isProcessing || !rawBarcodes}
                           className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                        >
                           Kosongkan
                        </button>

                        <button
                           type="submit"
                           disabled={isProcessing || parsedBarcodesCount === 0 || selectedRoles.length === 0}
                           className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                        >
                           {isProcessing ? (
                              <>
                                 <Loader2 size={18} className="animate-spin" />
                                 <span>Memproses ({progress.current}/{progress.total})...</span>
                              </>
                           ) : (
                              <>
                                 <UploadCloud size={18} />
                                 <span>Proses Inject Data Massal</span>
                              </>
                           )}
                        </button>
                     </div>
                  </form>
               </div>

               {/* Right Instructions & Live Summary (5 cols) */}
               <div className="lg:col-span-5 space-y-5">
                  {/* How it works card */}
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl p-5 border border-blue-200 dark:border-blue-800/60 space-y-3">
                     <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                        <ShieldAlert size={18} className="text-blue-600 dark:text-blue-400" />
                        Aturan Kerja Fitur Auto-Inject
                     </h3>
                     <ul className="text-xs text-blue-800 dark:text-blue-300/90 space-y-2 list-disc pl-4 leading-relaxed">
                        <li>
                           <strong>Auto Skip Duplikat:</strong> Jika resi sudah memiliki scan data pada role target (misal `PICKER`), sistem <u>tidak akan membuat duplikat</u>.
                        </li>
                        <li>
                           <strong>Melengkapi Role Kosong:</strong> Hanya role yang belum memiliki data scan yang akan dibuatkan record baru.
                        </li>
                        <li>
                           <strong>Label Penanda:</strong> Kolom `employee_name` akan ditandai secara resmi dengan <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded text-blue-900 dark:text-blue-200">RESI KEDALUWARSA</span>.
                        </li>
                        <li>
                           <strong>Dual Sync Supabase + Firestore:</strong> Data tersimpan serentak ke Supabase dan Firestore.
                        </li>
                     </ul>
                  </div>

                  {/* Processing Summary Stat */}
                  {(summaryStats.injected > 0 || summaryStats.skipped > 0 || summaryStats.failed > 0 || isProcessing) && (
                     <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4 animate-[fadeIn_0.2s]">
                        <h4 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">
                           Ringkasan Pemrosesan
                        </h4>

                        {isProcessing && (
                           <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                                 <span>Progres Injecting...</span>
                                 <span>{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                 <div 
                                    className="h-full bg-blue-600 transition-all duration-200"
                                    style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                 />
                              </div>
                           </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 text-center">
                           <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{summaryStats.injected}</div>
                              <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Berhasil Inject</div>
                           </div>
                           <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60">
                              <div className="text-lg font-black text-amber-600 dark:text-amber-400">{summaryStats.skipped}</div>
                              <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Skipped (Ada)</div>
                           </div>
                           <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800/60">
                              <div className="text-lg font-black text-red-600 dark:text-red-400">{summaryStats.failed}</div>
                              <div className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300">Gagal Error</div>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Results Table Section */}
            {results.length > 0 && (
               <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-[fadeIn_0.2s]">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                     <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        Detail Hasil Pemrosesan Resi ({results.length} Item)
                     </h3>
                  </div>

                  <div className="overflow-x-auto max-h-96 custom-scrollbar">
                     <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 font-bold uppercase text-[10px] sticky top-0">
                           <tr>
                              <th className="p-3">No</th>
                              <th className="p-3">Barcode / Resi</th>
                              <th className="p-3">Target Role</th>
                              <th className="p-3">Status Pemrosesan</th>
                              <th className="p-3">Keterangan</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                           {results.map((res, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                 <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                 <td className="p-3 font-mono font-bold text-gray-900 dark:text-white">{res.barcode}</td>
                                 <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{res.role}</td>
                                 <td className="p-3">
                                    {res.status === 'INJECTED' && (
                                       <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300">
                                          ✓ INJECTED
                                       </span>
                                    )}
                                    {res.status === 'SKIPPED' && (
                                       <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300">
                                          ℹ️ SKIPPED (SUDAH ADA)
                                       </span>
                                    )}
                                    {res.status === 'FAILED' && (
                                       <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 border border-red-300">
                                          ❌ FAILED
                                       </span>
                                    )}
                                 </td>
                                 <td className="p-3 text-gray-500 dark:text-gray-400">{res.message}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}

         </div>
      </div>
   );
};
