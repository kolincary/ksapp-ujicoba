
import React, { useState } from 'react';
import { User, Shield, Zap, ArrowRight, CheckCircle, Users } from 'lucide-react';
import { UserPermissions } from '../types';

interface ModeSelectionModalProps {
  onSelectMode: (mode: 'SELF' | 'IMPERSONATE', targetEmail?: string) => void;
  currentUser: string;
  availableUsers: UserPermissions; // We use the permissions object keys as the user list
}

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({ onSelectMode, currentUser, availableUsers }) => {
  const [view, setView] = useState<'MAIN' | 'USER_LIST'>('MAIN');
  const userList = Object.keys(availableUsers).filter(email => email !== currentUser);

  const handleSelf = () => {
    onSelectMode('SELF');
  };

  const handleUserSelect = (email: string) => {
    onSelectMode('IMPERSONATE', email);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shrink-0">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                 <Zap size={24} fill="currentColor" className="text-yellow-300" />
              </div>
              <div>
                 <h2 className="text-xl font-bold">God Mode Active</h2>
                 <p className="text-blue-100 text-xs">Identity Selection Protocol</p>
              </div>
           </div>
        </div>

        {view === 'MAIN' ? (
           <div className="p-6 space-y-4">
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                 Welcome, <span className="font-bold text-gray-900 dark:text-white">{currentUser}</span>. <br/>
                 Please select your login method:
              </p>

              <button 
                onClick={handleSelf}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 rounded-2xl group transition-all"
              >
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                       <User size={24} />
                    </div>
                    <div className="text-left">
                       <h3 className="font-bold text-gray-900 dark:text-white">Login as Myself</h3>
                       <p className="text-xs text-gray-500 dark:text-gray-400">Continue as {currentUser}</p>
                    </div>
                 </div>
                 <ArrowRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </button>

              <button 
                onClick={() => setView('USER_LIST')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-700 rounded-2xl group transition-all"
              >
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                       <Shield size={24} />
                    </div>
                    <div className="text-left">
                       <h3 className="font-bold text-gray-900 dark:text-white">Impersonate User</h3>
                       <p className="text-xs text-gray-500 dark:text-gray-400">Login as another account (Bypass PIN)</p>
                    </div>
                 </div>
                 <ArrowRight size={20} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
              </button>
           </div>
        ) : (
           <div className="flex flex-col flex-1 min-h-0">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                 <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users size={18} className="text-purple-500" /> Select Account
                 </h3>
                 <button onClick={() => setView('MAIN')} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                 {userList.map(email => (
                    <button
                       key={email}
                       onClick={() => handleUserSelect(email)}
                       className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-transparent hover:border-purple-100 dark:hover:border-purple-800 transition-all text-left group"
                    >
                       <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-purple-600 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors text-xs font-bold shrink-0">
                          {email.charAt(0).toUpperCase()}
                       </div>
                       <div className="overflow-hidden">
                          <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{email}</p>
                          <p className="text-[10px] text-gray-400">Target Account</p>
                       </div>
                    </button>
                 ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
