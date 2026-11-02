import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the table body to render TYPE (scan_type) instead of Role for LEADER_2
old_table_body_role = """<td className="p-5 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${item.role === 'PACKING' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : item.role === 'SORTIR' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : item.role === 'GUDANG' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : item.role === 'PICKER' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}>{item.role || 'UNKNOWN'}</span></td>"""
new_table_body_role = """{activeView === 'LEADER_2_DATA' ? (
                                                            <td className="p-5 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${item.scan_type === 'SATUAN' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : item.scan_type === 'PRETELAN' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-gray-100 text-gray-700'}`}>{item.scan_type || 'UNKNOWN'}</span></td>
                                                         ) : (
                                                            <td className="p-5 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${item.role === 'PACKING' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : item.role === 'SORTIR' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : item.role === 'GUDANG' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : item.role === 'PICKER' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}>{item.role || 'UNKNOWN'}</span></td>
                                                         )}"""

content = content.replace(old_table_body_role, new_table_body_role)

# 2. Update the table header to say 'Type' instead of 'Role' for LEADER_2
old_table_header_role = """<th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>"""
new_table_header_role = """{activeView === 'LEADER_2_DATA' ? (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Type</th>
                                                   ) : (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>
                                                   )}"""

# Replace ONLY the one in the main table layout
# It's right around line 5292
# I'll just find the exact block:
table_header_block = """<th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">Context</th>
                                                   )}
                                                   <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>
                                                   {!['PACKING_DATA', 'SORTIR_DATA', 'OJOL_DATA', 'PICKER_DATA', 'LEADER_2_DATA'].includes(activeView) && ("""
new_table_header_block = """<th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">Context</th>
                                                   )}
                                                   {activeView === 'LEADER_2_DATA' ? (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Type</th>
                                                   ) : (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center bg-gray-50 dark:bg-gray-900">Role</th>
                                                   )}
                                                   {!['PACKING_DATA', 'SORTIR_DATA', 'OJOL_DATA', 'PICKER_DATA', 'LEADER_2_DATA'].includes(activeView) && ("""
content = content.replace(table_header_block, new_table_header_block)


# 3. Add state variables for LEADER_2 bulk actions
state_vars_inject = """   const [bulkChangeRoleTarget, setBulkChangeRoleTarget] = useState<string>('PACKING');"""
new_state_vars = """   const [bulkChangeRoleTarget, setBulkChangeRoleTarget] = useState<string>('PACKING');
   const [leader2BulkStaff, setLeader2BulkStaff] = useState<string>('');
   const [leader2BulkDate, setLeader2BulkDate] = useState<string>('');
   const [isLeader2BulkModalOpen, setIsLeader2BulkModalOpen] = useState(false);"""
if "leader2BulkStaff" not in content:
    content = content.replace(state_vars_inject, new_state_vars)


# 4. Add the handler for Leader 2 Bulk Actions
leader2_handlers = """
   const handleLeader2BulkAction = async () => {
      if (selectedScanIds.length === 0) return;
      if (!leader2BulkStaff && !leader2BulkDate) {
         alert("Pilih staff atau tanggal yang mau diubah!");
         return;
      }
      
      const { data: dbSession } = await supabase.auth.getSession();
      if (!dbSession.session) {
         alert('Session expired. Harap login kembali.');
         return;
      }

      setIsDeletingRange(true);
      try {
         const updates: any = {};
         if (leader2BulkStaff) updates.leader_name = leader2BulkStaff;
         if (leader2BulkDate) updates.date = leader2BulkDate;

         for (const itemId of selectedScanIds) {
             const { error } = await supabase
                 .from('leader_scan_2')
                 .update(updates)
                 .eq('id', itemId);
             
             if (error) console.error("Error updating leader_scan_2 item " + itemId, error);
         }

         setSuccessToast(`Berhasil mengubah ${selectedScanIds.length} data.`);
         setSelectedScanIds([]);
         setLeader2BulkStaff('');
         setLeader2BulkDate('');
         fetchPackingData();
         fetchLeaderOrders();
      } catch (err: any) {
         alert("Gagal mengubah data: " + err.message);
      } finally {
         setIsDeletingRange(false);
      }
   };

   const handleDeleteLeader2Bulk = async () => {
      if (selectedScanIds.length === 0) return;
      if (!confirm(`Yakin ingin MENGHAPUS PERMANEN ${selectedScanIds.length} data terpilih?`)) return;

      setIsDeletingRange(true);
      try {
         for (const itemId of selectedScanIds) {
             const { error } = await supabase
                 .from('leader_scan_2')
                 .delete()
                 .eq('id', itemId);
             if (error) console.error("Error deleting leader_scan_2 item " + itemId, error);
         }
         setSuccessToast(`Berhasil menghapus ${selectedScanIds.length} data.`);
         setSelectedScanIds([]);
         fetchPackingData();
         fetchLeaderOrders();
      } catch (err: any) {
         alert("Gagal menghapus data: " + err.message);
      } finally {
         setIsDeletingRange(false);
      }
   };
"""

