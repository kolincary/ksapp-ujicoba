const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let foundIdx = -1;
for(let i=10890; i<10920; i++) {
    if (lines[i] && lines[i].includes('<Copy size={12}/> Salin ({showOnlyExtraPicker ? scanEkstra.length : roleResi.size})')) {
        let buttonOpenIdx = i;
        while(buttonOpenIdx > i - 20) {
            if(lines[buttonOpenIdx].includes('<button')) {
                break;
            }
            buttonOpenIdx--;
        }
        
        if(lines[buttonOpenIdx].includes('<button')) {
            foundIdx = buttonOpenIdx;
            break;
        }
    }
}

if(foundIdx !== -1) {
    console.log('Found button opening at line ' + (foundIdx + 1));
    let buttonEndIdx = foundIdx;
    while(buttonEndIdx < foundIdx + 20) {
        if (lines[buttonEndIdx].includes('</button>')) {
            break;
        }
        buttonEndIdx++;
    }
    
    if (lines[buttonEndIdx].includes('</button>')) {
        console.log('Found button closing at line ' + (buttonEndIdx + 1));
        lines.splice(foundIdx, 0, 
        '                                                       <div className="flex items-center gap-1.5">',
        '                                                          {scanEkstra.length > 0 && (',
        '                                                             <button ',
        '                                                                onClick={async () => {',
        '                                                                   if (!window.confirm(`Yakin ingin menghapus ${scanEkstra.length} resi ekstra (TIDAK ADA DI ADMIN) dari Data ${auditRoleFilter} di database?`)) return;',
        '                                                                   setIsLoadingAuditData(true);',
        '                                                                   try {',
        '                                                                      const rolesToDelete = auditRoleFilter === \'PICKER\' ? [\'PICKER\', \'PICKER_2\', \'OJOL\'] : [auditRoleFilter];',
        '                                                                      const { error } = await supabase',
        '                                                                         .from(\'scanned_items\')',
        '                                                                         .delete()',
        '                                                                         .in(\'barcode\', scanEkstra)',
        '                                                                         .in(\'role\', rolesToDelete);',
        '                                                                      if (error) throw error;',
        '                                                                      setSuccessToast(`Berhasil menghapus ${scanEkstra.length} resi ekstra dari Data ${auditRoleFilter}.`);',
        '                                                                      await fetchAuditData();',
        '                                                                   } catch (err) {',
        '                                                                      alert(\'Gagal menghapus: \' + err.message);',
        '                                                                   } finally {',
        '                                                                      setIsLoadingAuditData(false);',
        '                                                                   }',
        '                                                                }}',
        '                                                                className="text-xs flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-bold transition-colors"',
        '                                                                title="Hapus semua resi ekstra yang tidak ada di Admin"',
        '                                                             >',
        '                                                                <Trash2 size={12}/> Hapus Ekstra ({scanEkstra.length})',
        '                                                             </button>',
        '                                                          )}'
        );
        
        buttonEndIdx += 28;
        lines.splice(buttonEndIdx + 1, 0, '                                                       </div>');
        
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log('Successfully injected button! (Line array method)');
    }
} else {
    console.log('Failed to find button line.');
}
