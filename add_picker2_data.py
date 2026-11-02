import re

filepath = 'components/AdminDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add view_picker_2 permission
if "'view_picker_2'" not in content:
    content = content.replace(
        "{ id: 'view_picker', label: 'View Picker Data' },",
        "{ id: 'view_picker', label: 'View Picker Data' },\n   { id: 'view_picker_2', label: 'View Picker 2 Data' },"
    )

# 2. Add to VIEW_PERMISSION_MAP
if "'PICKER_2_DATA'" not in content:
    content = content.replace(
        "'PICKER_DATA': 'view_picker',",
        "'PICKER_DATA': 'view_picker',\n   'PICKER_2_DATA': 'view_picker_2',"
    )

# 3. Add to getFirstAccessibleView
if "return 'PICKER_2_DATA'" not in content:
    content = content.replace(
        "if (perms.includes('view_picker')) return 'PICKER_DATA';",
        "if (perms.includes('view_picker')) return 'PICKER_DATA';\n      if (perms.includes('view_picker_2')) return 'PICKER_2_DATA';"
    )

# 4. Add to getTitle
if "Data Picker 2" not in content:
    content = content.replace(
        "if (activeView === 'PICKER_DATA') return 'Data Picker';",
        "if (activeView === 'PICKER_DATA') return 'Data Picker';\n      if (activeView === 'PICKER_2_DATA') return 'Data Picker 2';"
    )

# 5. Add to handleSidebarSelect fetch conditions
content = re.sub(
    r"\} else if \(activeView === 'PICKER_DATA'\) \{",
    "} else if (activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA') {",
    content
)

# 6. Add to fetchEmployees trigger
content = re.sub(
    r"\['EMPLOYEES', 'PACKING_DATA', 'SORTIR_DATA', 'PICKER_DATA'",
    "['EMPLOYEES', 'PACKING_DATA', 'SORTIR_DATA', 'PICKER_DATA', 'PICKER_2_DATA'",
    content
)

# 7. Add to fetchPackingData trigger and conditions
content = content.replace("activeView === 'PICKER_DATA' || activeView === 'LEADER_2_DATA'", "activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA' || activeView === 'LEADER_2_DATA'")
content = content.replace("activeView !== 'PICKER_DATA' && activeView !== 'LEADER_2_DATA'", "activeView !== 'PICKER_DATA' && activeView !== 'PICKER_2_DATA' && activeView !== 'LEADER_2_DATA'")

# 8. Add role target definition
content = content.replace("else if (activeView === 'PICKER_DATA') targetRole = 'PICKER';", "else if (activeView === 'PICKER_DATA') targetRole = 'PICKER';\n            else if (activeView === 'PICKER_2_DATA') targetRole = 'PICKER_2';")

# 9. Add to applyPackingFilters effectiveRole
content = content.replace("else if (targetView === 'PICKER_DATA') effectiveRole = 'PICKER';", "else if (targetView === 'PICKER_DATA') effectiveRole = 'PICKER';\n      else if (targetView === 'PICKER_2_DATA') effectiveRole = 'PICKER_2';")

content = content.replace("else if (targetView !== 'PICKER_DATA')", "else if (targetView !== 'PICKER_DATA' && targetView !== 'PICKER_2_DATA')")

# 10. Add to applyPackingFilters extra conditions
content = content.replace("targetView === 'PICKER_DATA' && filterPickerType !== 'ALL'", "(targetView === 'PICKER_DATA' || targetView === 'PICKER_2_DATA') && filterPickerType !== 'ALL'")

# 11. Add to prepareExport permission check
content = content.replace("activeView === 'PICKER_DATA' && !hasPermission('view_picker')", "(activeView === 'PICKER_DATA' && !hasPermission('view_picker')) || (activeView === 'PICKER_2_DATA' && !hasPermission('view_picker_2'))")

# 12. Add to prepareExport query check
content = content.replace("activeView === 'PICKER_DATA' && filterPackingStaff !== 'ALL'", "(activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA') && filterPackingStaff !== 'ALL'")

content = content.replace("activeView === 'PICKER_DATA' && enrichedData.length > 0", "(activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA') && enrichedData.length > 0")

# 13. Add SidebarItem
if 'view="PICKER_2_DATA"' not in content:
    content = content.replace(
        '<SidebarItem view="PICKER_DATA" icon={ScanLine} label="Data Picker" requiredPerm="view_picker" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />',
        '<SidebarItem view="PICKER_DATA" icon={ScanLine} label="Data Picker" requiredPerm="view_picker" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />\n                     <SidebarItem view="PICKER_2_DATA" icon={ScanLine} label="Data Picker 2" requiredPerm="view_picker_2" activeView={activeView} hasPermission={hasPermission} onSelect={handleSidebarSelect} />'
    )

# 14. Add to the gigantic activeView checks for rendering tables and filters
content = content.replace("activeView === 'PICKER_DATA' || activeView === 'LEADER_2_DATA'", "activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA' || activeView === 'LEADER_2_DATA'")
content = content.replace("'PICKER_DATA', 'LEADER_2_DATA'", "'PICKER_DATA', 'PICKER_2_DATA', 'LEADER_2_DATA'")
content = content.replace("activeView === 'PICKER_DATA' ? 'Picker'", "activeView === 'PICKER_DATA' ? 'Picker' : (activeView === 'PICKER_2_DATA' ? 'Picker 2'")
content = content.replace("activeView === 'PICKER_DATA' &&", "(activeView === 'PICKER_DATA' || activeView === 'PICKER_2_DATA') &&")
content = content.replace("activeView !== 'PICKER_DATA' && activeView !== 'LEADER_2_DATA'", "activeView !== 'PICKER_DATA' && activeView !== 'PICKER_2_DATA' && activeView !== 'LEADER_2_DATA'")

# 15. Add to downloadExport mapping
if "'PICKER_2_DATA'" not in content:
    content = content.replace("{ id: 'PICKER_DATA', label: 'Data Picker', icon: ScanLine, color: 'cyan' },", "{ id: 'PICKER_DATA', label: 'Data Picker', icon: ScanLine, color: 'cyan' },\n                                   { id: 'PICKER_2_DATA', label: 'Data Picker 2', icon: ScanLine, color: 'cyan' },")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated AdminDashboard.tsx for PICKER_2_DATA")
