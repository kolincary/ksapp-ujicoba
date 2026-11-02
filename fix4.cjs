const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetLF = '            </div>\n            </div>\n         )}\n\n         <style>{`';
const replaceLF = '            </div>\n         )}\n\n         <style>{`';
const targetCRLF = '            </div>\r\n            </div>\r\n         )}\r\n\r\n         <style>{`';
const replaceCRLF = '            </div>\r\n         )}\r\n\r\n         <style>{`';

if (content.includes(targetCRLF)) {
   content = content.replace(targetCRLF, replaceCRLF);
   fs.writeFileSync(filePath, content, 'utf8');
   console.log('Removed extra </div> at the end (CRLF)');
} else if (content.includes(targetLF)) {
   content = content.replace(targetLF, replaceLF);
   fs.writeFileSync(filePath, content, 'utf8');
   console.log('Removed extra </div> at the end (LF)');
} else {
   console.log('Not found');
}
