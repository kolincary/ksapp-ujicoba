import sys
file_path = 'components/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "!['PACKING_DATA', 'SORTIR_DATA', 'OJOL_DATA', 'PICKER_DATA'].includes(activeView)",
    "!['PACKING_DATA', 'SORTIR_DATA', 'OJOL_DATA', 'PICKER_DATA', 'LEADER_2_DATA'].includes(activeView)"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
