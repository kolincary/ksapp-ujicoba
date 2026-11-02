const fs = require('fs');
let data = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const targetIndex = data.indexOf(`activeView === 'BATCH_DATA_3' ? 'Batch management' : 'Progress Order'`);

// find the exact index of Data Items tab
const startIdx = data.indexOf(`onClick={() => setActiveBatchTab('ITEMS')}`, targetIndex) - 100;
const endIdx = data.indexOf(`onClick={() => setActiveBatchTab('AUDIT_KOMPARASI')}`, startIdx);

if (startIdx > 0 && endIdx > startIdx) {
    let chunk = data.substring(startIdx, endIdx);
    
    // Replace tabs 1
    const tabsRegex1 = /<button\s*onClick=\{\(\) => setActiveBatchTab\('ITEMS'\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setActiveBatchTab\('SUMMARY'\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setActiveBatchTab\('REKAP_ADMIN'\)\}[\s\S]*?<\/button>/;
    const tabMatch1 = chunk.match(tabsRegex1);
    if (tabMatch1) {
        const newTabs1 = `{currentAdmin?.username !== 'Tamu' && (<>\n${tabMatch1[0]}\n</>)}`;
        chunk = chunk.replace(tabMatch1[0], newTabs1);
        console.log("Replaced tabs1!");
    } else {
        console.log("Could not find tabs1");
    }
    
    data = data.substring(0, startIdx) + chunk + data.substring(endIdx);
} else {
    console.log("Could not find start/end idx");
}

// Pencarian massal
const massSearchStartIdx = data.indexOf(`onClick={() => setActiveBatchTab('MASS_SEARCH')}`, targetIndex) - 100;
const massSearchEndIdx = data.indexOf(`</div>`, massSearchStartIdx);
if (massSearchStartIdx > 0 && massSearchEndIdx > massSearchStartIdx) {
    let chunk2 = data.substring(massSearchStartIdx, massSearchEndIdx);
    const tabsRegex2 = /<button\s*onClick=\{\(\) => setActiveBatchTab\('MASS_SEARCH'\)\}[\s\S]*?<\/button>/;
    const tabMatch2 = chunk2.match(tabsRegex2);
    if (tabMatch2) {
        const newTabs2 = `{currentAdmin?.username !== 'Tamu' && (\n${tabMatch2[0]}\n)}`;
        chunk2 = chunk2.replace(tabMatch2[0], newTabs2);
        console.log("Replaced MASS_SEARCH!");
    } else {
        console.log("Could not find MASS_SEARCH");
    }
    data = data.substring(0, massSearchStartIdx) + chunk2 + data.substring(massSearchEndIdx);
}

fs.writeFileSync('components/AdminDashboard.tsx', data);
console.log('Done');
