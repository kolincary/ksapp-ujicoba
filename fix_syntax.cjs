const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/scan kalindo sortir update/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The problematic string is \',\' literally
content = content.split("\\',\\'").join("','");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed syntax errors');
