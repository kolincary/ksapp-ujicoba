const fs = require('fs');

let data = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const targetIndex = data.indexOf(`activeView === 'BATCH_DATA_3' ? 'Batch management' : 'Progress Order'`);
if (targetIndex === -1) {
    console.log("Could not find anchor text for BATCH_DATA_2!");
    process.exit(1);
}

const sliceStart = targetIndex;
const sliceEnd = targetIndex + 5000;
let chunk = data.substring(sliceStart, sliceEnd);

// 1. Replace the buttons
const buttonsRegex = /<button\s*onClick=\{\(\) => setIsImportCancelModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsExcelImportModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setIsBatchImportModalOpen\(true\)\}[\s\S]*?<\/button>/;
const btnMatch = chunk.match(buttonsRegex);
if (btnMatch) {
    const newButtons = `{currentAdmin?.username !== 'Tamu' && (<>\n${btnMatch[0]}\n</>)}`;
    chunk = chunk.replace(btnMatch[0], newButtons);
    console.log("Replaced buttons in BATCH_DATA_2.");
} else {
    console.log("Could not find buttons to replace.");
}

// 2. Replace the Data Items, Ringkasan Progress, Rekap Admin tabs
const tabsRegex1 = /<button\s*onClick=\{\(\) => setActiveBatchTab\('ITEMS'\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setActiveBatchTab\('SUMMARY'\)\}[\s\S]*?<\/button>\s*<button\s*onClick=\{\(\) => setActiveBatchTab\('REKAP_ADMIN'\)\}[\s\S]*?<\/button>/;
const tabMatch1 = chunk.match(tabsRegex1);
if (tabMatch1) {
    const newTabs1 = `{currentAdmin?.username !== 'Tamu' && (<>\n${tabMatch1[0]}\n</>)}`;
    chunk = chunk.replace(tabMatch1[0], newTabs1);
    console.log("Replaced Data Items, Summary, Rekap tabs in BATCH_DATA_2.");
} else {
    console.log("Could not find tabs1 to replace.");
}

// 3. Replace the MASS_SEARCH tab
const tabsRegex2 = /<button\s*onClick=\{\(\) => setActiveBatchTab\('MASS_SEARCH'\)\}[\s\S]*?<\/button>/;
const tabMatch2 = chunk.match(tabsRegex2);
if (tabMatch2) {
    const newTabs2 = `{currentAdmin?.username !== 'Tamu' && (\n${tabMatch2[0]}\n)}`;
    chunk = chunk.replace(tabMatch2[0], newTabs2);
    console.log("Replaced MASS_SEARCH tab in BATCH_DATA_2.");
} else {
    console.log("Could not find MASS_SEARCH tab to replace.");
}

// Assemble back
data = data.substring(0, sliceStart) + chunk + data.substring(sliceEnd);
fs.writeFileSync('components/AdminDashboard.tsx', data);
console.log("All replacements completed for BATCH_DATA_2.");
