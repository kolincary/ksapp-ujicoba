import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Sidebar label
content = content.replace('label="Data Leader 2"', 'label="Rekap Detail Leader"')
# 2. Update Stats labels
content = content.replace('label: \'Monitoring Scan Leader\'', 'label: \'Rekap Detail Leader\'')

# 3. Update Table Headers with min-widths
content = content.replace('tracking-wider w-16 bg-gray-50 dark:bg-gray-900">No.</th>', 'tracking-wider w-16 bg-gray-50 dark:bg-gray-900 min-w-[60px]">No.</th>')
content = content.replace('bg-gray-50 dark:bg-gray-900">Timestamp</th>', 'bg-gray-50 dark:bg-gray-900 min-w-[140px]">Timestamp</th>')
content = content.replace('bg-gray-50 dark:bg-gray-900">Staff</th>', 'bg-gray-50 dark:bg-gray-900 min-w-[150px]">Staff</th>')
content = content.replace('bg-gray-50 dark:bg-gray-900">Shift</th>', 'bg-gray-50 dark:bg-gray-900 min-w-[120px]">Shift</th>')
content = content.replace('bg-gray-50 dark:bg-gray-900">Context</th>', 'bg-gray-50 dark:bg-gray-900 min-w-[150px]">Context</th>')

# 4. Update Barcode Data header
content = content.replace('Barcode Data', '<span className="min-w-[180px]">Barcode Data</span>')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
