import fs from 'fs';

let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const target = `                                    <>
                                       <div className="flex-1 overflow-auto">
                                          <table className="w-full text-left whitespace-nowrap">`;

const replacement = `                                 {activeView === 'GUDANG_REPORT' && gudangReportTab === 'IMPORT' ? (
                                    <div className="flex flex-col gap-6 p-6">
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          {/* Kolom 1: Paste Text */}
                                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[300px]">
                                             <div className="flex items-center gap-2 mb-3">
                                                <ClipboardPaste size={18} className="text-blue-600 dark:text-blue-400" />
                                                <h3 className="font-bold text-gray-800 dark:text-gray-200">Paste Data TSV dari Gudang Report Saat Ini</h3>
                                             </div>
                                             <textarea 
                                                className="flex-1 w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm font-mono text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                placeholder="Paste (Ctrl+V) data yang disalin dari tombol 'Salin Semua Data' di sini..."
                                                value={pastedGudangData}
                                                onChange={(e) => setPastedGudangData(e.target.value)}
                                             ></textarea>
                                          </div>

                                          {/* Kolom 2: Upload Excel */}
                                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center h-[300px] text-center relative overflow-hidden group">
                                             <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 opacity-50 z-0"></div>
                                             <div className="z-10 flex flex-col items-center w-full">
                                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-200 dark:border-blue-800 shadow-sm group-hover:scale-110 transition-transform">
                                                   <Upload size={24} />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Pilih Multi File Excel</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-[200px]">Pilih beberapa file Excel untuk dijadikan referensi konversi Barcode Data -> ID Pesanan</p>
                                                
                                                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center gap-2">
                                                   <Upload size={18} />
                                                   Pilih File(s)
                                                   <input type="file" className="hidden" accept=".xlsx,.xls" multiple onChange={handleProcessImportData} />
                                                </label>
                                             </div>
                                          </div>
                                       </div>

                                       {/* Tabel Hasil Konversi */}
                                       {isProcessingImport ? (
                                          <div className="flex flex-col items-center justify-center p-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 h-64">
                                             <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
                                             <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Memproses file excel dan melakukan pencocokan data...</p>
                                          </div>
                                       ) : processedImportData.length > 0 && (
                                          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                                             <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                   <h3 className="font-bold text-gray-800 dark:text-gray-200">Hasil Konversi ({processedImportData.length} baris)</h3>
                                                   <p className="text-xs text-gray-500 mt-1">Data siap disalin atau diekspor</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                   <button onClick={() => {setPastedGudangData(''); setProcessedImportData([]);}} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors">
                                                      Reset
                                                   </button>
                                                   <button onClick={handleCopyProcessedImportData} className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                      <Copy size={14} /> Salin Semua Hasil
                                                   </button>
                                                   <button onClick={handleExportProcessedImportData} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                                      <FileDown size={14} /> Export Excel
                                                   </button>
                                                </div>
                                             </div>
                                             <div className="overflow-auto max-h-[400px]">
                                                <table className="w-full text-left whitespace-nowrap">
                                                   <thead className="bg-white dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                                                      <tr>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase">Barcode Data (Asli)</th>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400">ID Pesanan (Konversi)</th>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase">Keterangan</th>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase">MSKU</th>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Qty</th>
                                                         <th className="p-4 text-xs font-bold text-gray-500 uppercase text-center">Status</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                      {processedImportData.map((item, idx) => (
                                                         <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                            <td className="p-4 text-sm font-mono text-gray-400">{item.originalBarcode}</td>
                                                            <td className="p-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/5">{item.convertedBarcode}</td>
                                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={item.keterangan}>{item.keterangan}</td>
                                                            <td className="p-4 text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.msku}</td>
                                                            <td className="p-4 text-sm font-bold text-center">{item.qty}</td>
                                                            <td className="p-4 text-center">
                                                               <span className={\`text-[10px] font-bold px-2 py-1 rounded-full border \${item.status === 'MATCHED' ? 'bg-green-100 text-green-700 border-green-200' : item.status === 'CONVERTED' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-red-100 text-red-700 border-red-200'}\`}>
                                                                  {item.status}
                                                               </span>
                                                            </td>
                                                         </tr>
                                                      ))}
                                                   </tbody>
                                                </table>
                                             </div>
                                          </div>
                                       )}
                                    </div>
                                 ) : (
                                    <>
                                       <div className="flex-1 overflow-auto">
                                          <table className="w-full text-left whitespace-nowrap">`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Successfully injected Import UI");
} else {
    console.log("Target string not found in AdminDashboard.tsx");
}
