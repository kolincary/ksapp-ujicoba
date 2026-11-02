import re

filepath = 'components/AdminDashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove import
content = re.sub(r"import\s*\{\s*DailyQuestView\s*\}\s*from\s*'./DailyQuestView';\n?", "", content)

# 2. Remove permission from PERMISSION_LIST
content = re.sub(r"\s*\{\s*id:\s*'manage_quests',\s*label:\s*'Manage Daily Quests'\s*\},?\n?", "\n", content)

# 3. Remove from VIEW_PERMISSION_MAP
content = re.sub(r"\s*'QUEST_HARIAN':\s*'manage_quests',?\n?", "\n", content)

# 4. Remove from getFirstAccessibleView
content = re.sub(r"\s*if\s*\(perms\.includes\('manage_quests'\)\)\s*return\s*'QUEST_HARIAN';\n?", "\n", content)

# 5. Remove from getTitle
content = re.sub(r"\s*if\s*\(activeView\s*===\s*'QUEST_HARIAN'\)\s*return\s*'Quest Harian';\n?", "\n", content)

# 6. Remove SidebarItem
content = re.sub(r"\s*<SidebarItem\s+view=\"QUEST_HARIAN\"[^>]*/>\n?", "\n", content)

# 7. Remove DailyQuestView block
content = re.sub(r"\s*\{\s*activeView\s*===\s*'QUEST_HARIAN'\s*&&\s*hasPermission\('manage_quests'\)\s*&&\s*\(\s*<DailyQuestView\s*/>\s*\)\}\n?", "\n", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed QUEST_HARIAN from AdminDashboard.tsx")
