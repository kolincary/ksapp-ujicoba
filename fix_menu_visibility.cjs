const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const uiComponent = `
                        {activeView === 'MENU_VISIBILITY' && (
                           <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 p-6 overflow-y-auto">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                 <div>
                                    <h2 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                                       <EyeOff className="text-indigo-600 dark:text-indigo-400" size={28} />
                                       Menu Visibility Configuration
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sembunyikan atau tampilkan menu secara global (real-time). Menu yang disembunyikan tidak akan muncul di sidebar semua admin.</p>
                                 </div>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                       { view: 'DASHBOARD', label: 'Overview Users' },
                                       { view: 'USER_MONITORING', label: 'Check Active User' },
                                       { view: 'ADMIN_NOTES', label: 'Catatan Shift & Urgent' },
                                       { view: 'SEARCH_ALL', label: 'Search Data' },
                                       { view: 'SEARCH_ALL_FIRESTORE', label: 'Search Data 2' },
                                       { view: 'PACKING_DATA', label: 'Data Packing' },
                                       { view: 'SORTIR_DATA', label: 'Data Sortir' },
                                       { view: 'PICKER_DATA', label: 'Data Picker' },
                                       { view: 'LOGISTIK_DATA', label: 'Data Logistik' },
                                       { view: 'CHECKER_DATA', label: 'Data Checker' },
                                       { view: 'LEADER_2_DATA', label: 'Rekap Leader' },
                                       { view: 'OJOL_DATA', label: 'Data Ojol' },
                                       { view: 'SCAN_ALL', label: 'Pindah Data' },
                                       { view: 'BATCH_DATA_2', label: 'Progress Order' },
                                       { view: 'BATCH_DATA_3', label: 'Batch management' },
                                       { view: 'CANCEL_DATA', label: 'Data Cancel' },
                                       { view: 'TRACK_RESI', label: 'Tracking Resi' },
                                       { view: 'PRINT_FORMS', label: 'Print Form Cetak' },
                                       { view: 'GUDANG_PENDING', label: 'Pending Scans (LT3)' },
                                       { view: 'GUDANG_READY', label: 'Resi Ready (LT3)' },
                                       { view: 'GUDANG_CANCEL', label: 'Scan Cancel (LT3)' },
                                       { view: 'GUDANG_REPORT', label: 'Gudang Report' },
                                       { view: 'GUDANG_BUNDLING', label: 'Data Bundling' },
                                       { view: 'EMPLOYEES', label: 'Data Karyawan' },
                                       { view: 'ADMIN_MANAGEMENT', label: 'Manajemen Admin' },
                                       { view: 'ACCESS', label: 'Access Control' },
                                       { view: 'PINS', label: 'PIN Management' },
                                       { view: 'PROFILE_CONFIG', label: 'Pengaturan Profil' },
                                       { view: 'BATCH_DATA', label: 'Batch Management Old' }
                                    ].map((menuItem) => {
                                       const isHidden = (hiddenMenus || []).includes(menuItem.view);
                                       return (
                                          <div key={menuItem.view} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                             <div>
                                                <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{menuItem.label}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{menuItem.view}</div>
                                             </div>
                                             <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                   type="checkbox" 
                                                   className="sr-only peer" 
                                                   checked={!isHidden}
                                                   onChange={async (e) => {
                                                      const willShow = e.target.checked;
                                                      let newHidden = [...(hiddenMenus || [])];
                                                      if (willShow) {
                                                         newHidden = newHidden.filter(v => v !== menuItem.view);
                                                      } else {
                                                         if (!newHidden.includes(menuItem.view)) newHidden.push(menuItem.view);
                                                      }
                                                      setHiddenMenus(newHidden);
                                                      localStorage.setItem('hidden_admin_menus', JSON.stringify(newHidden));
                                                      try {
                                                         await supabase.from('app_settings').upsert({ id: 1, setting_key: 'hidden_menus', setting_value: JSON.stringify(newHidden) });
                                                      } catch(err) {
                                                         console.error("Failed to update app_settings", err);
                                                      }
                                                   }}
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                                             </label>
                                          </div>
                                       );
                                    })}
                                 </div>
                              </div>
                           </div>
                        )}
`;

content = content.replace("{activeView === 'TRACK_RESI' && (() => {", uiComponent + "\n                        {activeView === 'TRACK_RESI' && (() => {");

fs.writeFileSync(filePath, content);
console.log("Updated AdminDashboard.tsx");
