import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Check, X, RefreshCw, Power } from 'lucide-react';
import { UserRole } from '../types';

export interface RunningText {
   id: string;
   text: string;
   roles: string[];
   is_active: boolean;
   interval_minutes: number;
   duration_seconds: number;
   scroll_speed: number;
   created_at: string;
}

export const RunningTextManagerView = () => {
   const [runningTexts, setRunningTexts] = useState<RunningText[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState('');
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

   const [formData, setFormData] = useState<{
      text: string;
      roles: string[];
      is_active: boolean;
      interval_minutes: number;
      duration_seconds: number;
      scroll_speed: number;
   }>({
      text: '',
      roles: ['ALL'],
      is_active: true,
      interval_minutes: 5,
      duration_seconds: 60,
      scroll_speed: 30
   });

   const availableRoles = ['ALL', ...Object.values(UserRole)];

   useEffect(() => {
      setPortalNode(document.getElementById('root') || document.body);
      fetchRunningTexts();
   }, []);

   const fetchRunningTexts = async () => {
      setIsLoading(true);
      setError('');
      try {
         const { data, error: fetchError } = await supabase
            .from('running_texts')
            .select('*')
            .order('created_at', { ascending: false });

         if (fetchError) {
            // Handle if table doesn't exist
            if (fetchError.code === '42P01') {
               setError('Tabel running_texts belum dibuat di Supabase. Harap eksekusi query SQL terlebih dahulu.');
            } else {
               throw fetchError;
            }
         } else {
            setRunningTexts(data || []);
         }
      } catch (err: any) {
         setError(err.message || 'Gagal memuat data running text');
      } finally {
         setIsLoading(false);
      }
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      try {
         if (editingId) {
            const { error: updateError } = await supabase
               .from('running_texts')
               .update({
                  text: formData.text,
                  roles: formData.roles,
                  is_active: formData.is_active,
                  interval_minutes: formData.interval_minutes,
                  duration_seconds: formData.duration_seconds,
                  scroll_speed: formData.scroll_speed
               })
               .eq('id', editingId);

            if (updateError) throw updateError;
         } else {
            const { error: insertError } = await supabase
               .from('running_texts')
               .insert([{
                  text: formData.text,
                  roles: formData.roles,
                  is_active: formData.is_active,
                  interval_minutes: formData.interval_minutes,
                  duration_seconds: formData.duration_seconds,
                  scroll_speed: formData.scroll_speed
               }]);

            if (insertError) throw insertError;
         }

         setIsModalOpen(false);
         fetchRunningTexts();
      } catch (err: any) {
         setError(err.message || 'Gagal menyimpan data');
         setIsLoading(false);
      }
   };

   const handleDelete = async (id: string) => {
      if (!window.confirm('Yakin ingin menghapus running text ini?')) return;
      setIsLoading(true);
      try {
         const { error } = await supabase
            .from('running_texts')
            .delete()
            .eq('id', id);

         if (error) throw error;
         fetchRunningTexts();
      } catch (err: any) {
         setError(err.message || 'Gagal menghapus data');
         setIsLoading(false);
      }
   };

   const handleToggleActive = async (id: string, currentStatus: boolean) => {
      setIsLoading(true);
      try {
         const { error } = await supabase
            .from('running_texts')
            .update({ is_active: !currentStatus })
            .eq('id', id);

         if (error) throw error;
         fetchRunningTexts();
      } catch (err: any) {
         setError(err.message || 'Gagal mengubah status');
         setIsLoading(false);
      }
   };

   const openModal = (item?: RunningText) => {
      if (item) {
         setEditingId(item.id);
         setFormData({
            text: item.text,
            roles: item.roles || ['ALL'],
            is_active: item.is_active,
            interval_minutes: item.interval_minutes,
            duration_seconds: item.duration_seconds,
            scroll_speed: item.scroll_speed || 30
         });
      } else {
         setEditingId(null);
         setFormData({
            text: '',
            roles: ['ALL'],
            is_active: true,
            interval_minutes: 5,
            duration_seconds: 60,
            scroll_speed: 30
         });
      }
      setIsModalOpen(true);
   };

   const handleRoleToggle = (role: string) => {
      setFormData(prev => {
         let newRoles = [...prev.roles];
         if (role === 'ALL') {
            newRoles = ['ALL'];
         } else {
            newRoles = newRoles.filter(r => r !== 'ALL');
            if (newRoles.includes(role)) {
               newRoles = newRoles.filter(r => r !== role);
            } else {
               newRoles.push(role);
            }
            if (newRoles.length === 0) newRoles = ['ALL'];
         }
         return { ...prev, roles: newRoles };
      });
   };

   return (
      <div className="p-6 space-y-6 pb-24">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
               <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Pengumuman (Running Text)</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">Atur teks berjalan untuk ditampilkan ke scanner per role.</p>
            </div>
            <div className="flex gap-2">
               <button
                  onClick={fetchRunningTexts}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-600 dark:text-gray-300"
                  disabled={isLoading}
               >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
               </button>
               <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm"
               >
                  <Plus size={18} />
                  <span>Tambah Baru</span>
               </button>
            </div>
         </div>

         {error && (
            <div className="p-4 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800/50 flex items-center gap-3">
               <X size={20} />
               <span className="font-medium">{error}</span>
            </div>
         )}

         <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                     <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teks Pengumuman</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Roles</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Interval / Durasi</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kecepatan</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                     {runningTexts.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm font-medium">
                              {isLoading ? 'Memuat data...' : 'Tidak ada data running text.'}
                           </td>
                        </tr>
                     ) : (
                        runningTexts.map((item) => (
                           <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="max-w-md truncate font-medium text-gray-800 dark:text-gray-200" title={item.text}>
                                    {item.text}
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                    {item.roles.map((role, idx) => (
                                       <span key={idx} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                          {role}
                                       </span>
                                    ))}
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Tiap <span className="font-bold">{item.interval_minutes}</span> mnt <br />
                                    Tampil <span className="font-bold">{item.duration_seconds}</span> dtk
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                    {item.scroll_speed || 30}s
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <button
                                    onClick={() => handleToggleActive(item.id, item.is_active)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${item.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
                                 >
                                    <Power size={12} />
                                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                                 </button>
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button
                                       onClick={() => openModal(item)}
                                       className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    >
                                       <Edit2 size={16} />
                                    </button>
                                    <button
                                       onClick={() => handleDelete(item.id)}
                                       className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Modal Form */}
         {isModalOpen && portalNode && createPortal(
            <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
               <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                     <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {editingId ? 'Edit Pengumuman' : 'Tambah Pengumuman'}
                     </h3>
                     <button
                        onClick={() => setIsModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                     >
                        <X size={20} />
                     </button>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
                     <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Teks Pengumuman</label>
                        <textarea
                           required
                           rows={3}
                           value={formData.text}
                           onChange={e => setFormData({ ...formData, text: e.target.value })}
                           className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-gray-800 dark:text-gray-100"
                           placeholder="Masukkan teks pengumuman yang akan berjalan..."
                        />
                     </div>

                     <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Target Role</label>
                        <div className="flex flex-wrap gap-2">
                           {availableRoles.map(role => (
                              <button
                                 key={role}
                                 type="button"
                                 onClick={() => handleRoleToggle(role)}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                    formData.roles.includes(role) 
                                       ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                                       : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600'
                                 }`}
                              >
                                 {role}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-4">
                        <div>
                           <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Interval (Mnt)</label>
                           <input type="number" required min="1" value={formData.interval_minutes} onChange={e => setFormData({ ...formData, interval_minutes: e.target.value === '' ? '' as any : parseInt(e.target.value) })} className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                           <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Durasi (Dtk)</label>
                           <input type="number" required min="5" value={formData.duration_seconds} onChange={e => setFormData({ ...formData, duration_seconds: e.target.value === '' ? '' as any : parseInt(e.target.value) })} className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                           <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Kecepatan</label>
                           <input type="number" required min="5" value={formData.scroll_speed} onChange={e => setFormData({ ...formData, scroll_speed: e.target.value === '' ? '' as any : parseInt(e.target.value) })} className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" title="Semakin besar angkanya, semakin lambat bergeraknya. (Otomatis disesuaikan dengan panjang teks)" />
                        </div>
                     </div>

                     <div className="pt-4 flex gap-3">
                        <button
                           type="button"
                           onClick={() => setIsModalOpen(false)}
                           className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
                        >
                           Batal
                        </button>
                        <button
                           type="submit"
                           disabled={isLoading}
                           className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                        >
                           {isLoading ? (
                              <RefreshCw size={20} className="animate-spin" />
                           ) : (
                              <Check size={18} />
                           )}
                           <span>{editingId ? 'Simpan' : 'Tambahkan'}</span>
                        </button>
                     </div>
                  </form>
               </div>
            </div>,
            portalNode
         )}
      </div>
   );
};
