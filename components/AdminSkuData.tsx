import React, { useState, useEffect } from 'react';
import { Upload, Download, Search, Plus, Trash2, X, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, writeBatch, doc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseClient';

interface SkuItem {
  id: string; // SKU string itself is often good as ID, or we can use auto ID
  sku: string;
  created_at: number;
}

export const AdminSkuData: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const [skuList, setSkuList] = useState<SkuItem[]>([]);
  const [filteredList, setFilteredList] = useState<SkuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [manualSku, setManualSku] = useState('');
  
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredList(skuList.filter(item => item.sku.toLowerCase().includes(q)));
    setCurrentPage(1);
  }, [searchQuery, skuList]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'sku_data'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SkuItem[];
      setSkuList(data);
    } catch (err) {
      console.error(err);
      showError("Gagal mengambil data SKU.");
    } finally {
      setIsLoading(false);
    }
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 3000);
  };
  
  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get raw data as array of arrays
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        
        // Extract column A, skip empty
        const skusToImport = data
          .map(row => row[0]?.toString().trim())
          .filter(val => val && val !== ''); // skip empty

        if (skusToImport.length === 0) {
          showError("Tidak ada data ditemukan di kolom A.");
          return;
        }

        await processImport(skusToImport);
        
      } catch (err) {
        console.error(err);
        showError("Gagal memproses file Excel.");
      }
      
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async (skus: string[]) => {
    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;
    
    // Firestore batch limit is 500
    const chunkSize = 400; 
    try {
      for (let i = 0; i < skus.length; i += chunkSize) {
        const chunk = skus.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(sku => {
          // Use auto-generated IDs or sku string as ID? Using SKU as ID prevents duplicates naturally.
          const docRef = doc(collection(db, 'sku_data'), encodeURIComponent(sku.toUpperCase()));
          batch.set(docRef, {
            sku: sku.toUpperCase(),
            created_at: Date.now()
          }, { merge: true }); // merge true so it doesn't overwrite if it already exists
        });
        
        await batch.commit();
        successCount += chunk.length;
        setImportProgress(Math.round((successCount / skus.length) * 100));
      }
      
      showSuccess(`Berhasil import ${successCount} SKU`);
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menyimpan ke Firestore.");
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportProgress(0), 1000);
    }
  };

  const handleExport = () => {
    if (skuList.length === 0) return;
    const exportData = skuList.map(item => ({ 'Nama Barang (MSKU)': item.sku }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU");
    XLSX.writeFile(wb, `Data_SKU_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSku.trim()) return;
    const val = manualSku.trim().toUpperCase();
    
    try {
      await setDoc(doc(db, 'sku_data', encodeURIComponent(val)), {
        sku: val,
        created_at: Date.now()
      }, { merge: true });
      showSuccess(`Berhasil menambah SKU: ${val}`);
      setManualSku('');
      fetchData();
    } catch (err) {
      console.error(err);
      showError("Gagal menambah SKU manual.");
    }
  };

  const handleDelete = async (skuId: string) => {
    if (!confirm("Hapus SKU ini?")) return;
    try {
      await deleteDoc(doc(db, 'sku_data', skuId));
      setSkuList(prev => prev.filter(item => item.id !== skuId));
      showSuccess("Berhasil menghapus SKU");
    } catch (err) {
      console.error(err);
      showError("Gagal menghapus SKU.");
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const currentData = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Toasts */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">{errorToast}</p>
        </div>
      )}
      {successToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="font-medium">{successToast}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Data SKU (MSKU)
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Kelola daftar nama barang/MSKU untuk dropdown di Gudang Report
          </p>
        </div>
        <div className="flex gap-2">
           <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
           >
              <Download size={18} />
              Export Excel
           </button>
           <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm cursor-pointer text-sm">
              <Upload size={18} />
              Import Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
           </label>
        </div>
      </div>

      {/* Progress Bar */}
      {isImporting && (
         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
               <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Importing Data...</span>
               <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{importProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
               <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
            </div>
         </div>
      )}

      {/* Manual Input & Search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <form onSubmit={handleAddManual} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-end gap-2">
            <div className="flex-1">
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Input Manual SKU</label>
               <input 
                  type="text" 
                  value={manualSku}
                  onChange={e => setManualSku(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: MSKU-1234"
               />
            </div>
            <button type="submit" className="p-2.5 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white rounded-lg flex items-center justify-center">
               <Plus size={20} />
            </button>
         </form>
         
         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-end gap-2">
            <div className="flex-1 relative">
               <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Cari SKU</label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                     type="text" 
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
                     placeholder="Cari MSKU..."
                  />
                  {searchQuery && (
                     <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={16} />
                     </button>
                  )}
               </div>
            </div>
         </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
         {/* Toolbar */}
         <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
               <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Tampilkan</span>
               <select
                  value={itemsPerPage}
                  onChange={(e) => {
                     setItemsPerPage(Number(e.target.value));
                     setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
               >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
               </select>
               <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">baris</span>
            </div>
            
            <div className="flex items-center gap-4">
               <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total: {filteredList.length} SKU
               </span>
               <button onClick={fetchData} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
               </button>
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                     <th className="px-6 py-4 font-bold w-16">No</th>
                     <th className="px-6 py-4 font-bold">Nama Barang (MSKU)</th>
                     <th className="px-6 py-4 font-bold w-24 text-right">Aksi</th>
                  </tr>
               </thead>
               <tbody>
                  {isLoading ? (
                     <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                           <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                           Memuat data...
                        </td>
                     </tr>
                  ) : currentData.length === 0 ? (
                     <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                           Tidak ada data SKU ditemukan.
                        </td>
                     </tr>
                  ) : (
                     currentData.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                           <td className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                           </td>
                           <td className="px-6 py-3 font-bold text-gray-800 dark:text-gray-200">
                              {item.sku}
                           </td>
                           <td className="px-6 py-3 text-right">
                              <button 
                                 onClick={() => handleDelete(item.id)}
                                 className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                 title="Hapus"
                              >
                                 <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>

         {/* Pagination Footer */}
         {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
               <span className="text-sm text-gray-600 dark:text-gray-400">
                  Halaman <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> dari <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
               </span>
               <div className="flex gap-1">
                  <button
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
                  >
                     Sebelumnya
                  </button>
                  <button
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
                  >
                     Selanjutnya
                  </button>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};
