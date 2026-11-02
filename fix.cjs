const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const regex = /<button[\s\S]*?onClick=\{\(\) => \{[\s\S]*?const listToCopy = showOnlyExtraPicker \? scanEkstra : Array\.from\(roleResi\);[\s\S]*?navigator\.clipboard\.writeText\(listToCopy\.join\('\\n'\)\);[\s\S]*?setSuccessToast\(`Tersalin \$\{listToCopy\.length\} data \$\{auditRoleFilter\}!`\);[\s\S]*?\}\}[\s\S]*?className="text-xs flex items-center gap-1 bg-white border border-purple-300 px-2 py-1 rounded hover:bg-purple-50 text-purple-700 font-bold transition-colors"[\s\S]*?>[\s\S]*?<Copy size=\{12\}\/> Salin \(\{showOnlyExtraPicker \? scanEkstra\.length : roleResi\.size\}\)[\s\S]*?<\/button>/g;

const replacement = `<div className="flex items-center gap-1.5">
{scanEkstra.length > 0 && (
<button 
onClick={async () => {
if (!window.confirm(\`Yakin ingin menghapus \${scanEkstra.length} resi ekstra (TIDAK ADA DI ADMIN) dari Data \${auditRoleFilter} di database?\`)) return;
setIsLoadingAuditData(true);
try {
const rolesToDelete = auditRoleFilter === 'PICKER' ? ['PICKER', 'PICKER_2', 'OJOL'] : [auditRoleFilter];
const { error } = await supabase.from('scanned_items').delete().in('barcode', scanEkstra).in('role', rolesToDelete);
if (error) throw error;
setSuccessToast(\`Berhasil menghapus \${scanEkstra.length} resi ekstra dari Data \${auditRoleFilter}.\`);
await fetchAuditData();
} catch (err) {
alert("Gagal menghapus: " + err.message);
} finally {
setIsLoadingAuditData(false);
}
}}
className="text-xs flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-bold transition-colors"
title="Hapus semua resi ekstra yang tidak ada di Admin"
>
<Trash2 size={12}/> Hapus Ekstra ({scanEkstra.length})
</button>
)}
$&</div>`;

if (content.includes('Hapus Ekstra')) {
    console.log('Already added Hapus Ekstra');
    process.exit(0);
}

const matches = content.match(regex);
if (matches) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('REPLACED');
} else {
  console.log('NOT FOUND');
}
