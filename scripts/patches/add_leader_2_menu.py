import sys
import re

file_path = 'components/AdminDashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update ADMIN_PERMISSIONS_LIST
content = content.replace(
    "{ id: 'view_picker', label: 'View Picker Data' },",
    "{ id: 'view_picker', label: 'View Picker Data' },\n   { id: 'view_leader_2', label: 'View Leader 2 Data' },"
)

# 2. Update VIEW_PERMISSIONS
content = content.replace(
    "'PICKER_DATA': 'view_picker',",
    "'PICKER_DATA': 'view_picker',\n   'LEADER_2_DATA': 'view_leader_2',"
)

# 3. getInitialView
content = content.replace(
    "if (perms.includes('view_picker')) return 'PICKER_DATA';",
    "if (perms.includes('view_picker')) return 'PICKER_DATA';\n      if (perms.includes('view_leader_2')) return 'LEADER_2_DATA';"
)

# 4. targetRole mapping inside handleBulkExportExcel
content = content.replace(
    "else if (activeView === 'SORTIR_DATA') targetRole = 'SORTIR';",
    "else if (activeView === 'SORTIR_DATA') targetRole = 'SORTIR';\n      else if (activeView === 'LEADER_2_DATA') targetRole = 'LEADER_2';"
)

# targetRole mapping inside handleDeleteAllForRole
content = content.replace(
    "else if (deleteTargetView === 'SORTIR_DATA') targetRole = 'SORTIR';",
    "else if (deleteTargetView === 'SORTIR_DATA') targetRole = 'SORTIR';\n      else if (deleteTargetView === 'LEADER_2_DATA') targetRole = 'LEADER_2';"
)

# effectiveRole mapping inside buildPackingQuery
content = content.replace(
    "else if (targetView === 'PICKER_DATA') effectiveRole = 'PICKER';",
    "else if (targetView === 'PICKER_DATA') effectiveRole = 'PICKER';\n      else if (targetView === 'LEADER_2_DATA') effectiveRole = 'LEADER_2';"
)

# fetchPackingData guards
content = content.replace(
    "if (activeView === 'PICKER_DATA' && !hasPermission('view_picker')) return;",
    "if (activeView === 'PICKER_DATA' && !hasPermission('view_picker')) return;\n      if (activeView === 'LEADER_2_DATA' && !hasPermission('view_leader_2')) return;"
)

# Includes checks
patterns_to_replace = [
    "'SORTIR_DATA', 'PICKER_DATA', 'GUDANG_PENDING'",
    "activeView === 'PICKER_DATA' || activeView === 'GUDANG_PENDING'",
    "activeView !== 'PICKER_DATA' && activeView !== 'GUDANG_PENDING'",
    "activeView !== 'PICKER_DATA' && activeView !== 'SCAN_ALL'",
    "'SORTIR_DATA', 'PICKER_DATA', 'OJOL_DATA'",
    "activeView === 'PICKER_DATA') &&",
    "activeView === 'PICKER_DATA') ? 'Picker' : 'Packing'",
    "activeView === 'PICKER_DATA' || activeView === 'OJOL_DATA'",
    "'SORTIR_DATA', 'PICKER_DATA', 'OJOL_DATA', 'SCAN_ALL'",
]

for p in patterns_to_replace:
   if p == "'SORTIR_DATA', 'PICKER_DATA', 'GUDANG_PENDING'":
       content = content.replace(p, "'SORTIR_DATA', 'PICKER_DATA', 'LEADER_2_DATA', 'GUDANG_PENDING'")
   elif p == "activeView === 'PICKER_DATA' || activeView === 'GUDANG_PENDING'":
       content = content.replace(p, "activeView === 'PICKER_DATA' || activeView === 'LEADER_2_DATA' || activeView === 'GUDANG_PENDING'")
   elif p == "activeView !== 'PICKER_DATA' && activeView !== 'GUDANG_PENDING'":
       content = content.replace(p, "activeView !== 'PICKER_DATA' && activeView !== 'LEADER_2_DATA' && activeView !== 'GUDANG_PENDING'")
   elif p == "activeView !== 'PICKER_DATA' && activeView !== 'SCAN_ALL'":
       content = content.replace(p, "activeView !== 'PICKER_DATA' && activeView !== 'LEADER_2_DATA' && activeView !== 'SCAN_ALL'")
   elif p == "'SORTIR_DATA', 'PICKER_DATA', 'OJOL_DATA'":
       content = content.replace(p, "'SORTIR_DATA', 'PICKER_DATA', 'LEADER_2_DATA', 'OJOL_DATA'")
   elif p == "activeView === 'PICKER_DATA') &&":
       content = content.replace(p, "activeView === 'PICKER_DATA' || activeView === 'LEADER_2_DATA') &&")
   elif p == "activeView === 'PICKER_DATA') ? 'Picker' : 'Packing'":
       content = content.replace(p, "activeView === 'PICKER_DATA') ? 'Picker' : (activeView === 'LEADER_2_DATA') ? 'Leader 2' : 'Packing'")
   elif p == "activeView === 'PICKER_DATA' || activeView === 'OJOL_DATA'":
       content = content.replace(p, "activeView === 'PICKER_DATA' || activeView === 'LEADER_2_DATA' || activeView === 'OJOL_DATA'")
   elif p == "'SORTIR_DATA', 'PICKER_DATA', 'OJOL_DATA', 'SCAN_ALL'":
       content = content.replace(p, "'SORTIR_DATA', 'PICKER_DATA', 'LEADER_2_DATA', 'OJOL_DATA', 'SCAN_ALL'")

# Placeholder replacements
content = content.replace(
   "activeView === 'PICKER_DATA' ? 'Picker' : 'Packing'",
   "activeView === 'PICKER_DATA' ? 'Picker' : (activeView === 'LEADER_2_DATA' ? 'Leader 2' : 'Packing')"
)

# Sidebar
sidebar_item = """<SidebarItem view="PICKER_DATA" icon={Shuffle} label="Data Picker" requiredPerm="view_picker" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />"""
new_sidebar_item = sidebar_item + """\n                  <SidebarItem view="LEADER_2_DATA" icon={Users} label="Data Leader 2" requiredPerm="view_leader_2" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />"""
content = content.replace(sidebar_item, new_sidebar_item)

# Dashboard widgets
widget = "{ id: 'PICKER_DATA', label: 'Data Picker', icon: Layers, color: 'indigo' },"
new_widget = widget + "\n               { id: 'LEADER_2_DATA', label: 'Data Leader 2', icon: Users, color: 'orange' },"
content = content.replace(widget, new_widget)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done editing AdminDashboard.tsx')
