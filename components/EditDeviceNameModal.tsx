import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  Copy,
  Check,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  Info
} from 'lucide-react';
import { saveDeviceCustomName, deleteDeviceCustomName } from '../services/deviceCustomNameService';

interface EditDeviceNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  initialName?: string;
  initialNote?: string;
  onSaved: (deviceId: string, newName: string, newNote?: string) => void;
  onDeleted?: (deviceId: string) => void;
}

const PRESET_SUGGESTIONS = [
  'PC-1',
  'PC-2',
  'PC-3',
  'PC ISMI',
  'PC AINUL',
  'PC PACKING',
  'LAPTOP LOGISTIK 01',
  'LAPTOP GUDANG 01'
];

export const EditDeviceNameModal: React.FC<EditDeviceNameModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  initialName = '',
  initialNote = '',
  onSaved,
  onDeleted
}) => {
  const [customName, setCustomName] = useState(initialName);
  const [note, setNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomName(initialName || '');
      setNote(initialNote || '');
      setErrorMsg(null);
    }
  }, [isOpen, initialName, initialNote]);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setErrorMsg('Nama perangkat tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await saveDeviceCustomName(deviceId, trimmedName, note.trim());
      onSaved(deviceId, trimmedName, note.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
        'Gagal menyimpan ke Supabase. Pastikan tabel device_custom_names sudah dibuat di Supabase SQL Editor.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus nama custom untuk perangkat "${deviceId}" dan kembalikan ke default?`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await deleteDeviceCustomName(deviceId);
      if (onDeleted) onDeleted(deviceId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menghapus nama dari Supabase.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700 animate-[popIn_0.2s_ease-out]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/20 dark:via-indigo-950/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <Tag size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                Beri Nama / Label Perangkat
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Nama ini tersimpan di Supabase agar mudah mengenali pemilik atau posisi fisik perangkat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          
          {/* Device ID Display */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-gray-750 border border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                ID Perangkat
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-gray-800 dark:text-gray-200 truncate block">
                {deviceId}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 text-xs font-bold border border-gray-200 dark:border-gray-600 shadow-2xs transition-colors shrink-0"
              title="Salin ID"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          {/* Quick Preset Suggestions */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2">
              <Sparkles size={13} className="text-amber-500" />
              <span>Pilihan Cepat / Rekomendasi:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomName(preset)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-700/60 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 transition-all cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Input Custom Name */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Nama Kustom Perangkat <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Contoh: PC-1, PC ISMI, PC AINUL, Laptop Ade"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full h-11 px-3.5 text-sm font-extrabold bg-white dark:bg-gray-700/60 border-2 border-gray-200 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 rounded-xl focus:ring-4 focus:ring-blue-500/15 text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-normal transition-all"
              required
            />
          </div>

          {/* Input Note / Location */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">
              Catatan / Lokasi Fisik (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Meja Packing LT 1, Pos Sortir LT 2, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-10 px-3.5 text-xs font-medium bg-white dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 focus:border-blue-500 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <Info size={16} className="shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
            <div>
              {initialName ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Hapus nama custom dan kembalikan ke default"
                >
                  <Trash2 size={14} />
                  <span>Hapus Nama</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || !customName.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Simpan ke Supabase</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
