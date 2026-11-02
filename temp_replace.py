import os

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'availableShifts.map(s => <option key={s} value={s}>{s}</option>)}</select></div>' in line:
        lines[i] = line.replace('{availableShifts.map(s => <option key={s} value={s}>{s}</option>)}', 
            "{(currentAdmin?.username === 'logistik' ? availableShifts.filter(s => ['borongan 500', 'harian', 'ojol', 'shift ade', 'shift suhel'].includes(s.toLowerCase())) : availableShifts).map(s => <option key={s} value={s}>{s}</option>)}")
        # Next line has the button
        if "openQuickAdd('SHIFT')" in lines[i+1]:
            lines[i+1] = lines[i+1].replace("<button onClick={() => openQuickAdd('SHIFT')}", "{currentAdmin?.username !== 'logistik' && <button onClick={() => openQuickAdd('SHIFT')}")
            lines[i+1] = lines[i+1].replace("</button>", "</button>}")
            
    if 'availableRoles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>' in line:
        lines[i] = line.replace('{availableRoles.map(r => <option key={r} value={r}>{r}</option>)}', 
            "{(currentAdmin?.username === 'logistik' ? availableRoles.filter(r => ['PICKER', 'SORTIR', 'PACKING'].includes(r.toUpperCase())) : availableRoles).map(r => <option key={r} value={r}>{r}</option>)}")
        # Next line has the button
        if "openQuickAdd('ROLE')" in lines[i+1]:
            lines[i+1] = lines[i+1].replace("<button onClick={() => openQuickAdd('ROLE')}", "{currentAdmin?.username !== 'logistik' && <button onClick={() => openQuickAdd('ROLE')}")
            lines[i+1] = lines[i+1].replace("</button>", "</button>}")
            
    if '{availableShifts.map(shift => (' in line and 'grid-cols-2' in lines[i-1]:
        lines[i] = line.replace('{availableShifts.map(shift => (', 
            "{(currentAdmin?.username === 'logistik' ? availableShifts.filter(s => ['borongan 500', 'harian', 'ojol', 'shift ade', 'shift suhel'].includes(s.toLowerCase())) : availableShifts).map(shift => ()")
            
    if '{availableRoles.map(role => (' in line and 'grid-cols-2' in lines[i-1]:
        lines[i] = line.replace('{availableRoles.map(role => (', 
            "{(currentAdmin?.username === 'logistik' ? availableRoles.filter(r => ['PICKER', 'SORTIR', 'PACKING'].includes(r.toUpperCase())) : availableRoles).map(role => ()")

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
    
print('Replaced successfully!')
