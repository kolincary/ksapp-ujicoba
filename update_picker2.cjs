const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/scan kalindo sortir update/components/AdminDashboard.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const newLines = [];
for (let i = 0; i < lines.length; i++) {
    // Check if the current line is the start of the ternary we want to remove
    if (lines[i].includes("{activeView === 'PICKER_DATA' ? (")) {
        // We found the ternary! Skip the next 7 lines (the whole ternary block)
        // and replace it with just the normal options.
        newLines.push('                                             <option value="ALL">All Shifts</option>');
        newLines.push('                                             {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}');
        i += 7; // Skip the ternary lines
    } else {
        newLines.push(lines[i]);
    }
}

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Fixed picker dropdown successfully');
