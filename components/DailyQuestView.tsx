import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserRole } from '../types';
import { Lock, Unlock, Plus, Trash2, RefreshCw, Loader2, CheckSquare, Square, Target } from 'lucide-react';

interface DailyQuest {
  id: string;
  quest_date: string;
  quest_name: string;
  target_roles: string[];
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

export const DailyQuestView: React.FC = () => {
  const [currentQuest, setCurrentQuest] = useState<DailyQuest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [questName, setQuestName] = useState('FISIK_STOCK');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const availableRoles = [
    UserRole.PICKER,
    UserRole.SORTIR,
    UserRole.PACKING,
    UserRole.GUDANG,
    UserRole.OJOL,
    UserRole.LEADER,
    UserRole.SORTIR_BATCH,
    UserRole.CHECKER
  ];

  const fetchCurrentQuest = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data, error } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('quest_date', todayStr)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Failed to fetch quest:', error);
        }
        setCurrentQuest(null);
      } else {
        setCurrentQuest(data as DailyQuest);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentQuest();

    // Listen to realtime changes
    const sub = supabase
      .channel('public:daily_quests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_quests' }, () => {
        fetchCurrentQuest();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const handleToggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleCreateQuest = async () => {
    if (!questName.trim()) return alert("Nama quest tidak boleh kosong.");
    
    setIsCreating(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { error } = await supabase
        .from('daily_quests')
        .upsert({
          quest_date: todayStr,
          quest_name: questName,
          target_roles: selectedRoles,
          is_completed: false,
          completed_by: null,
          completed_at: null
        }, { onConflict: 'quest_date' });

      if (error) throw error;
      alert("Quest berhasil dibuat dan aplikasi terkunci untuk target yang dipilih.");
      await fetchCurrentQuest();
    } catch (e: any) {
      alert("Gagal membuat quest: " + e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteQuest = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus quest hari ini? Semua device akan terbuka.")) return;
    
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { error } = await supabase
        .from('daily_quests')
        .delete()
        .eq('quest_date', todayStr);

      if (error) throw error;
      alert("Quest hari ini telah dihapus.");
      setCurrentQuest(null);
    } catch (e: any) {
      alert("Gagal menghapus quest: " + e.message);
    }
  };

  if (isLoading && !currentQuest) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-2">
           <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
              <Target size={24} />
           </div>
           <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quest Harian</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kelola quest untuk mengunci aplikasi dan memaksa user melakukan stock opname.</p>
           </div>
        </div>

        {/* Current Quest Status */}
        {currentQuest ? (
          <div className={`p-6 rounded-2xl border ${currentQuest.is_completed ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`text-xl font-bold mb-2 flex items-center gap-2 ${currentQuest.is_completed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {currentQuest.is_completed ? <Unlock size={24} /> : <Lock size={24} />}
                  Status: {currentQuest.is_completed ? 'Terbuka (Quest Selesai)' : 'Terkunci (Quest Aktif)'}
                </h3>
                <div className="text-sm space-y-1 mt-4 text-gray-700 dark:text-gray-300">
                  <p><strong>Nama Quest:</strong> {currentQuest.quest_name}</p>
                  <p><strong>Target Role:</strong> {currentQuest.target_roles && currentQuest.target_roles.length > 0 ? currentQuest.target_roles.join(', ') : 'Semua User'}</p>
                  {currentQuest.is_completed && (
                    <>
                      <p><strong>Diselesaikan Oleh:</strong> {currentQuest.completed_by}</p>
                      <p><strong>Waktu Selesai:</strong> {new Date(currentQuest.completed_at!).toLocaleString('id-ID')}</p>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={handleDeleteQuest}
                className="p-3 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                title="Hapus / Reset Quest Hari Ini"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Unlock size={20} /> Tidak Ada Quest Aktif Hari Ini
            </h3>
            <p className="text-sm text-gray-500 mt-2">Aplikasi saat ini dapat diakses oleh semua user tanpa batas.</p>
          </div>
        )}

        {/* Create Quest Form */}
        <div className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Plus size={20} className="text-indigo-500" /> Buat / Timpa Quest Hari Ini
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nama Quest</label>
              <input 
                type="text" 
                value={questName} 
                onChange={e => setQuestName(e.target.value)} 
                placeholder="Contoh: FISIK_STOCK"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target Roles (Aplikasi akan terkunci untuk role yang dipilih)</label>
              <p className="text-xs text-gray-500 mb-4">Jika tidak ada yang dipilih, maka akan mengunci <strong>SEMUA USER</strong> secara default.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableRoles.map(role => {
                  const isSelected = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      onClick={() => handleToggleRole(role)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      {isSelected ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} />}
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={handleCreateQuest}
              disabled={isCreating}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
            >
              {isCreating ? <Loader2 size={20} className="animate-spin" /> : <Lock size={20} />}
              Terapkan Quest & Kunci Aplikasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
