import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Server, 
  Shield, 
  Sparkles, 
  CheckCircle, 
  FileText, 
  Zap, 
  Info,
  Terminal,
  Trash2,
  ArrowRight,
  Loader2,
  Key,
  Clock,
  AlertTriangle,
  History
} from 'lucide-react';
import { 
  getConfig, 
  testSupabaseConnection, 
  setActiveSupabaseCredentials,
  extractProjectRef 
} from '../services/supabaseClient';
import { MASTER_SUPABASE_SQL_SCHEMA } from '../services/supabaseMasterSchema';
import { 
  getBackupSupabaseConfig, 
  setBackupSupabaseConfig, 
  testBackupConnection, 
  purgeBackupOlderThan7Days, 
  calculate7DayRetentionCutoff, 
  RETENTION_7_DAYS_SQL,
  STORAGE_LAST_PURGE
} from '../services/dualSupabaseService';

interface ParsedPostgresUri {
  username: string;
  host: string;
  port: string;
  dbname: string;
  password?: string;
  projectRef: string;
}

export const parsePostgresConnectionString = (uri: string): ParsedPostgresUri => {
  const clean = (uri || '').trim();
  if (!clean) {
    return { username: '', host: '', port: '5432', dbname: 'postgres', projectRef: '' };
  }

  try {
    const regex = /^(?:postgres(?:ql)?:\/\/)?([^:]+):?([^@]*)@([^:\/]+)(?::(\d+))?(?:\/(.*))?$/;
    const match = clean.match(regex);
    if (match) {
      const username = match[1] || '';
      const rawPass = match[2] || '';
      const password = (rawPass === '[YOUR-PASSWORD]' || rawPass === '%5BYOUR-PASSWORD%5D') ? '' : decodeURIComponent(rawPass);
      const host = match[3] || '';
      const port = match[4] || '5432';
      const dbname = match[5] || 'postgres';
      const projectRef = username.includes('.') ? username.split('.')[1] : (username || 'db');
      return { username, password, host, port, dbname, projectRef };
    }
  } catch (e) {
    console.warn('URI parse error', e);
  }

  const projectRef = clean.includes('.') ? clean.split('.')[1] : clean;
  return { username: clean, host: '', port: '5432', dbname: 'postgres', projectRef };
};

