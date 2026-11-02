import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix DOM nesting
old_total = '<p className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">\n                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Total Scans\n                                       </p>'
new_total = '<div className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">\n                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Total Scans\n                                       </div>'
# Try simpler replacement for DOM nesting
content = content.replace('p className="text-[10px] font-black', 'div className="text-[10px] font-black')
content = content.replace('bg-blue-500"></div> Total Scans\n                                       </p>', 'bg-blue-500"></div> Total Scans\n                                       </div>')
content = content.replace('bg-purple-500"></div> Active Staff\n                                       </p>', 'bg-purple-500"></div> Active Staff\n                                       </div>')
content = content.replace('bg-green-500"></div> Latest Scan\n                                       </p>', 'bg-green-500"></div> Latest Scan\n                                       </div>')

# Fix Date logic
old_date = 'if (leader2BulkDate) updates.date = leader2BulkDate;'
new_date = """if (leader2BulkDate) {
             updates.date = leader2BulkDate;
             updates.timestamp = new Date(leader2BulkDate + 'T12:00:00').getTime();
          }"""
content = content.replace(old_date, new_date)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
