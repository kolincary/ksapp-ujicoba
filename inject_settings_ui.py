import re

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

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

if "activeView === 'SETTINGS'" not in text:
    text = text.replace("{activeView === 'SUPABASE_CONFIG' && (", settings_ui + "\n                        {activeView === 'SUPABASE_CONFIG' && (")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Injected SETTINGS UI")
else:
    print("SETTINGS UI already exists")
