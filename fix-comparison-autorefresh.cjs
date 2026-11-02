const fs = require('fs');
let data = fs.readFileSync('components/DataComparisonView.tsx', 'utf8');

// 1. Add isBackgroundRefreshing to state
const stateInsertIdx = data.indexOf('const [isLoading, setIsLoading] = useState(false);');
if (stateInsertIdx !== -1) {
    const newState = `const [isLoading, setIsLoading] = useState(false);\n   const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);\n   const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);`;
    data = data.replace('const [isLoading, setIsLoading] = useState(false);', newState);
}

// 2. Modify fetchAndCompareData
const fetchRegex = /const fetchAndCompareData = async \(\) => \{\s*setIsLoading\(true\);/;
if (fetchRegex.test(data)) {
    data = data.replace(fetchRegex, `const fetchAndCompareData = async (isBackground = false) => {\n      if (!isBackground) setIsLoading(true);\n      else setIsBackgroundRefreshing(true);`);
}

// 3. Modify finally block of fetchAndCompareData
const finallyRegex = /finally \{\s*setIsLoading\(false\);\s*\}/;
if (finallyRegex.test(data)) {
    data = data.replace(finallyRegex, `finally {\n         if (!isBackground) setIsLoading(false);\n         else setIsBackgroundRefreshing(false);\n      }`);
}

// 4. Modify useEffect
const useEffectRegex = /useEffect\(\(\) => \{\s*if \(topMode === 'INTERNAL'\) \{\s*fetchAndCompareData\(\);\s*\}\s*\}, \[startDate, endDate, roleA, roleB, topMode\]\);/;
if (useEffectRegex.test(data)) {
    data = data.replace(useEffectRegex, `useEffect(() => {
      let interval: any;
      if (topMode === 'INTERNAL') {
         fetchAndCompareData();
         
         if (autoRefreshEnabled) {
            interval = setInterval(() => {
               fetchAndCompareData(true);
            }, 30000);
         }
      }
      return () => {
         if (interval) clearInterval(interval);
      };
   }, [startDate, endDate, roleA, roleB, topMode, autoRefreshEnabled]);`);
}

// 5. Update UI for the Refresh button to include auto refresh toggle
const refreshBtnRegex = /<button onClick=\{fetchAndCompareData\} disabled=\{isLoading\} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50">/g;
if (refreshBtnRegex.test(data)) {
    data = data.replace(refreshBtnRegex, `<div className="flex items-center bg-indigo-600 rounded-xl overflow-hidden shadow-lg">
                     <button onClick={() => fetchAndCompareData(false)} disabled={isLoading || isBackgroundRefreshing} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 border-r border-indigo-400">
                        <RefreshCw size={15} className={(isLoading || isBackgroundRefreshing) ? 'animate-spin' : ''} />
                        <span>Refresh Data</span>
                     </button>
                     <button 
                        onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                        className={\`px-3 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 \${autoRefreshEnabled ? 'bg-indigo-500 text-white' : 'bg-indigo-700 text-indigo-300'}\`}
                        title={autoRefreshEnabled ? "Auto Refresh Aktif (30 dtk)" : "Auto Refresh Nonaktif"}
                     >
                        <Clock size={14} />
                        {autoRefreshEnabled ? 'Auto ON' : 'Auto OFF'}
                     </button>
                  </div>
                  {/* HIDDEN OLD BUTTON START */}\n                  <button style={{display:'none'}} onClick={() => fetchAndCompareData(false)} disabled={isLoading} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50">`);
}

fs.writeFileSync('components/DataComparisonView.tsx', data);
console.log("Success");
