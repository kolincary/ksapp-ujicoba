import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. buildPackingQuery modification
old_build_query = "let query = activeClient.from('scanned_items').select('*', countType ? { count: countType } : undefined);"

new_build_query = """let effectiveTable = 'scanned_items';
      let isLeader2 = targetView === 'LEADER_2_DATA';
      if (isLeader2) effectiveTable = 'leader_scan_2';
      
      let query = activeClient.from(effectiveTable).select('*', countType ? { count: countType } : undefined);"""

content = content.replace(old_build_query, new_build_query)

# 2. Prevent query.eq('role', effectiveRole) for leader_scan_2
old_role_filter = "if (effectiveRole !== 'ALL') query = query.eq('role', effectiveRole);"
new_role_filter = "if (effectiveRole !== 'ALL' && !isLeader2) query = query.eq('role', effectiveRole);"
content = content.replace(old_role_filter, new_role_filter)

# 3. Filter mapping for leader_scan_2
old_search_filter = "if (packingSearch) query = query.or(`barcode.ilike.%${packingSearch}%,employee_name.ilike.%${packingSearch}%`);"
new_search_filter = """if (packingSearch) {
         if (isLeader2) query = query.or(`barcode.ilike.%${packingSearch}%,leader_name.ilike.%${packingSearch}%`);
         else query = query.or(`barcode.ilike.%${packingSearch}%,employee_name.ilike.%${packingSearch}%`);
      }"""
content = content.replace(old_search_filter, new_search_filter)

old_staff_filter = "if (filterPackingStaff !== 'ALL') query = query.eq('employee_name', filterPackingStaff);"
new_staff_filter = """if (filterPackingStaff !== 'ALL') {
         if (isLeader2) query = query.eq('leader_name', filterPackingStaff);
         else query = query.eq('employee_name', filterPackingStaff);
      }"""
content = content.replace(old_staff_filter, new_staff_filter)

old_shift_filter = """if (validNames.length > 0) query = query.in('employee_name', validNames);
         else query = query.eq('id', '00000000-0000-0000-0000-000000000000');"""
new_shift_filter = """if (validNames.length > 0) {
            query = isLeader2 ? query.in('leader_name', validNames) : query.in('employee_name', validNames);
         } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
         }"""
content = content.replace(old_shift_filter, new_shift_filter)

# 4. Map the fetched data in fetchPackingData
old_enrich = """const enrichedData = (data || []).map((item: any) => ({
            ...item,
            shift: shiftMap.get(item.employee_name) || 'Unknown'
         }));"""
new_enrich = """const enrichedData = (data || []).map((item: any) => {
            if (activeView === 'LEADER_2_DATA') {
               return {
                  ...item,
                  employee_name: item.leader_name,
                  role: 'LEADER_2',
                  description: `[${item.assignment_mode || ''}] ${item.scan_type || ''}`,
                  destination: Array.isArray(item.assignees) ? item.assignees.join(', ') : '',
                  shift: shiftMap.get(item.leader_name) || 'Unknown'
               };
            }
            return {
               ...item,
               shift: shiftMap.get(item.employee_name) || 'Unknown'
            };
         });"""
content = content.replace(old_enrich, new_enrich)

# 5. Fix Delete logic
old_delete_rpc = """// Call the Smart Delete RPC
         const { error } = await supabase.rpc('admin_delete_scanned_items', {
            min_ts: start.getTime(),
            max_ts: end.getTime(),
            target_role: targetRole,
            target_context: targetContext
         });"""
new_delete_rpc = """let error;
         if (targetRole === 'LEADER_2') {
            const { error: leaderErr } = await supabase.from('leader_scan_2')
               .delete()
               .gte('timestamp', start.getTime())
               .lte('timestamp', end.getTime());
            error = leaderErr;
         } else {
            const { error: rpcErr } = await supabase.rpc('admin_delete_scanned_items', {
               min_ts: start.getTime(),
               max_ts: end.getTime(),
               target_role: targetRole,
               target_context: targetContext
            });
            error = rpcErr;
         }"""
content = content.replace(old_delete_rpc, new_delete_rpc)

# 6. Fix Update logic for Staff (assign targetStaff)
# wait, where is targetStaff logic? Let's check `handleTargetSubmit` in handleBulkUpdate
old_update_staff = """.from('scanned_items')
                  .update({ employee_name: targetStaff })
                  .eq('id', itemId);"""
new_update_staff = """.from(activeView === 'LEADER_2_DATA' ? 'leader_scan_2' : 'scanned_items')
                  .update(activeView === 'LEADER_2_DATA' ? { leader_name: targetStaff } : { employee_name: targetStaff })
                  .eq('id', itemId);"""
content = content.replace(old_update_staff, new_update_staff)

old_update_staff_del = """.from('scanned_items')
                        .delete()
                        .eq('id', itemId);"""
new_update_staff_del = """.from(activeView === 'LEADER_2_DATA' ? 'leader_scan_2' : 'scanned_items')
                        .delete()
                        .eq('id', itemId);"""
content = content.replace(old_update_staff_del, new_update_staff_del)

# For role logic
old_update_role = """.from('scanned_items')
                  .update({ role: target })
                  .eq('id', itemId);"""
new_update_role = """.from(activeView === 'LEADER_2_DATA' ? 'leader_scan_2' : 'scanned_items')
                  .update(activeView === 'LEADER_2_DATA' ? { scan_type: target } : { role: target })
                  .eq('id', itemId);"""
content = content.replace(old_update_role, new_update_role)

# Edit individual item logic (if it exists)
old_submit_edit = """const { error } = await supabase
            .from('scanned_items')
            .update({
               barcode: editingItem.barcode,
               employee_name: editingItem.employee_name
            })
            .eq('id', editingItem.id);"""
new_submit_edit = """const { error } = await supabase
            .from(activeView === 'LEADER_2_DATA' ? 'leader_scan_2' : 'scanned_items')
            .update(activeView === 'LEADER_2_DATA' ? {
               barcode: editingItem.barcode,
               leader_name: editingItem.employee_name
            } : {
               barcode: editingItem.barcode,
               employee_name: editingItem.employee_name
            })
            .eq('id', editingItem.id);"""
content = content.replace(old_submit_edit, new_submit_edit)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
