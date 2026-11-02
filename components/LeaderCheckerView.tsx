import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Save, AlertCircle, Search, CheckCircle2, UserCheck, Calendar as CalendarIcon, RefreshCw, XCircle, Users, UserPlus, UserMinus, X, Shield } from 'lucide-react';

interface LeaderCheckerViewProps {
    leaderName: string;
    onBack: () => void;
}

export const LeaderCheckerView: React.FC<LeaderCheckerViewProps> = ({ leaderName, onBack }) => {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [employees, setEmployees] = useState<{ id: number; name: string; allowed_roles?: string }[]>([]);
    const [activeCheckers, setActiveCheckers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [savedState, setSavedState] = useState<string[]>([]); // Track what was last saved

    // Fetch Employees
    useEffect(() => {
        const fetchEmployees = async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('id, name, allowed_roles')
                .eq('active', true)
                .order('name');
            
            if (data && !error) {
                setEmployees(data);
            }
        };
        fetchEmployees();
    }, []);

    // Fetch existing attendance for the selected date and leader
    useEffect(() => {
        const fetchAttendance = async () => {
            setIsLoading(true);
            setMessage(null);
            const { data, error } = await supabase
                .from('checker_attendance')
                .select('active_checkers')
                .eq('date', date)
                .eq('leader_name', leaderName)
                .maybeSingle();

            if (data && !error) {
                setActiveCheckers(data.active_checkers || []);
                setSavedState(data.active_checkers || []);
            } else {
                setActiveCheckers([]);
                setSavedState([]);
            }
            setIsLoading(false);
        };
        fetchAttendance();
    }, [date, leaderName]);

    const handleToggleChecker = (name: string) => {
        setActiveCheckers(prev => 
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const handleRemoveChecker = (name: string) => {
        setActiveCheckers(prev => prev.filter(n => n !== name));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const { data: existing, error: checkError } = await supabase
                .from('checker_attendance')
                .select('id')
                .eq('date', date)
                .eq('leader_name', leaderName)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                const { error } = await supabase
                    .from('checker_attendance')
                    .update({ active_checkers: activeCheckers, leader_name: leaderName })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('checker_attendance')
                    .insert([{ date, active_checkers: activeCheckers, leader_name: leaderName }]);
                if (error) throw error;
            }

            setSavedState([...activeCheckers]);
            setMessage({ text: `${activeCheckers.length} Checker berhasil disimpan untuk ${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, type: 'success' });
            setTimeout(() => setMessage(null), 4000);
        } catch (error: any) {
            setMessage({ text: error.message || 'Gagal menyimpan data', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const checkerEmployees = employees.filter(emp => 
        emp.allowed_roles?.includes('CHECKER')
    );

    const filteredEmployees = checkerEmployees.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !activeCheckers.includes(emp.name)
    );

    const hasChanges = JSON.stringify([...activeCheckers].sort()) !== JSON.stringify([...savedState].sort());

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;

    return (
        <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-900 custom-scrollbar relative">
            
            {/* Header Card */}
            <div className="px-4 md:px-6 pt-6 pb-2">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                        
                        {/* Decorative background pattern */}
                        <div className="absolute right-0 top-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                                    <Shield size={20} className="text-teal-600 dark:text-teal-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">Kelola Checker</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-0.5">Pilih checker yang bertugas membagi rata orderan</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 flex flex-wrap items-center gap-2 md:gap-3">
                            <div className="relative w-full sm:w-auto sm:min-w-[160px]">
                                <input
                                    type="date"
                                    value={date}
                                    onClick={(e) => { try { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); } catch (error) { } }}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full h-11 pl-4 pr-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-sm cursor-pointer relative z-20"
                                    style={{ colorScheme: 'light' }}
                                />
                                <CalendarIcon size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-30" />
                                <style>{`input[type="date"]::-webkit-calendar-picker-indicator { position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }`}</style>
                            </div>
                            
                            {/* Date Badges */}
                            {isToday && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                    Hari Ini
                                </span>
                            )}
                            {hasChanges && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 animate-pulse">
                                    Belum disimpan
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Message Toast */}
            {message && (
                <div className="px-4 md:px-6 pt-4">
                    <div className="max-w-5xl mx-auto">
                        <div className={`p-4 rounded-2xl flex items-center gap-3 shadow-sm transition-all duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'}`}>
                            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                            <span className="font-semibold text-sm flex-1">{message.text}</span>
                            <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100 transition-opacity"><X size={16} /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content - Two Column Layout */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">

                        {/* CHECKER TERPILIH — Shown FIRST on mobile, RIGHT on desktop */}
                        <div className="order-1 lg:order-2 lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                            {/* Column Header */}
                            <div className="px-4 md:px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm">
                                        <UserCheck size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Checker Terpilih</h3>
                                        <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold">{activeCheckers.length} orang aktif hari ini</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selected Checkers List */}
                            <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:max-h-[55vh]">
                                {activeCheckers.length === 0 ? (
                                    <div className="text-center py-8 lg:py-12">
                                        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mx-auto mb-3">
                                            <UserPlus size={24} className="text-teal-300 dark:text-teal-600" />
                                        </div>
                                        <p className="text-gray-400 font-semibold text-sm">Belum ada checker terpilih</p>
                                        <p className="text-gray-400 text-xs mt-1">Klik nama di daftar karyawan untuk memilih</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-2 lg:flex-nowrap">
                                        {activeCheckers.map((name, index) => (
                                            <div
                                                key={name}
                                                className="group flex items-center gap-2.5 p-2.5 lg:p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200/60 dark:border-teal-700/40 transition-all"
                                            >
                                                {/* Number Badge */}
                                                <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg bg-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                                                    <span className="text-white text-xs font-bold">{index + 1}</span>
                                                </div>
                                                {/* Name */}
                                                <span className="flex-1 font-semibold text-teal-800 dark:text-teal-200 text-xs lg:text-sm truncate">{name}</span>
                                                {/* Remove Button */}
                                                <button
                                                    onClick={() => handleRemoveChecker(name)}
                                                    className="w-6 h-6 lg:w-7 lg:h-7 rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700/50 flex items-center justify-center opacity-60 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 transition-all active:scale-90"
                                                    title={`Hapus ${name}`}
                                                >
                                                    <UserMinus size={11} className="text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            {activeCheckers.length > 0 && (
                                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>Total Order ÷ {activeCheckers.length} checker</span>
                                        <span className="font-bold text-teal-600 dark:text-teal-400">= Bagi Rata</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* DAFTAR KARYAWAN — Shown SECOND on mobile, LEFT on desktop */}
                        <div className="order-2 lg:order-1 lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                            {/* Column Header */}
                            <div className="px-4 md:px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                            <Users size={16} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Daftar Karyawan</h3>
                                            <p className="text-xs text-gray-400">{checkerEmployees.length} orang dengan role Checker</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Search */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={14} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Cari nama karyawan..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-9 pr-9 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white placeholder:text-gray-400"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                            <XCircle size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Employee List */}
                            <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:max-h-[55vh]">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <RefreshCw className="animate-spin mb-3" size={24} />
                                        <p className="text-sm">Memuat data...</p>
                                    </div>
                                ) : filteredEmployees.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                                            <UserCheck size={28} className="text-gray-300 dark:text-gray-500" />
                                        </div>
                                        <p className="text-gray-400 font-semibold text-sm">
                                            {searchTerm ? 'Tidak ditemukan' : checkerEmployees.length === 0 ? 'Belum ada karyawan dengan role CHECKER' : 'Semua sudah dipilih! 🎉'}
                                        </p>
                                        {checkerEmployees.length === 0 && (
                                            <p className="text-gray-400 text-xs mt-1">Tambahkan role CHECKER di menu Admin → Data Karyawan</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filteredEmployees.map(emp => (
                                            <button
                                                key={emp.id}
                                                onClick={() => handleToggleChecker(emp.name)}
                                                className="group flex items-center gap-3 p-3 rounded-xl border border-gray-150 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 bg-white dark:bg-gray-800/60 transition-all text-left active:scale-[0.98]"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 group-hover:bg-teal-100 dark:group-hover:bg-teal-800/40 transition-colors">
                                                    <UserPlus size={14} className="text-gray-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                                                </div>
                                                <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm truncate">{emp.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent dark:from-gray-900 dark:via-gray-900/95 pointer-events-none flex justify-center">
                <div className="w-full max-w-5xl pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/80 dark:border-gray-700 p-3 md:p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                            <span className="text-lg font-black text-teal-600 dark:text-teal-400">{activeCheckers.length}</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Checker Aktif</p>
                            <p className="text-xs text-gray-400">
                                {isToday ? 'Hari ini' : new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {hasChanges ? ' · Ada perubahan' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className={`flex items-center gap-2 px-5 md:px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 ${hasChanges ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-500/25' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        <span className="hidden sm:inline">Simpan Absensi</span>
                        <span className="sm:hidden">Simpan</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
