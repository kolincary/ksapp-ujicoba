import re

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add state
if 'skipDuplicateBatch' not in text:
    state_injection = """
   // --- SYSTEM SETTINGS STATE ---
   const [skipDuplicateBatch, setSkipDuplicateBatch] = useState(false);
   const [isSavingSettings, setIsSavingSettings] = useState(false);

   useEffect(() => {
      // Fetch initial settings
      const fetchSettings = async () => {
         try {
            const { data, error } = await supabase.from('app_settings').select('skip_duplicate_batch').eq('id', 1).single();
            if (!error && data) {
               setSkipDuplicateBatch(!!data.skip_duplicate_batch);
            }
         } catch (err) {
            console.error("Error fetching settings:", err);
         }
      };
      fetchSettings();
   }, []);
"""
    text = re.sub(r'(const \[batchSearch, setBatchSearch\] = useState\(\'\'\);)', r'\1' + state_injection, text, count=1)


# 2. Modify handleSaveBatch
if 'Semua barcode duplikat' in text:
    old_logic = """         if (finalBarcodesToInsert.length === 0) {
            alert("Semua barcode duplikat, tidak ada data baru yang ditambahkan.");
            setIsSavingBatch(false);
            return;
         }"""
    
    new_logic = """         if (finalBarcodesToInsert.length === 0) {
            if (skipDuplicateBatch) {
               // Silently skip the duplicate error and pretend it succeeded as requested
               setSuccessToast(`Berhasil menyimpan ${uniqueLines.length} data batch.`);
               setIsBatchImportModalOpen(false);
               setBatchImportText('');
               fetchBatchData();
               setIsSavingBatch(false);
               return;
            } else {
               alert("Semua barcode duplikat, tidak ada data baru yang ditambahkan.");
               setIsSavingBatch(false);
               return;
            }
         }"""
    
    text = text.replace(old_logic, new_logic)


# 3. Add SETTINGS to VIEW_PERMISSIONS
if "'SETTINGS': 'manage_database'" not in text:
    text = text.replace("'SUPABASE_CONFIG': 'manage_database',", "'SUPABASE_CONFIG': 'manage_database',\n   'SETTINGS': 'manage_database',")


# 4. Add SETTINGS menu item
if 'view="SETTINGS"' not in text:
    settings_menu = """                     {showFakeReportMenu && (
                        <SidebarItem view="SETTINGS" icon={Settings} label="Pengaturan Sistem" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />
                     )}"""
    text = text.replace(
        '<SidebarItem view="SUPABASE_CONFIG" icon={Database} label="DB Config" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />',
        '<SidebarItem view="SUPABASE_CONFIG" icon={Database} label="DB Config" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />\n' + settings_menu
    )

# 5. Add SETTINGS UI View
if 'activeView === \'SETTINGS\'' not in text:
    settings_ui = """
                        {/* SETTINGS VIEW */}
                        {activeView === 'SETTINGS' && (
                           <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 p-6">
                              <div className="mb-6">
                                 <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Pengaturan Sistem</h2>
                                 <p className="text-sm text-gray-500 mt-1">Kelola konfigurasi global aplikasi.</p>
                              </div>

                              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
                                 <div className="flex items-center justify-between mb-4">
                                    <div>
                                       <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                          <Settings size={20} className="text-blue-500" />
                                          Lewati Peringatan Duplikat Batch
                                       </h3>
                                       <p className="text-sm text-gray-500 mt-1">
                                          Jika diaktifkan, menginput data batch yang sudah ada tidak akan memunculkan peringatan error. Sistem akan mengabaikan data duplikat dan menampilkan notifikasi sukses.
                                       </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                       <input 
                                          type="checkbox" 
                                          className="sr-only peer" 
                                          checked={skipDuplicateBatch}
                                          disabled={isSavingSettings}
                                          onChange={async (e) => {
                                             const newVal = e.target.checked;
                                             setSkipDuplicateBatch(newVal);
                                             setIsSavingSettings(true);
                                             try {
                                                const { error } = await supabase.from('app_settings').update({ skip_duplicate_batch: newVal }).eq('id', 1);
                                                if (error) throw error;
                                                setSuccessToast('Pengaturan berhasil disimpan');
                                             } catch (err: any) {
                                                console.error(err);
                                                alert('Gagal menyimpan pengaturan: ' + (err.message || 'Unknown Error'));
                                                setSkipDuplicateBatch(!newVal); // revert
                                             } finally {
                                                setIsSavingSettings(false);
                                             }
                                          }}
                                       />
                                       <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                 </div>
                              </div>
                           </div>
                        )}
"""
    # Insert it before PROFILE_CONFIG view or similar
    # Look for: {activeView === 'PROFILE_CONFIG' && (
    text = text.replace("{activeView === 'PROFILE_CONFIG' && (", settings_ui + "\n                        {activeView === 'PROFILE_CONFIG' && (")


with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Done re-implementing settings")
