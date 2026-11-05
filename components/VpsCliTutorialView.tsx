import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Server,
  Database,
  Shield,
  Key,
  Globe,
  ExternalLink,
  Code2,
  FileCode,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Cpu
} from 'lucide-react';

export const VpsCliTutorialView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PSQL' | 'SSH' | 'MERGE' | 'QUICK_QUERY' | 'WEB_STUDIO'>('PSQL');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  const CodeBlock: React.FC<{ code: string; language?: string; id: string; label?: string }> = ({ code, language = 'bash', id, label }) => {
    const isCopied = copiedIndex === id;
    return (
      <div className="relative group my-2.5 rounded-xl overflow-hidden border border-gray-800 bg-slate-950 shadow-md">
        {label && (
          <div className="px-4 py-2 bg-slate-900 border-b border-gray-800/80 flex items-center justify-between text-xs text-gray-400 font-mono font-semibold">
            <span>{label}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">{language}</span>
          </div>
        )}
        <div className="p-4 overflow-x-auto text-xs sm:text-sm font-mono text-emerald-400 leading-relaxed select-all">
          <pre>{code}</pre>
        </div>
        <button
          onClick={() => handleCopy(code, id)}
          className="absolute top-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-gray-800/90 hover:bg-emerald-600 text-gray-300 hover:text-white transition-all text-xs font-sans font-bold flex items-center gap-1.5 shadow-sm cursor-pointer opacity-90 group-hover:opacity-100"
          title="Salin Perintah"
        >
          {isCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
          <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full min-h-full bg-slate-50 dark:bg-gray-900 flex flex-col overflow-y-auto">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-gray-800 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
              <Terminal size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Panduan & Tutorial CLI Supabase VPS
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  VPS ONLINE
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 mt-1">
                Panduan interaktif koneksi ke database & server VPS Kalindo melalui Windows CMD, PowerShell, SSH, dan manajemen data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-slate-800/80 px-3 py-2 rounded-xl border border-gray-700/60 shrink-0">
            <Server size={14} className="text-indigo-400" />
            <span className="text-gray-300">Host:</span>
            <span className="text-emerald-400 font-bold select-all">103.52.114.209</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Quick Credentials Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1.5">
              <span>Host & Port Database</span>
              <Database size={16} className="text-indigo-500" />
            </div>
            <div className="font-mono font-bold text-sm text-gray-900 dark:text-white select-all">
              103.52.114.209:5432
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Port Pooler / Supavisor Direct</div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1.5">
              <span>Database User (Tenant)</span>
              <Shield size={16} className="text-emerald-500" />
            </div>
            <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 select-all">
              postgres.your-tenant-id
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Format: <code>user.tenant_id</code></div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1.5">
              <span>Nama Database Aktif</span>
              <HardDrive size={16} className="text-blue-500" />
            </div>
            <div className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 select-all">
              postgres
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Sandbox: <code>temp_restore</code></div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium mb-1.5">
              <span>Web Studio Dashboard</span>
              <Globe size={16} className="text-purple-500" />
            </div>
            <div className="font-mono font-bold text-sm text-purple-600 dark:text-purple-400 select-all">
              :8000 / :3000
            </div>
            <div className="text-[11px] text-gray-400 mt-1">User: <code>supabase</code></div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('PSQL')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PSQL'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Terminal size={16} />
            1. Login via CMD / PowerShell (psql)
          </button>

          <button
            onClick={() => setActiveTab('SSH')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'SSH'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Server size={16} />
            2. Remote SSH ke Server VPS
          </button>

          <button
            onClick={() => setActiveTab('MERGE')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'MERGE'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <RefreshCw size={16} />
            3. Restore & Auto-Merge Backup
          </button>

          <button
            onClick={() => setActiveTab('QUICK_QUERY')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'QUICK_QUERY'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Code2 size={16} />
            4. Query Kilat (One-Liner)
          </button>

          <button
            onClick={() => setActiveTab('WEB_STUDIO')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'WEB_STUDIO'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Globe size={16} />
            5. Web Studio Dashboard
          </button>
        </div>

        {/* Tab 1: PSQL */}
        {activeTab === 'PSQL' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Terminal className="text-indigo-600 dark:text-indigo-400" size={20} />
                Koneksi Interaktif ke Database PostgreSQL via CMD / PowerShell
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Gunakan perintah ini untuk masuk langsung ke prompt database PostgreSQL (psql) dari laptop Windows Anda tanpa perlu SSH ke server.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Pilihan A: Jalankan di Command Prompt (CMD) Windows
                </div>
                <CodeBlock
                  id="cmd_psql_login"
                  label="Command Prompt (CMD)"
                  language="cmd"
                  code={`set PGPASSWORD=your-super-secret-and-long-postgres-password
psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Pilihan B: Jalankan di Windows PowerShell
                </div>
                <CodeBlock
                  id="ps_psql_login"
                  label="Windows PowerShell"
                  language="powershell"
                  code={`$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"
psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres`}
                />
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <Info size={18} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Tips Navigasi psql:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                    <li>Ketik <code className="font-bold">\q</code> lalu tekan <strong>Enter</strong> untuk keluar dari psql kembali ke CMD/PowerShell.</li>
                    <li>Ketik <code className="font-bold">\dt</code> untuk melihat seluruh daftar tabel.</li>
                    <li>Ketik <code className="font-bold">\d nama_tabel</code> untuk melihat struktur kolom dari tabel tertentu.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SSH */}
        {activeTab === 'SSH' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Server className="text-indigo-600 dark:text-indigo-400" size={20} />
                Remote Terminal SSH ke Server VPS (Ubuntu Linux)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Gunakan SSH untuk mengakses terminal Linux VPS secara langsung menggunakan SSH Key yang tersimpan di laptop Anda.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  1. Login ke VPS via SSH dari Laptop Windows:
                </div>
                <CodeBlock
                  id="ssh_login"
                  label="Windows CMD / PowerShell"
                  language="bash"
                  code={`ssh -i C:\\Users\\jgilb\\.ssh\\id_kalindo kalindo@103.52.114.209`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  2. Cek Status Semua Kontainer Supabase di dalam VPS:
                </div>
                <CodeBlock
                  id="docker_status"
                  label="Jalankan di Terminal VPS (kalindo@kalindo-backend)"
                  language="bash"
                  code={`sudo docker ps`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  3. Masuk ke Konsol Database Postgres dari dalam Docker VPS:
                </div>
                <CodeBlock
                  id="docker_psql"
                  label="Jalankan di Terminal VPS"
                  language="bash"
                  code={`sudo docker exec -it supabase-db psql -U postgres -d postgres`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  4. Restart Layanan Supabase (jika diperlukan):
                </div>
                <CodeBlock
                  id="docker_restart"
                  label="Jalankan di Terminal VPS"
                  language="bash"
                  code={`cd /opt/supabase/docker && sudo docker compose restart`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: MERGE */}
        {activeTab === 'MERGE' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="text-indigo-600 dark:text-indigo-400" size={20} />
                Tutorial Restore & Auto-Merge Backup SQL (Auto-Skip Duplikat)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Metode 2 langkah yang 100% aman untuk mengimpor file dump SQL tanpa menghapus data scan yang sudah ada di database aktif.
              </p>
            </div>

            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div>
                <span className="font-bold">PERINGATAN PENTING:</span>
                <p className="mt-1 leading-relaxed">
                  Jangan pernah me-restore file dump langsung dengan opsi <code className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded text-rose-900 dark:text-rose-200">-d postgres</code>! File backup memiliki perintah <code>DROP TABLE</code> yang akan menghapus data scan aktif Anda. Selalu gunakan database staging <code>temp_restore</code> terlebih dahulu seperti panduan di bawah.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Langkah 1: Restore File SQL ke Database Sandbox (temp_restore) via CMD Laptop:
                </div>
                <CodeBlock
                  id="merge_step_1"
                  label="Command Prompt (CMD) di Laptop Anda"
                  language="cmd"
                  code={`set PGPASSWORD=your-super-secret-and-long-postgres-password
psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d temp_restore -f "C:\\Users\\jgilb\\full_backup_wgmv_to_palz.sql"`}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 italic">
                  *Ganti nama file .sql sesuai dengan file backup yang ingin Anda masukkan.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Langkah 2: Jalankan Script Auto-Merge di VPS (Menyaring & Memasukkan Hanya Data Baru):
                </div>
                <CodeBlock
                  id="merge_step_2"
                  label="Windows CMD / PowerShell"
                  language="powershell"
                  code={`ssh -i C:\\Users\\jgilb\\.ssh\\id_kalindo kalindo@103.52.114.209 "python3 /opt/supabase/merge_import.py"`}
                />
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  Tips Sekali Enter Langsung Beres:
                </div>
                <p className="mb-2">Gabungkan langkah 1 dan 2 menjadi satu baris perintah di CMD dengan tanda <code>&&</code>:</p>
                <CodeBlock
                  id="merge_one_liner"
                  label="CMD One-Liner (Otomatis)"
                  language="cmd"
                  code={`set PGPASSWORD=your-super-secret-and-long-postgres-password
psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d temp_restore -f "C:\\Users\\jgilb\\nama_file.sql" && ssh -i C:\\Users\\jgilb\\.ssh\\id_kalindo kalindo@103.52.114.209 "python3 /opt/supabase/merge_import.py"`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: QUICK QUERY */}
        {activeTab === 'QUICK_QUERY' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Code2 className="text-indigo-600 dark:text-indigo-400" size={20} />
                Kumpulan Perintah Query Kilat (Langsung dari CMD / PowerShell)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Jalankan perintah SQL tanpa masuk ke prompt psql secara interaktif. Sangat praktis untuk audit cepat.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  1. Cek Total Data di Tabel scanned_items:
                </div>
                <CodeBlock
                  id="query_count"
                  label="PowerShell"
                  language="powershell"
                  code={`$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"; psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres -c "SELECT count(*) FROM scanned_items;"`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  2. Lihat 5 Baris Data Scan Paling Baru:
                </div>
                <CodeBlock
                  id="query_recent"
                  label="PowerShell"
                  language="powershell"
                  code={`$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"; psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres -c "SELECT barcode, role, employee_name, scan_date FROM scanned_items ORDER BY created_at DESC LIMIT 5;"`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  3. Cek Ukuran File Database di Disk:
                </div>
                <CodeBlock
                  id="query_db_size"
                  label="PowerShell"
                  language="powershell"
                  code={`$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"; psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres -c "SELECT pg_size_pretty(pg_database_size('postgres')) AS total_db_size;"`}
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  4. Cari Data Resi Tertentu:
                </div>
                <CodeBlock
                  id="query_search_barcode"
                  label="PowerShell"
                  language="powershell"
                  code={`$env:PGPASSWORD = "your-super-secret-and-long-postgres-password"; psql -h 103.52.114.209 -p 5432 -U postgres.your-tenant-id -d postgres -c "SELECT barcode, role, employee_name, scan_date, status FROM scanned_items WHERE barcode = 'SPXID064207943954';"`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: WEB STUDIO */}
        {activeTab === 'WEB_STUDIO' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-xs space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
                Akses Web Dashboard Supabase Studio (Visual UI)
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Akses antarmuka grafis resmi Supabase untuk mengelola Table Editor, SQL Editor, Autentikasi, dan Storage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 mb-2">
                    Metode A (Standar Port 8000)
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Melalui Envoy Gateway (Basic Auth)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Akan muncul pop-up login (*Sign in*) bawaan browser saat pertama kali dibuka.
                  </p>
                  <div className="space-y-1.5 text-xs font-mono bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div><strong>URL:</strong> <span className="text-indigo-600 dark:text-indigo-400 select-all">http://103.52.114.209:8000</span></div>
                    <div><strong>Username:</strong> <span className="text-emerald-600 dark:text-emerald-400 select-all">supabase</span></div>
                    <div><strong>Password:</strong> <span className="text-rose-600 dark:text-rose-400 select-all">this_password_is_insecure_and_should_be_updated</span></div>
                  </div>
                </div>
                <a
                  href="http://103.52.114.209:8000"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink size={14} />
                  Buka Port 8000 di Tab Baru
                </a>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700/60 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 mb-2">
                    Metode B (Langsung Port 3000)
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Bypass Pop-up Basic Auth</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Langsung membuka Dashboard Supabase Studio tanpa pop-up login Basic Auth.
                  </p>
                  <div className="space-y-1.5 text-xs font-mono bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div><strong>URL:</strong> <span className="text-purple-600 dark:text-purple-400 select-all">http://103.52.114.209:3000</span></div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Langsung masuk ke Dashboard project/default</div>
                  </div>
                </div>
                <a
                  href="http://103.52.114.209:3000"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink size={14} />
                  Buka Port 3000 di Tab Baru
                </a>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                Catatan Penting saat Membuka Web Studio:
              </div>
              <p className="leading-relaxed">
                Jika di layar konsol browser muncul tulisan merah <code>SyntaxError: Invalid regular expression... Unmatched &apos;)&apos;</code>, hal tersebut disebabkan oleh <strong>fitur terjemahan otomatis (Google Translate) di Chrome</strong> yang memodifikasi string regex Next.js.
                <br /><br />
                <strong>Solusi:</strong> Buka dalam <strong>Mode Incognito / Private Window (Ctrl + Shift + N)</strong> dan pastikan Google Translate <strong>DIMATIKAN</strong> (pilih <em>&ldquo;Never translate this site&rdquo;</em>).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