# inject handlers before 'const handleBulkRoleUpdate'
if "handleLeader2BulkAction" not in content:
    content = content.replace("const handleBulkRoleUpdate = async () => {", leader2_handlers + "\n   const handleBulkRoleUpdate = async () => {")

# 5. Render the Bulk Action Bar for LEADER_2_DATA
leader2_action_bar = """
         {/* BULK ACTION BAR FOR LEADER_2_DATA */}
         {activeView === 'LEADER_2_DATA' && selectedScanIds.length > 0 && (
            <div className="fixed bottom-0 sm:bottom-6 left-0 sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-auto bg-gray-900 dark:bg-black text-white p-4 sm:rounded-2xl shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.3)] border-t sm:border border-gray-800 z-[60] animate-[slideUp_0.3s_ease-out] flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pb-8 sm:pb-4">
               <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center font-bold text-white shadow-lg shadow-pink-500/40">
                        {selectedScanIds.length}
                     </div>
                     <div className="flex flex-col">
                        <span className="font-bold text-base leading-none">Selected</span>
                     </div>
                  </div>
                  <button onClick={() => setSelectedScanIds([])} className="sm:hidden p-2 bg-gray-800 rounded-full text-gray-400">
                     <X size={18} />
                  </button>
               </div>
               <div className="h-8 w-px bg-gray-700 hidden sm:block"></div>
               <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  
                  {/* Target Staff */}
                  <div className="flex bg-gray-800 rounded-xl overflow-hidden border border-gray-700 h-11">
                     <select value={leader2BulkStaff} onChange={(e) => setLeader2BulkStaff(e.target.value)} className="bg-transparent text-sm font-bold text-white outline-none px-3 cursor-pointer">
                        <option value="" className="text-gray-900">-- Pindah Staff --</option>
                        {employees.map(emp => (
                           <option key={emp.id} value={emp.name} className="text-gray-900">{emp.name}</option>
                        ))}
                     </select>
                  </div>

                  {/* Target Tanggal */}
                  <div className="flex items-center bg-gray-800 rounded-xl overflow-hidden border border-gray-700 h-11 px-2 text-white">
                     <span className="text-xs text-gray-400 mr-2">Tgl:</span>
                     <input type="date" value={leader2BulkDate} onChange={(e) => setLeader2BulkDate(e.target.value)} className="bg-transparent border-none text-sm outline-none text-white w-32 cursor-pointer" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} />
                  </div>

                  <button onClick={handleLeader2BulkAction} disabled={!leader2BulkStaff && !leader2BulkDate || isDeletingRange} className="h-11 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
                     {isDeletingRange ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Update
                  </button>
                  <button onClick={handleDeleteLeader2Bulk} disabled={isDeletingRange} className="h-11 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center gap-2">
                     <Trash2 size={16} /> Hapus
                  </button>
               </div>
            </div>
         )}
"""

# Inject after SCAN_ALL block
scan_all_block_close = """                                    {isDeletingRange ? 'Updating...' : 'Pindah Data'}
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )
         }"""

if "{/* BULK ACTION BAR FOR LEADER_2_DATA */}" not in content:
    content = content.replace(scan_all_block_close, scan_all_block_close + leader2_action_bar)


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