export const SupabaseHotSwapView: React.FC = () => {
  const currentConfig = getConfig();

  // Active Connection State (Read-only status of currently connected instance)
  const [activeUrl, setActiveUrl] = useState(currentConfig.url);
  const [activeKey, setActiveKey] = useState(currentConfig.key);
  const [activeTestStatus, setActiveTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string; count?: number }>({ loading: false });

  // =========================================================================
  // SUPABASE CADANGAN (BACKUP REAL-TIME 7 HARI) STATE
  // =========================================================================
  const backupConfig = useMemo(() => getBackupSupabaseConfig(), []);
  const [backupUrl, setBackupUrl] = useState(backupConfig.url);
  const [backupKey, setBackupKey] = useState(backupConfig.key);
  const [backupTestStatus, setBackupTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string; count?: number; latencyMs?: number }>({ loading: false });
  const [backupSaveSuccess, setBackupSaveSuccess] = useState('');
  
  // 7-day retention state
  const [isPurgingBackup, setIsPurgingBackup] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success?: boolean; message?: string; deletedCount?: number } | null>(null);
  const [copiedRetentionSql, setCopiedRetentionSql] = useState(false);
  const [lastPurgeInfo, setLastPurgeInfo] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LAST_PURGE);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const retentionCutoff = useMemo(() => calculate7DayRetentionCutoff(7), []);

  // Schema Copy State
  const [copiedSchema, setCopiedSchema] = useState(false);

  // =========================================================================
  // CLI FAST MIGRATION (Form Input State - Resets on Page Refresh for Security)
  // =========================================================================
  const [sourceUri, setSourceUri] = useState('');
  const [sourcePass, setSourcePass] = useState('');

  const [targetUri, setTargetUri] = useState('');
  const [targetPass, setTargetPass] = useState('');

  // Parse Connection URIs dynamically
  const sourceParsed = useMemo(() => parsePostgresConnectionString(sourceUri), [sourceUri]);
  const targetParsed = useMemo(() => parsePostgresConnectionString(targetUri), [targetUri]);

  const effectiveSourcePass = sourcePass || sourceParsed.password || '[PASSWORD-DB-SUMBER]';
  const effectiveTargetPass = targetPass || targetParsed.password || sourcePass || '[PASSWORD-DB-TARGET]';

  const sourceHost = sourceParsed.host || 'aws-0-ap-southeast-1.pooler.supabase.com';
  const sourceUser = sourceParsed.username || `postgres.${sourceParsed.projectRef || 'sumber'}`;
  const sourceRef = sourceParsed.projectRef || 'sumber';

  const targetHost = targetParsed.host || 'aws-1-ap-south-1.pooler.supabase.com';
  const targetUser = targetParsed.username || `postgres.${targetParsed.projectRef || 'target'}`;
  const targetRef = targetParsed.projectRef || 'target';

  // Short project ref for friendly backup filename (e.g. nufv_to_iwvb)
  const shortSource = sourceRef.length > 6 ? sourceRef.slice(0, 4) : sourceRef;
  const shortTarget = targetRef.length > 6 ? targetRef.slice(0, 4) : targetRef;
  const backupFileName = `full_backup_${shortSource}_to_${shortTarget}.sql`;

  // Generated Commands
  const dumpCommand = `set PGPASSWORD=${effectiveSourcePass}\npg_dump --no-owner --no-privileges --quote-all-identifiers --host=${sourceHost} --port=5432 --username=${sourceUser} --dbname=postgres --schema=public --file=${backupFileName}`;

  const cleanUpCommand = `set PGPASSWORD=${effectiveTargetPass}\npsql --host=${targetHost} --port=5432 --username=${targetUser} --dbname=postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;

  const restoreCommand = `set PGPASSWORD=${effectiveTargetPass}\npsql --host=${targetHost} --port=5432 --username=${targetUser} --dbname=postgres --file=${backupFileName}`;

  const grantCommand = `set PGPASSWORD=${effectiveTargetPass}\npsql --host=${targetHost} --port=5432 --username=${targetUser} --dbname=postgres -c "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role; NOTIFY pgrst, 'reload schema';"`;

  // =========================================================================
  // HOT-SWAP & REAL-TIME BROADCAST (Form Input State - Resets on Page Refresh)
  // =========================================================================
  const [switchTargetUrl, setSwitchTargetUrl] = useState('');
  const [switchTargetKey, setSwitchTargetKey] = useState('');
  const [broadcastToAll, setBroadcastToAll] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccessMessage, setApplySuccessMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Copy feedback states
  const [copiedCleanCmd, setCopiedCleanCmd] = useState(false);
  const [copiedDumpCmd, setCopiedDumpCmd] = useState(false);
  const [copiedRestoreCmd, setCopiedRestoreCmd] = useState(false);
  const [copiedGrantCmd, setCopiedGrantCmd] = useState(false);

  // Auto-fill target URL if target URI has project ref
  useEffect(() => {
    if (targetParsed.projectRef && !switchTargetUrl) {
      setSwitchTargetUrl(`https://${targetParsed.projectRef}.supabase.co`);
    }
  }, [targetParsed.projectRef]);

  // Initial Test of Active Connection & Backup Connection
  useEffect(() => {
    handleTestActiveConnection();
    handleTestBackupConnection();
  }, []);

  const handleTestActiveConnection = async () => {
    setActiveTestStatus({ loading: true });
    const res = await testSupabaseConnection(activeUrl, activeKey);
    setActiveTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
      count: res.rowCount
    });
  };

  const handleTestBackupConnection = async () => {
    setBackupTestStatus({ loading: true });
    const res = await testBackupConnection(backupUrl, backupKey);
    setBackupTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
      count: res.rowCount,
      latencyMs: res.latencyMs
    });
  };

  const handleSaveBackupConfig = async () => {
    if (!backupUrl.trim() || !backupKey.trim()) {
      alert('URL dan Anon Key Supabase Cadangan tidak boleh kosong.');
      return;
    }
    await setBackupSupabaseConfig(backupUrl, backupKey);
    setBackupSaveSuccess('Konfigurasi Supabase Cadangan berhasil disimpan di VPS & disiarkan ke seluruh perangkat user!');
    setTimeout(() => setBackupSaveSuccess(''), 4000);
    handleTestBackupConnection();
  };

  const handleManualPurgeBackup = async () => {
    if (!window.confirm(`Konfirmasi Pembersihan Data > 7 Hari:\n\nProses ini HANYA akan menghapus data pada SUPABASE CADANGAN yang discan sebelum ${retentionCutoff.cutoffDateStr}.\nData di Supabase VPS TIDAK AKAN DIHAPUS.\n\nLanjutkan pembersihan?`)) {
      return;
    }
    setIsPurgingBackup(true);
    setPurgeResult(null);
    const res = await purgeBackupOlderThan7Days(7);
    setIsPurgingBackup(false);
    setPurgeResult(res);
    try {
      const saved = localStorage.getItem(STORAGE_LAST_PURGE);
      if (saved) setLastPurgeInfo(JSON.parse(saved));
    } catch {}
    handleTestBackupConnection();
  };

  const handlePromoteBackupToPrimary = async () => {
    if (!backupUrl.trim() || !backupKey.trim()) {
      alert('Supabase Cadangan belum dikonfigurasi.');
      return;
    }
    const confirmMsg = `PERINGATAN HOT-SWAP DARURAT:\n\nAnda akan mengalihkan aplikasi untuk membaca & menulis ke SUPABASE CADANGAN (${extractProjectRef(backupUrl)}) sebagai Database Utama.\n\nGunakan ini hanya jika Supabase VPS sedang down/mati listrik.\n\nApakah Anda yakin ingin switch sekarang?`;
    if (!window.confirm(confirmMsg)) return;

    await setActiveSupabaseCredentials(backupUrl, backupKey, false, 'Admin');
    setActiveUrl(backupUrl);
    setActiveKey(backupKey);
    handleTestActiveConnection();
    alert(`Berhasil beralih ke Supabase Cadangan!\nAplikasi sekarang terhubung ke: ${backupUrl}`);
  };

  const handleCopyRetentionSql = () => {
    navigator.clipboard.writeText(RETENTION_7_DAYS_SQL);
    setCopiedRetentionSql(true);
    setTimeout(() => setCopiedRetentionSql(false), 3000);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(MASTER_SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  const handleCopyCleanCmd = () => {
    navigator.clipboard.writeText(cleanUpCommand);
    setCopiedCleanCmd(true);
    setTimeout(() => setCopiedCleanCmd(false), 3000);
  };

  const handleCopyDumpCmd = () => {
    navigator.clipboard.writeText(dumpCommand);
    setCopiedDumpCmd(true);
    setTimeout(() => setCopiedDumpCmd(false), 3000);
  };

  const handleCopyRestoreCmd = () => {
    navigator.clipboard.writeText(restoreCommand);
    setCopiedRestoreCmd(true);
    setTimeout(() => setCopiedRestoreCmd(false), 3000);
  };

  const handleCopyGrantCmd = () => {
    navigator.clipboard.writeText(grantCommand);
    setCopiedGrantCmd(true);
    setTimeout(() => setCopiedGrantCmd(false), 3000);
  };

  // Switch Active Supabase & Broadcast to All Users via Firestore
  const handleApplyNewSupabase = async () => {
    const cleanUrl = switchTargetUrl.trim();
    const cleanKey = switchTargetKey.trim();

    if (!cleanUrl || !cleanKey) {
      alert('URL dan Anon Key Supabase Target belum diisi.');
      return;
    }
    if (!cleanUrl.startsWith('https://')) {
      alert('URL Supabase harus diawali dengan https://');
      return;
    }

    const confirmMsg = `Konfirmasi Hot-Swap Supabase:\n\nDatabase Baru: ${cleanUrl} (${extractProjectRef(cleanUrl)})\nSiarkan ke Semua User: ${broadcastToAll ? 'YA (Real-Time Popup Auto-Reload via Firestore)' : 'TIDAK (Hanya di perangkat ini)'}\n\nApakah Anda yakin ingin menerapkan database ini sekarang?`;
    if (!window.confirm(confirmMsg)) return;

    setIsApplying(true);
    setApplySuccessMessage('');

    try {
      // 1. Test target connection first
      const testRes = await testSupabaseConnection(cleanUrl, cleanKey);
      if (!testRes.success) {
        if (!window.confirm(`Peringatan tes koneksi:\n${testRes.message}\n\nTetap lanjutkan perpindahan?`)) {
          setIsApplying(false);
          return;
        }
      }

      // 2. Set credentials and broadcast via Firestore
      await setActiveSupabaseCredentials(cleanUrl, cleanKey, broadcastToAll, 'Admin Master');

      setApplySuccessMessage(`Database berhasil dialihkan ke ${extractProjectRef(cleanUrl)}! Seluruh pengguna akan otomatis terhubung ke database baru via Firestore.`);
      setActiveUrl(cleanUrl);
      setActiveKey(cleanKey);

      // Re-test active status
      setTimeout(() => {
        handleTestActiveConnection();
      }, 1000);
    } catch (err: any) {
      alert('Gagal menerapkan Supabase baru: ' + (err?.message || err));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-semibold text-blue-200">
              <Zap size={14} className="text-yellow-400 animate-pulse" />
              Hot-Swap Database & Real-Time Sync
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Manajemen & Hot-Swap Supabase
            </h1>
            <p className="text-sm text-blue-200/80 max-w-2xl">
              Ganti instance Supabase tanpa edit file <code>.env</code> dan tanpa redeploy Vercel. Paste Connection String URI untuk generate perintah <code>pg_dump / psql</code> kilat dan broadcast realtime ke semua user via Firestore.
            </p>
          </div>

          {/* Dual Database Status Badges */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Primary VPS Badge */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[240px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200">1. Database Utama (VPS)</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeTestStatus.success ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                  <span className="text-xs font-bold text-emerald-300">
                    {activeTestStatus.success ? 'ONLINE' : 'CONNECTING'}
                  </span>
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-white truncate">
                {extractProjectRef(activeUrl)}
              </div>
              <div className="text-[11px] text-blue-200/70 truncate mt-0.5">
                {activeUrl.includes('trycloudflare') ? `${activeUrl} (Tunnel)` : activeUrl}
              </div>
              {activeTestStatus.count !== undefined && (
                <div className="text-[11px] font-bold text-emerald-300 mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span>Data Scan VPS:</span>
                  <span className="font-mono text-xs">{activeTestStatus.count.toLocaleString()} rows</span>
                </div>
              )}
            </div>

            {/* Secondary Backup Badge */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[240px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-200">2. Supabase Cadangan</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${backupTestStatus.success ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  <span className="text-xs font-bold text-amber-300">
                    {backupTestStatus.success ? 'STANDBY (7 HARI)' : 'CHECKING'}
                  </span>
                </div>
              </div>
              <div className="text-sm font-mono font-bold text-white truncate">
                {extractProjectRef(backupUrl)}
              </div>
              <div className="text-[11px] text-amber-200/70 truncate mt-0.5">
                Dual-Write Real-Time (Bg)
              </div>
              {backupTestStatus.count !== undefined && (
                <div className="text-[11px] font-bold text-amber-300 mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span>Data Cadangan:</span>
                  <span className="font-mono text-xs">{backupTestStatus.count.toLocaleString()} rows</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION: SUPABASE CADANGAN (DUAL-WRITE REAL-TIME & RETENSI 7 HARI)
          ========================================================================= */}
      <div className="bg-gradient-to-br from-white to-blue-50/40 dark:from-gray-800 dark:to-gray-900 rounded-3xl border-2 border-blue-200/80 dark:border-blue-900/60 p-6 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-100 dark:border-gray-700/60 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Supabase Cadangan (Dual-Write Real-Time)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Retensi 7 Hari Aktif
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Setiap scan barcode disalin otomatis ke database cadangan ini di latar belakang tanpa mengurangi kecepatan scanner gudang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestBackupConnection}
              disabled={backupTestStatus.loading}
              className="px-3.5 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition-all flex items-center gap-2 shadow-2xs active:scale-95 cursor-pointer"
            >
              {backupTestStatus.loading ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <RefreshCw size={14} className="text-blue-600" />}
              Tes Koneksi Cadangan
            </button>
            <button
              onClick={handlePromoteBackupToPrimary}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              title="Gunakan database cadangan sebagai database utama jika VPS mati"
            >
              <Zap size={14} />
              Hot-Swap ke Cadangan
            </button>
          </div>
        </div>

        {/* 2-Column Content: Left = Credentials Config, Right = 7-Day Retention Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Input URL & Anon Key Cadangan */}
          <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-200/90 dark:border-gray-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Database size={15} className="text-blue-600" /> Kredensial Supabase Cadangan
              </span>
              {backupUrl && (
                <a
                  href={`https://supabase.com/dashboard/project/${extractProjectRef(backupUrl)}/settings/api`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  Buka Dashboard Supabase <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                URL Supabase Cadangan
              </label>
              <input
                type="text"
                value={backupUrl}
                onChange={(e) => setBackupUrl(e.target.value)}
                placeholder="https://abcdefghijk.supabase.co"
                className="w-full px-3.5 py-2.5 mt-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Anon Key Supabase Cadangan
              </label>
              <textarea
                value={backupKey}
                onChange={(e) => setBackupKey(e.target.value)}
                placeholder="Paste Anon Public Key Supabase Cadangan..."
                rows={3}
                className="w-full px-3.5 py-2 mt-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {backupTestStatus.message && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                backupTestStatus.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}>
                {backupTestStatus.success ? <CheckCircle size={16} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={16} className="shrink-0 text-rose-600" />}
                <div className="flex-1">
                  <span>{backupTestStatus.message}</span>
                  {backupTestStatus.count !== undefined && (
                    <div className="text-[11px] font-mono opacity-80 mt-0.5">
                      Data tersimpan di cadangan saat ini: <b>{backupTestStatus.count.toLocaleString()} baris</b>
                    </div>
                  )}
                </div>
              </div>
            )}

            {backupSaveSuccess && (
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <Check size={16} className="text-emerald-600 shrink-0" />
                {backupSaveSuccess}
              </div>
            )}

            <button
              onClick={handleSaveBackupConfig}
              disabled={isSavingBackup}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingBackup ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {isSavingBackup ? 'Menyimpan & Menyiarkan ke Server VPS...' : 'Simpan Konfigurasi Supabase Cadangan'}
            </button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              📡 <b>Tersimpan di Server VPS:</b> Kredensial disimpan ke tabel <code>app_settings</code> Supabase VPS dan <b>otomatis disiarkan secara real-time</b> ke seluruh HP/scanner staf tanpa perlu ditebak atau disetel manual.
            </p>
          </div>

          {/* Right: 7-Day Retention Policy & Manual Purge */}
          <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-200/90 dark:border-gray-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={15} className="text-indigo-600" /> Kebijakan Retensi 7 Hari Otomatis
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                  Hemat Kuota
                </span>
              </div>

              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-xl space-y-2">
                <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  Database cadangan hanya menampung data operasional <b>7 hari terakhir</b> agar kuota tidak jebol. Data yang discan sebelum:
                </div>
                <div className="flex items-center gap-2 font-mono font-bold text-sm text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span>📅 Cutoff: {retentionCutoff.cutoffDateStr} (00:00:00)</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  ⚠️ <b>Penting:</b> Penghapusan ini <b>HANYA</b> berlaku pada Supabase Cadangan. Seluruh data di <b>Supabase VPS tetap utuh 100% selamanya</b>.
                </div>
              </div>

              {/* Status Pembersihan Terakhir */}
              {lastPurgeInfo && (
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Terakhir Dibersihkan:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{lastPurgeInfo.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Baris Terhapus:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{lastPurgeInfo.totalDeleted?.toLocaleString() || 0} baris</span>
                  </div>
                </div>
              )}

              {purgeResult && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  purgeResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {purgeResult.message}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleManualPurgeBackup}
                disabled={isPurgingBackup}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPurgingBackup ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Bersihkan Data Cadangan &gt; 7 Hari Sekarang
              </button>

              <button
                onClick={handleCopyRetentionSql}
                className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedRetentionSql ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedRetentionSql ? 'Tersalin!' : 'Copy Script SQL Trigger Retensi (Opsional di Supabase SQL Editor)'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main 2-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* SECTION 1: Generator Perintah CLI (pg_dump & psql) */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                <Terminal size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Migrasi Kilat via CLI (CMD)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Paste Connection URI &amp; Password untuk generate otomatis</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              15 Detik ⚡
            </span>
          </div>

          {/* Form Input: DB Sumber & DB Target */}
          <div className="space-y-4">
            
            {/* DB Sumber */}
            <div className="p-4 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-800/40 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-700 dark:text-orange-400">
                <Server size={14} /> 🟠 Database Sumber (Lama)
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Paste Connection String URI (Sumber)</label>
                <input
                  type="text"
                  value={sourceUri}
                  onChange={(e) => setSourceUri(e.target.value)}
                  placeholder="postgresql://postgres:[YOUR-PASSWORD]@103.52.114.209:5432/postgres"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">DB Password (Sumber)</label>
                <input
                  type="text"
                  value={sourcePass}
                  onChange={(e) => setSourcePass(e.target.value)}
                  placeholder="Contoh: @#Akal123AKAL"
                  className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* DB Target */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <Server size={14} /> 🟢 Database Target (Baru)
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Paste Connection String URI (Target Baru)</label>
                <input
                  type="text"
                  value={targetUri}
                  onChange={(e) => setTargetUri(e.target.value)}
                  placeholder="postgresql://postgres.iwvbrigjydmhbwbnbbbk:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">DB Password (Target)</label>
                <input
                  type="text"
                  value={targetPass}
                  onChange={(e) => setTargetPass(e.target.value)}
                  placeholder="Contoh: @#Akal123AKAL"
                  className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

          </div>

          {/* Generated CMD Commands with Copy Buttons */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Perintah Command Prompt (CMD) yang Dihasilkan:
            </h4>

            {/* Command 1: Clean Up */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1.5">
                  <Trash2 size={13} /> 1. Clean Up / Reset Schema DB Target:
                </span>
                <button
                  onClick={handleCopyCleanCmd}
                  className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold"
                >
                  {copiedCleanCmd ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedCleanCmd ? 'Tersalin!' : 'Salin Perintah'}
                </button>
              </div>
              <pre className="p-3 bg-gray-950 text-rose-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-gray-800 select-all whitespace-pre-wrap">
                {cleanUpCommand}
              </pre>
            </div>

            {/* Command 2: Backup */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span>2. Backup dari DB Lama (pg_dump):</span>
                <button
                  onClick={handleCopyDumpCmd}
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-bold"
                >
                  {copiedDumpCmd ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedDumpCmd ? 'Tersalin!' : 'Salin Perintah'}
                </button>
              </div>
              <pre className="p-3 bg-gray-950 text-amber-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-gray-800 select-all whitespace-pre-wrap">
                {dumpCommand}
              </pre>
            </div>

            {/* Command 3: Restore */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>3. Restore ke DB Baru (psql):</span>
                <button
                  onClick={handleCopyRestoreCmd}
                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  {copiedRestoreCmd ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedRestoreCmd ? 'Tersalin!' : 'Salin Perintah'}
                </button>
              </div>
              <pre className="p-3 bg-gray-950 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-gray-800 select-all whitespace-pre-wrap">
                {restoreCommand}
              </pre>
            </div>

            {/* Command 4: Grant Permissions & Reload Schema */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                <span>4. Izin Akses &amp; Reload PostgREST (Solusi jika 401 / Permission Denied):</span>
                <button
                  onClick={handleCopyGrantCmd}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  {copiedGrantCmd ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  {copiedGrantCmd ? 'Tersalin!' : 'Salin Perintah'}
                </button>
              </div>
              <pre className="p-3 bg-gray-950 text-indigo-300 rounded-xl font-mono text-[11px] overflow-x-auto border border-gray-800 select-all whitespace-pre-wrap">
                {grantCommand}
              </pre>
            </div>
          </div>

          <div className="p-3 bg-gray-100 dark:bg-gray-900/70 rounded-2xl text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Info size={15} className="shrink-0 text-blue-500" />
            <span>Form input di atas bersifat sementara &amp; akan otomatis bersih setiap website di-refresh demi keamanan.</span>
          </div>
        </div>

        {/* SECTION 2: Hot-Swap & Siaran Live ke Semua User via Firestore */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border-2 border-emerald-500/40 dark:border-emerald-500/30 p-6 sm:p-7 shadow-lg flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                  <Zap size={22} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hot-Swap &amp; Siaran Live (Firestore)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pindahkan semua user seketika tanpa redeploy</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Real-Time 🚀
              </span>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Setelah restore selesai di CMD, masukkan URL &amp; Anon Key Supabase Baru di bawah, lalu klik tombol terapkan. Seluruh HP/Laptop karyawan yang sedang aktif akan otomatis memunculkan pop-up countdown 5 detik dan beralih ke database baru!
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Target Supabase URL (Baru)
                </label>
                <input
                  type="text"
                  value={switchTargetUrl}
                  onChange={(e) => setSwitchTargetUrl(e.target.value)}
                  placeholder="https://iwvbrigjydmhbwbnbbbk.supabase.co"
                  className="w-full px-3.5 py-2.5 mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Target Supabase Anon Key (Baru)
                  </label>
                  {switchTargetUrl && (
                    <a
                      href={`https://supabase.com/dashboard/project/${extractProjectRef(switchTargetUrl)}/settings/api`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      Buka API Keys Supabase <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <textarea
                  value={switchTargetKey}
                  onChange={(e) => setSwitchTargetKey(e.target.value)}
                  placeholder="Paste Anon Public Key dari Dashboard Supabase Target..."
                  rows={3}
                  className="w-full px-3.5 py-2 mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-[11px] font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!switchTargetUrl || !switchTargetKey) {
                      alert('Masukkan URL dan Anon Key terlebih dahulu.');
                      return;
                    }
                    const res = await testSupabaseConnection(switchTargetUrl, switchTargetKey);
                    setTestResult(res);
                  }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> Tes Koneksi Target
                </button>
                {testResult && (
                  <span className={`text-[11px] font-bold ${testResult.success ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>

              <label className="flex items-center gap-2.5 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastToAll}
                  onChange={(e) => setBroadcastToAll(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  Siarkan Real-Time ke Seluruh Perangkat User (via Firestore)
                </div>
              </label>

              {applySuccessMessage && (
                <div className="p-3.5 bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-2xl text-xs text-emerald-900 dark:text-emerald-100 font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  {applySuccessMessage}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleApplyNewSupabase}
            disabled={isApplying || !switchTargetUrl.trim() || !switchTargetKey.trim()}
            className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-50"
          >
            {isApplying ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
            🚀 Terapkan &amp; Siarkan Database Baru
          </button>
        </div>

      </div>

      {/* Supporting Cards: Master SQL Schema & Google Auth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Master SQL Schema */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Master SQL Schema (1-Klik)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Opsional jika ingin inisialisasi tabel baru manual</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Membuat seluruh 18 tabel lengkap dengan indeks pencarian tercepat dan hak akses public secara otomatis.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleCopySchema}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-[0.98]"
            >
              {copiedSchema ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
              {copiedSchema ? 'Tersalin!' : 'Copy Master SQL Schema'}
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
            >
              Supabase <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Google OAuth Guide */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Google OAuth (Tanpa Edit Google Console)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Gunakan ID Token langsung</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Cukup buka Supabase Baru &gt; <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Google</strong> &gt; Enable dan paste <strong>Client ID Google</strong> lama Anda. Selesai!
            </p>
          </div>

          <div className="p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Shield size={14} className="text-emerald-500 shrink-0" />
            <span>Tidak perlu ubah Authorized Redirect URI di Google Cloud Console.</span>
          </div>
        </div>

      </div>
    </div>
  );
};
