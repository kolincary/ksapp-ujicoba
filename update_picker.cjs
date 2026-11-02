const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/scan kalindo sortir update/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

let target1 = "value={activeView === 'PICKER_DATA' ? 'Leader' : (activeView === 'OJOL_DATA' ? filterOjolShift : filterPackingShift)}";
let target2 = "className={`w-full pl-9 pr-8 h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:outline-none ${activeView === 'PICKER_DATA' ? 'opacity-70 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 cursor-pointer'}`}";
let target3 = "disabled={activeView === 'PICKER_DATA'}";
let target4 = `{activeView === 'PICKER_DATA' ? (
                                                <option value="Leader">Leader</option>
                                             ) : (
                                                <>
                                                   <option value="ALL">All Shifts</option>
                                                   {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                                                </>
                                             )}`;

content = content.replace(target1, "value={activeView === 'OJOL_DATA' ? filterOjolShift : filterPackingShift}");
content = content.replace(target2, 'className="w-full pl-9 pr-8 h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"');
content = content.replace(target3, "");
content = content.replace(target4, `<>
                                                   <option value="ALL">All Shifts</option>
                                                   {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                                                </>`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Update finished successfully');
