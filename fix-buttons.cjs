const fs = require('fs');
let data = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Replace BATCH_DATA_2 buttons
const buttonsRegex = /<button\s*onClick=\{\(\) => setIsImportCancelModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsExcelImportModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsBatchImportModalOpen\(true\)\}[\s\S]*?<\/button>/;
const match = data.match(buttonsRegex);

if (match && match.index > 13000) { // ensure it's BATCH_DATA_2 (around line 13050+)
  const newButtons = `{currentAdmin?.username !== 'Tamu' && (<>\n${match[0]}\n</>)}`;
  data = data.replace(match[0], newButtons);
  console.log('Replaced BATCH_DATA_2 buttons');
} else {
    // maybe it matched the first one, let's find the second one!
    const matches = [...data.matchAll(/<button\s*onClick=\{\(\) => setIsImportCancelModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsExcelImportModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsBatchImportModalOpen\(true\)\}[\s\S]*?<\/button>/g)];
    if (matches.length > 1) {
        const newButtons2 = `{currentAdmin?.username !== 'Tamu' && (<>\n${matches[1][0]}\n</>)}`;
        data = data.slice(0, matches[1].index) + newButtons2 + data.slice(matches[1].index + matches[1][0].length);
        console.log('Replaced SECOND occurrence (BATCH_DATA_2)');
    } else {
        console.log('Could not find second occurrence of buttons');
    }
}

fs.writeFileSync('components/AdminDashboard.tsx', data);
console.log('Done');
