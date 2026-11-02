const fs = require('fs');
const filePath = 'c:/Users/jgilb/OneDrive/Dokumen/bolt new/4_scan kalindo all in one/kalindo-scan - 2026-08-02T011748.989/components/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if(content.includes('</button></div>\r\n                                                    </div>\r\n                                                    <div className="flex items-center gap-2">')) {
      content = content.replace('</button></div>\r\n                                                    </div>\r\n                                                    <div className="flex items-center gap-2">', '</button>\r\n                                                    </div>\r\n                                                    <div className="flex items-center gap-2">');
      console.log('Fixed extra </div> (CRLF)');
} else if (content.includes('</button></div>\n                                                    </div>\n                                                    <div className="flex items-center gap-2">')) {
   content = content.replace('</button></div>\n                                                    </div>\n                                                    <div className="flex items-center gap-2">', '</button>\n                                                    </div>\n                                                    <div className="flex items-center gap-2">');
   console.log('Fixed extra </div> (LF)');
} else if(content.includes('</button></div>\r\n')) {
      content = content.replace('</button></div>\r\n', '</button>\r\n');
      console.log('Fixed extra </div> via fallback (CRLF)');
} else if(content.includes('</button></div>\n')) {
      content = content.replace('</button></div>\n', '</button>\n');
      console.log('Fixed extra </div> via fallback (LF)');
} else {
   console.log('Extra </div> not found!');
}

const endTargetCRLF = '            </div>\r\n         )}\r\n\r\n         <style>{`';
const endTargetLF = '            </div>\n         )}\n\n         <style>{`';

if (content.includes(endTargetCRLF)) {
   content = content.replace(endTargetCRLF, '            </div>\r\n            </div>\r\n         )}\r\n\r\n         <style>{`');
   console.log('Fixed missing </div> (CRLF)');
} else if (content.includes(endTargetLF)) {
   content = content.replace(endTargetLF, '            </div>\n            </div>\n         )}\n\n         <style>{`');
   console.log('Fixed missing </div> (LF)');
} else {
   console.log('Missing </div> target not found!');
}

fs.writeFileSync(filePath, content, 'utf8');
