import React, { useState, useMemo } from 'react';
import {
  X,
  Laptop,
  ShieldCheck,
  Check,
  Copy,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2
} from 'lucide-react';
import {
  DeviceAccessRule,
  SPECIAL_ADMIN_FEATURES,
  SpecialFeatureItem,
  getCleanEmailKey,
  allowDevice,
  blockDevice,
  deleteDeviceRule,
  updateDeviceSpecialFeatures,
  toggleDeviceSpecialFeature
} from '../services/deviceSecurityService';
import { getDeviceId } from '../services/deviceTracker';
import { DeviceCustomName, fetchDeviceCustomNames } from '../services/deviceCustomNameService';

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard writeText failed, falling back:', err);
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy fallback failed:', err);
    return false;
  }
};

interface DeviceFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUsername: string;
  deviceRules: DeviceAccessRule[];
  onToast?: (message: string) => void;
}

export const DeviceFeatureModal: React.FC<DeviceFeatureModalProps> = ({
  isOpen,
  onClose,
  adminUsername,
  deviceRules,
  onToast
}) => {
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceLabel, setNewDeviceLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customDeviceNames, setCustomDeviceNames] = useState<Record<string, DeviceCustomName>>({});

  React.useEffect(() => {
    if (isOpen) {
      fetchDeviceCustomNames().then(setCustomDeviceNames);
    }
  }, [isOpen]);

  const cleanAdminKey = useMemo(() => getCleanEmailKey(adminUsername), [adminUsername]);
  const myCurrentDeviceId = useMemo(() => getDeviceId(), []);

  // Filter devices registered specifically for this admin username
  const adminDevices = useMemo(() => {
    return deviceRules.filter(
      r => r.user_email?.toLowerCase().trim() === cleanAdminKey
    );
  }, [deviceRules, cleanAdminKey]);

  // Check if current browser device is already registered for this admin
  const isCurrentDeviceRegistered = useMemo(() => {
    return adminDevices.some(
      r => (r.device_id || '').trim() === myCurrentDeviceId.trim()
    );
  }, [adminDevices, myCurrentDeviceId]);

  if (!isOpen) return null;

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(text);
      if (onToast) onToast(`ID Perangkat disalin: ${text}`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleAddCurrentDevice = async () => {
    if (!adminUsername || !myCurrentDeviceId) return;
    setIsSubmitting(true);
    try {
      // Auto register current device and default grant copy_logistik_comparison
      await allowDevice(
        adminUsername,
        myCurrentDeviceId,
        'Perangkat Saya Saat Ini',
        'Ditambahkan otomatis melalui Manajemen Admin'
      );
      await updateDeviceSpecialFeatures(
        adminUsername,
        myCurrentDeviceId,
        ['copy_logistik_comparison'],
        'Perangkat Saya Saat Ini'
      );
      if (onToast) {
        onToast(`Perangkat saat ini (${myCurrentDeviceId}) berhasil didaftarkan untuk ${adminUsername}!`);
      }
    } catch (err: any) {
      alert(`Gagal mendaftarkan perangkat: ${err?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const devId = newDeviceId.trim();
    if (!devId) {
      alert('Masukkan ID Perangkat.');
      return;
    }

    setIsSubmitting(true);
    try {
      const label = newDeviceLabel.trim() || 'Perangkat Tambahan';
      await allowDevice(
        adminUsername,
        devId,
        label,
        'Didaftarkan manual via Manajemen Admin'
      );
      // Default aktifkan izin salin komparasi
      await updateDeviceSpecialFeatures(
        adminUsername,
        devId,
        ['copy_logistik_comparison'],
        label
      );
      setNewDeviceId('');
      setNewDeviceLabel('');
      if (onToast) {
        onToast(`ID Perangkat ${devId} berhasil didaftarkan untuk ${adminUsername}!`);
      }
    } catch (err: any) {
      alert(`Gagal mendaftarkan perangkat: ${err?.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFeature = async (
    rule: DeviceAccessRule,
    featureId: string
  ) => {
    try {
      const currentFeatures = rule.special_features || [];
      await toggleDeviceSpecialFeature(
        rule.user_email,
        rule.device_id,
        featureId,
        currentFeatures,
        rule.device_label
      );
      if (onToast) {
        const isNowActive = !currentFeatures.includes(featureId);
        const feat = SPECIAL_ADMIN_FEATURES.find(f => f.id === featureId);
        onToast(`${feat?.label || featureId}: ${isNowActive ? 'Diaktifkan ✅' : 'Dinonaktifkan ❌'}`);
      }
    } catch (err: any) {
      alert(`Gagal mengubah izin fitur: ${err?.message || 'Error'}`);
    }
  };

  const handleToggleStatus = async (rule: DeviceAccessRule) => {
    try {
      if (rule.status === 'ALLOWED') {
        await blockDevice(rule.user_email, rule.device_id, rule.device_label);
        if (onToast) onToast(`Perangkat ${rule.device_id} diblokir untuk ${adminUsername}.`);
      } else {
        await allowDevice(rule.user_email, rule.device_id, rule.device_label);
        if (onToast) onToast(`Perangkat ${rule.device_id} diizinkan kembali.`);
      }
    } catch (err: any) {
      alert(`Gagal mengubah status: ${err?.message || 'Error'}`);
    }
  };

  const handleDeleteRule = async (rule: DeviceAccessRule) => {
    if (!window.confirm(`Hapus aturan perangkat "${rule.device_label || rule.device_id}" untuk akun ${adminUsername}?`)) {
      return;
    }
    try {
      await deleteDeviceRule(rule.user_email, rule.device_id);
      if (onToast) onToast(`Aturan perangkat dihapus.`);
    } catch (err: any) {
      alert(`Gagal menghapus aturan: ${err?.message || 'Error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl lg:max-w-3xl rounded-3xl shadow-2xl relative z-10 flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 dark:border-gray-700 animate-[popIn_0.2s_ease-out]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/20 dark:via-indigo-950/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Laptop size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                  Perangkat & Fitur Khusus
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {adminUsername}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Fitur khusus seperti <b>Tombol Salin</b> akan langsung aktif otomatis pada perangkat terpilih tanpa perlu ketik <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">devmodenew</span>.
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

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 min-h-0">
          
          {/* Current Device Banner */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-gray-850 border border-slate-200/80 dark:border-gray-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">ID Perangkat Anda Saat Ini</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-black text-xs sm:text-sm text-gray-800 dark:text-gray-200 truncate">
                    {myCurrentDeviceId}
                  </span>
                  <button
                    onClick={() => handleCopy(myCurrentDeviceId)}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Salin ID Perangkat"
                  >
                    {copiedId === myCurrentDeviceId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              {!isCurrentDeviceRegistered ? (
                <button
                  type="button"
                  onClick={handleAddCurrentDevice}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>+ Daftarkan Perangkat Ini</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                  <CheckCircle2 size={14} /> Terdaftar untuk {adminUsername}
                </span>
              )}
            </div>
          </div>

          {/* Form Daftarkan ID Manual */}
          <form
            onSubmit={handleManualAddDevice}
            className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-750/50 border border-gray-200 dark:border-gray-700 space-y-3"
          >
            <div className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" />
              <span>Daftarkan ID Perangkat Baru untuk {adminUsername}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  placeholder="ID Perangkat (contoh: DEV-4E7B82C10F...)"
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-mono font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder:font-sans placeholder:font-normal placeholder:text-gray-400"
                />
              </div>
              <div className="sm:col-span-4">
                <input
                  type="text"
                  placeholder="Label / Pemilik (contoh: Laptop Meja 02)"
                  value={newDeviceLabel}
                  onChange={(e) => setNewDeviceLabel(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder:font-normal placeholder:text-gray-400"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newDeviceId.trim()}
                  className="w-full h-10 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Simpan
                </button>
              </div>
            </div>
          </form>

          {/* List Perangkat Terdaftar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span>Perangkat Terdaftar ({adminDevices.length})</span>
              </h4>
              <span className="text-[11px] text-gray-400">
                Pilih fitur khusus yang aktif per perangkat
              </span>
            </div>

            {adminDevices.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50 text-indigo-500" />
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">Belum ada perangkat terdaftar untuk akun {adminUsername}</p>
                <p className="text-[11px] mt-1 text-gray-400">
                  Daftarkan ID perangkat di atas agar akun ini bisa menggunakan tombol Salin dan fitur DevMode di perangkat tersebut.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminDevices.map((rule) => {
                  const isCurrent = (rule.device_id || '').trim() === myCurrentDeviceId.trim();
                  const isAllowed = rule.status === 'ALLOWED';
                  const activeFeatures = rule.special_features || [];

                  return (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrent
                          ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/15 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300'
                      }`}
                    >
                      {/* Top Row: Device Info & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              {customDeviceNames[(rule.device_id || '').trim()]?.custom_name && (
                                <span className="text-blue-600 dark:text-blue-400 font-black bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md text-xs">
                                  {customDeviceNames[(rule.device_id || '').trim()].custom_name}
                                </span>
                              )}
                              <span>{rule.device_label || 'Perangkat'}</span>
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                Ini Perangkat Anda
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isAllowed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {isAllowed ? '✓ DIIZINKAN' : '✕ DIBLOKIR'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
                              ID: {rule.device_id}
                            </span>
                            <button
                              onClick={() => handleCopy(rule.device_id)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              title="Salin ID"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Status Toggle & Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(rule)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              isAllowed
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                            title={isAllowed ? 'Blokir perangkat ini' : 'Buka blokir'}
                          >
                            {isAllowed ? <Lock size={12} /> : <Unlock size={12} />}
                            <span>{isAllowed ? 'Blokir' : 'Izinkan'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Hapus Aturan Perangkat"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Feature Toggles */}
                      <div className="pt-3">
                        <div className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          Hak Akses Fitur Khusus:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SPECIAL_ADMIN_FEATURES.map((feat) => {
                            const isChecked = activeFeatures.includes(feat.id);
                            return (
                              <label
                                key={feat.id}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                                    : 'bg-gray-50/40 dark:bg-gray-800 border-gray-200/80 dark:border-gray-700 hover:bg-gray-100/60 dark:hover:bg-gray-750'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleFeature(rule, feat.id)}
                                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                      {feat.label}
                                    </span>
                                    {feat.badge && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                        {feat.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                    {feat.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
