const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
let found = false;
for(let i=10890; i<10920; i++) {
    if(lines[i] && lines[i].includes('{scanEkstra.length > 0 && (')) {
        // Skip if already contains devmodenew
        if(lines[i].includes('devmodenew')) {
            console.log('Condition already updated!');
            found = true;
            break;
        }
        lines[i] = lines[i].replace('{scanEkstra.length > 0 && (', '{scanEkstra.length > 0 && (showFsSyncDevMode || batchSearch.toLowerCase().includes(\'devmodenew\')) && (');
        found = true;
        break;
    }
}
if(found) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Successfully updated condition! (Line method)');
} else {
    console.log('Target not found anywhere.');
}
