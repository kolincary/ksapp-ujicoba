const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

// Replace standard Logistik pagination
code = code.replace(/q = q\.range\(offset, offset \+ limit - 1\);/g, "q = q.order('timestamp', { ascending: true }).range(offset, offset + limit - 1);");

// Replace Picker
code = code.replace(/q = q\.ilike\('barcode', '0026%'\)\.range\(offset, offset \+ limit - 1\);/g, "q = q.ilike('barcode', '0026%').order('timestamp', { ascending: true }).range(offset, offset + limit - 1);");

// Replace Checker
code = code.replace(/q = q\.ilike\('barcode', 'LXAD%'\)\.range\(offset, offset \+ limit - 1\);/g, "q = q.ilike('barcode', 'LXAD%').order('timestamp', { ascending: true }).range(offset, offset + limit - 1);");

// Replace Ojol
code = code.replace(/q = q\.ilike\('barcode', 'JNAP%'\)\.range\(offset, offset \+ limit - 1\);/g, "q = q.ilike('barcode', 'JNAP%').order('timestamp', { ascending: true }).range(offset, offset + limit - 1);");

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Replaced range calls');
