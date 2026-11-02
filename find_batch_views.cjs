const fs = require('fs');

const content = fs.readFileSync('./components/AdminDashboard.tsx', 'utf8');
const regex = /activeView\s*===?\s*['"]([^'"]+)['"]/g;
const views = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
  views.add(match[1]);
}
console.log('Unique activeViews found:', Array.from(views));

// Also find where "Batch Management" appears
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('batch management') || l.includes('activeBatchTab')) {
    console.log(`Line ${i + 1}: ${l.trim().slice(0, 100)}`);
  }
});
