import fs from 'fs';

let content = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const filter_target = `                                    {/* 4. Staff Filter */}
                                    {(() => {`;

const filter_replace = `                                    {activeView === 'GUDANG_REPORT' && (
                                       <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-full sm:w-auto h-11">
                                          <button 
                                             onClick={() => setGudangReportTab('CURRENT')}
                                             className={\`flex-1 sm:flex-none px-4 h-full rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 \${gudangReportTab === 'CURRENT' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}\`}
                                          >
                                             Gudang Report Saat Ini
                                          </button>
                                          <button 
                                             onClick={() => setGudangReportTab('IMPORT')}
                                             className={\`flex-1 sm:flex-none px-4 h-full rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 \${gudangReportTab === 'IMPORT' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}\`}
                                          >
                                             Import Data Excel
                                          </button>
                                       </div>
                                    )}

                                    {/* 4. Staff Filter */}
                                    {(() => {`;

if (content.includes(filter_target)) {
    content = content.replace(filter_target, filter_replace);
    fs.writeFileSync('components/AdminDashboard.tsx', content);
    console.log("Tab switcher injected successfully");
} else {
    console.log("Target not found");
}
