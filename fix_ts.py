import re

path = 'types.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add SETTINGS to AdminView
text = re.sub(
    r'(export type AdminView = .*? \| \'SUPABASE_CONFIG\')',
    r"\1 | 'SETTINGS'",
    text
)
with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

# Add Settings to lucide-react import in AdminDashboard.tsx
dashboard_path = 'components/AdminDashboard.tsx'
with open(dashboard_path, 'r', encoding='utf-8') as f:
    dashboard_text = f.read()

lucide_import_match = re.search(r'import \{([^\}]+)\} from \'lucide-react\';', dashboard_text)
if lucide_import_match:
    lucide_imports = lucide_import_match.group(1)
    if 'Settings' not in lucide_imports:
        new_lucide_imports = lucide_imports + ', Settings'
        dashboard_text = dashboard_text.replace(lucide_import_match.group(0), f"import {{{new_lucide_imports}}} from 'lucide-react';")
        with open(dashboard_path, 'w', encoding='utf-8') as f:
            f.write(dashboard_text)

print('Fixed types')
