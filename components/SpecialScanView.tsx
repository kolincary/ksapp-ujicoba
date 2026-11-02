import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { ScanLine, Loader2, Search, Trash2, ShieldCheck, X } from 'lucide-react';

interface SpecialScanViewProps {
  adminName: string;
  isDarkMode: boolean;
}

interface ScanData {
  id: number;
  barcode: string;
  scanned_at: string;
  admin_name: string;
}

export const SpecialScanView: React.FC<SpecialScanViewProps> = ({ adminName, isDarkMode }) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scans, setScans] = useState<ScanData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_special_scans')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setScans(data || []);
    } catch (err: any) {
      console.error('Error fetching special scans:', err);
      setStatusMessage({ type: 'error', text: 'Gagal mengambil data scan.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim().toUpperCase();
    if (!barcode) return;

    setIsScanning(true);
    setStatusMessage(null);

    try {
      // Basic prevention of instant duplicates on UI side (optional, DB has no unique constraint so it just inserts)
      const { data, error } = await supabase
        .from('admin_special_scans')
        .insert([{
          barcode,
          admin_name: adminName
        }])
        .select()
        .single();

      if (error) throw error;

      setStatusMessage({ type: 'success', text: `Scan sukses: ${barcode}` });
      setBarcodeInput('');
      setScans(prev => [data, ...prev].slice(0, 100)); // Keep top 100

      // Keep focus on input for next scan
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err: any) {
      console.error('Error saving special scan:', err);
      setStatusMessage({ type: 'error', text: `Gagal menyimpan scan: ${err.message}` });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus data scan ini?')) return;

    try {
      const { error } = await supabase
        .from('admin_special_scans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setScans(prev => prev.filter(s => s.id !== id));
      setStatusMessage({ type: 'info', text: 'Data berhasil dihapus.' });
    } catch (err: any) {
      console.error('Error deleting special scan:', err);
      setStatusMessage({ type: 'error', text: 'Gagal menghapus data.' });
    }
  };

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 flex flex-col p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6">

        {/* HEADER SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Special Scan</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Scan data khusus untuk admin yang tersimpan di tabel khusus.</p>
            </div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Active Admin: {adminName}</span>
          </div>
        </div>

        {/* SCAN INPUT SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <form onSubmit={handleScanSubmit} className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <ScanLine size={24} className="absolute left-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode di sini..."
                className="w-full pl-12 pr-32 py-4 text-lg font-bold bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-900 dark:text-white uppercase placeholder-gray-400"
                autoFocus
                disabled={isScanning}
              />
              <button
                type="submit"
                disabled={!barcodeInput.trim() || isScanning}
                className="absolute right-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {isScanning ? <Loader2 size={18} className="animate-spin" /> : 'Simpan'}
              </button>
            </div>

            {statusMessage && (
              <div className={`mt-3 text-sm font-bold flex items-center justify-center gap-2 ${statusMessage.type === 'success' ? 'text-green-600 dark:text-green-400' :
                statusMessage.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
                } animate-[fadeIn_0.2s_ease-out]`}>
                {statusMessage.text}
                <button type="button" onClick={() => setStatusMessage(null)} className="ml-2 hover:opacity-70"><X size={14} /></button>
              </div>
            )}
          </form>
        </div>

        {/* SCAN HISTORY SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Search size={18} className="text-indigo-500" /> Riwayat Scan Terakhir (Max 100)
            </h3>
            <span className="text-xs font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
              {scans.length} Records
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-0 relative">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <Loader2 size={32} className="animate-spin mb-2" />
                <span>Memuat data...</span>
              </div>
            ) : scans.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <ScanLine size={48} className="opacity-20 mb-3" />
                <p>Belum ada data scan.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-white dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Waktu Scan</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Barcode</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Admin</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(scan.scanned_at).toLocaleString('id-ID')}
                      </td>
                      <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">
                        {scan.barcode}
                      </td>
                      <td className="p-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                        {scan.admin_name}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(scan.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Hapus Data"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
