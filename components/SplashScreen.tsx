import React from 'react';
import { Monitor, Loader2 } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 opacity-50"></div>

      <div className="flex flex-col items-center z-10 animate-[fadeIn_0.5s_ease-out]">
        <div className="relative mb-6">
           <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/40 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
           <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center relative z-10 border border-blue-50 dark:border-gray-700 transition-colors">
              <Monitor className="w-12 h-12 text-blue-600 dark:text-blue-500" strokeWidth={1.5} />
           </div>
           {/* Status Dot */}
           <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-[3px] border-white dark:border-gray-800 z-20 transition-colors"></div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2 transition-colors">
          Kalindo <span className="text-blue-600 dark:text-blue-500">Scan</span>
        </h1>
        <p className="text-gray-400 dark:text-gray-500 font-medium text-sm tracking-wide">Warehouse Management System</p>
      </div>

      <div className="absolute bottom-12 flex flex-col items-center">
         <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
            <Loader2 size={14} className="animate-spin" />
            <span>Initializing System</span>
         </div>
         <div className="text-gray-300 dark:text-gray-600 text-[10px] font-mono">v2.2 Cloud • Secure Connection</div>
      </div>
    </div>
  );
};