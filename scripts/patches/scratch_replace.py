import os
import sys

file_path = r'c:\Users\jgilb\OneDrive\Dokumen\bolt new\4_scan kalindo all in one\scan kalindo sortir update\components\AdminDashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

replaced = False
for i, line in enumerate(lines):
    if i >= 5435 and i <= 5445:
        if 'min-w-[160px]">Staff</th>' in line:
            lines[i] = line.replace('Staff</th>', 'STAFF</th>')
            replaced = True

if replaced:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Replaced successfully")
else:
    print("Pattern not found")
