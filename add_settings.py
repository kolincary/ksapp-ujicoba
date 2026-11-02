import os, re

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add states
state_to_add = '''
   // System Settings State
   const [skipDuplicateBatch, setSkipDuplicateBatch] = useState(false);
   const [isSavingSettings, setIsSavingSettings] = useState(false);
'''
if 'skipDuplicateBatch' not in text:
    text = text.replace('const [showSecretMenu, setShowSecretMenu] = useState(false); // DevMode Toggle for Secret Menus',
                        'const [showSecretMenu, setShowSecretMenu] = useState(false); // DevMode Toggle for Secret Menus' + state_to_add)

# 2. Add fetch logic in useEffect
use_effect_fetch = '''
   useEffect(() => {
      const fetchSettings = async () => {
         try {
            const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) setSkipDuplicateBatch(!!data.skip_duplicate_batch);
         } catch (err) {}
      };
      fetchSettings();
   }, []);
'''
if 'fetchSettings()' not in text:
    text = text.replace('     // --- Admin Data Excel Import States ---', use_effect_fetch + '\n     // --- Admin Data Excel Import States ---')

# 3. Modify handleSaveBatch
handle_save_batch_orig = '''         if (finalBarcodesToInsert.length === 0) {
            alert("Semua barcode duplikat, tidak ada data baru yang ditambahkan.");
            setIsSavingBatch(false);
            return;
         }'''

handle_save_batch_new = '''         if (finalBarcodesToInsert.length === 0) {
            if (skipDuplicateBatch) {
               setSuccessToast(`Berhasil menyimpan ${lines.length} data batch.`);
               setBatchImportText('');
               setBatchExcelFilename('');
               setIsBatchImportModalOpen(false);
               fetchBatchData();
               setIsSavingBatch(false);
               return;
            } else {
               alert("Semua barcode duplikat, tidak ada data baru yang ditambahkan.");
               setIsSavingBatch(false);
               return;
            }
         }'''
if handle_save_batch_orig in text:
    text = text.replace(handle_save_batch_orig, handle_save_batch_new)

# Also modify the final success message if some are inserted
success_toast_orig = '''setSuccessToast(`Berhasil menyimpan ${finalBarcodesToInsert.length} data batch.`);'''
success_toast_new = '''setSuccessToast(`Berhasil menyimpan ${skipDuplicateBatch ? lines.length : finalBarcodesToInsert.length} data batch.`);'''
if success_toast_orig in text:
    text = text.replace(success_toast_orig, success_toast_new)


# 4. Add SidebarItem
sidebar_item_orig = '<SidebarItem view="SUPABASE_CONFIG" icon={Database} label="DB Config" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />'
sidebar_item_new = sidebar_item_orig + '\n                     <SidebarItem view="SETTINGS" icon={Settings} label="Pengaturan Sistem" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />'
if sidebar_item_orig in text and 'view="SETTINGS"' not in text:
    text = text.replace(sidebar_item_orig, sidebar_item_new)

# 5. Add Settings View
settings_view = '''
                        {/* PENGATURAN SISTEM VIEW */}
                        {activeView === 'SETTINGS' && (
                           <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 animate-[fadeIn_0.3s_ease-out]">
                              <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
                                 <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Pengaturan Sistem</h2>
                                 <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 max-w-2xl">
                                     <div className="flex items-center justify-between">
                                         <div>
                                             <h3 className="font-bold text-gray-900 dark:text-white">Lewati Peringatan Duplikat Batch</h3>
                                             <p className="text-sm text-gray-500 mt-1 max-w-lg">Jika diaktifkan, menginput data batch yang sudah ada tidak akan memunculkan peringatan error. Sistem akan mengabaikan data duplikat dan menampilkan notifikasi sukses. Berlaku untuk semua pengguna.</p>
                                         </div>
                                         <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                                             <input type="checkbox" className="sr-only peer" checked={skipDuplicateBatch} onChange={async (e) => {
                                                 const newVal = e.target.checked;
                                                 setSkipDuplicateBatch(newVal);
                                                 setIsSavingSettings(true);
                                                 try {
                                                     const { error } = await supabase.from('app_settings').upsert({ id: 1, skip_duplicate_batch: newVal });
                                                     if (error) throw error;
                                                     setSuccessToast('Pengaturan berhasil disimpan');
                                                 } catch (err: any) {
                                                     alert('Gagal menyimpan pengaturan: ' + (err.message || 'Unknown Error'));
                                                     setSkipDuplicateBatch(!newVal);
                                                 } finally {
                                                     setIsSavingSettings(false);
                                                 }
                                             }} disabled={isSavingSettings} />
                                             <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                         </label>
                                     </div>
                                 </div>
                              </div>
                           </div>
                        )}
'''
# Insert before FAKE_REPORT view
if '{/* FAKE INVOICE REPORT VIEW (Hidden/DevMode) */}' in text and "activeView === 'SETTINGS'" not in text:
    text = text.replace('{/* FAKE INVOICE REPORT VIEW (Hidden/DevMode) */}', settings_view + '\n                        {/* FAKE INVOICE REPORT VIEW (Hidden/DevMode) */}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Done applying python modifications')
