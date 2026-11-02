const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const prefix = `<div className="flex items-center gap-1.5">\n{scanEkstra.length > 0 && (\n<button \nonClick={async () => {\nif (!window.confirm(\`Yakin ingin menghapus \${scanEkstra.length} resi ekstra (TIDAK ADA DI ADMIN) dari Data \${auditRoleFilter} di database?\`)) return;\nsetIsLoadingAuditData(true);\ntry {\nconst rolesToDelete = auditRoleFilter === 'PICKER' ? ['PICKER', 'PICKER_2', 'OJOL'] : [auditRoleFilter];\nconst { error } = await supabase.from('scanned_items').delete().in('barcode', scanEkstra).in('role', rolesToDelete);\nif (error) throw error;\nsetSuccessToast(\`Berhasil menghapus \${scanEkstra.length} resi ekstra dari Data \${auditRoleFilter}.\`);\nawait fetchAuditData();\n} catch (err) {\nalert("Gagal menghapus: " + err.message);\n} finally {\nsetIsLoadingAuditData(false);\n}\n}}\nclassName="text-xs flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-bold transition-colors"\ntitle="Hapus semua resi ekstra yang tidak ada di Admin"\n>\n<Trash2 size={12}/> Hapus Ekstra ({scanEkstra.length})\n</button>\n)}\n`;

const idx = content.indexOf('<div className="flex items-center gap-1.5">');
if (idx !== -1) {
    console.log('Found prefix at index: ' + idx);
    let newContent = content.substring(0, idx); // remove prefix
    let remainder = content.substring(idx + prefix.length);
    
    // Find the endIdx
    let endIdx = remainder.indexOf('</button></div>');
    if (endIdx !== -1) {
        console.log('Found suffix at endIdx: ' + endIdx);
        newContent += remainder.substring(0, endIdx) + '</button>' + remainder.substring(endIdx + '</button></div>'.length);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('REPAIRED SUCCESSFULLY');
    } else {
        console.log('Suffix </button></div> not found, looking for alternative...');
        endIdx = remainder.lastIndexOf('</div>');
        if (endIdx !== -1) {
            console.log('Removing last </div>');
            newContent += remainder.substring(0, endIdx) + remainder.substring(endIdx + 6);
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('REPAIRED WITH ALT SUFFIX');
        }
    }
} else {
    console.log('Prefix not found!');
}
