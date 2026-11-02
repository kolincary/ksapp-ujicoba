import os, re

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = '<SidebarItem view="SETTINGS" icon={Settings} label="Pengaturan Sistem" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />'
replacement = '{showSecretMenu && (\n                        <SidebarItem view="SETTINGS" icon={Settings} label="Pengaturan Sistem" requiredPerm="manage_database" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />\n                     )}'

if target in text and replacement not in text:
    text = text.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Done replacing')
else:
    print('Target not found or already replaced.')
