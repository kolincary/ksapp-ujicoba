import sys

file_path = r'c:\Users\jgilb\OneDrive\Dokumen\bolt new\4_scan kalindo all in one\scan kalindo sortir update\components\AdminDashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update fetchDistinctStaff to fetch leader_profile for PICKER_DATA
old_fetch_distinct = """            // --- LOOP FETCHING (PAGINATION) ---
            // Ensures we get names even if they are in record #10,001+
            while (fetchMore) {"""

new_fetch_distinct = """            // --- LOOP FETCHING (PAGINATION) ---
            // Ensures we get names even if they are in record #10,001+
            if (activeView === 'PICKER_DATA') {
                const { data: leaderData } = await activeClient.from('leader_scan_2').select('leader_profile');
                if (leaderData) {
                    leaderData.forEach((d: any) => {
                        if (d.leader_profile) uniqueNamesSet.add(d.leader_profile);
                    });
                }
                fetchMore = false;
            }

            while (fetchMore) {"""

content = content.replace(old_fetch_distinct, new_fetch_distinct)

# 2. Update buildPackingQuery signature
old_build_sig = "const buildPackingQuery = (shiftToNamesMap: Record<string, string[]>, countType: 'exact' | 'planned' | 'estimated' | null = null, options?: { startDate?: string, endDate?: string, overrideView?: AdminView }) => {"
new_build_sig = "const buildPackingQuery = (shiftToNamesMap: Record<string, string[]>, countType: 'exact' | 'planned' | 'estimated' | null = null, options?: { startDate?: string, endDate?: string, overrideView?: AdminView, leaderBarcodes?: string[] | null }) => {"

content = content.replace(old_build_sig, new_build_sig)

# 3. Apply leaderBarcodes and fix filterPackingStaff inside buildPackingQuery
old_filter_staff = """      if (filterPackingStaff !== 'ALL') {
         if (isLeader2) query = query.eq('leader_name', filterPackingStaff);
         else query = query.eq('employee_name', filterPackingStaff);
      }"""

new_filter_staff = """      if (options?.leaderBarcodes) {
         query = query.in('barcode', options.leaderBarcodes);
      }

      if (filterPackingStaff !== 'ALL') {
         if (isLeader2) query = query.eq('leader_name', filterPackingStaff);
         else if (targetView !== 'PICKER_DATA') query = query.eq('employee_name', filterPackingStaff);
      }"""

content = content.replace(old_filter_staff, new_filter_staff)

# 4. Modify fetchPackingData to query leader_scan_2
old_fetch_packing = """         const query = buildPackingQuery(shiftToNamesMap, 'exact');"""
new_fetch_packing = """         let leaderBarcodes: string[] | null = null;
         if (activeView === 'PICKER_DATA' && filterPackingStaff !== 'ALL') {
            const { data: ld } = await supabase.from('leader_scan_2').select('barcode').eq('leader_profile', filterPackingStaff);
            if (ld) leaderBarcodes = ld.map((d: any) => d.barcode);
            else leaderBarcodes = ['NO_MATCH_XYZ_123']; // Prevent empty array from fetching all
         }

         const query = buildPackingQuery(shiftToNamesMap, 'exact', { leaderBarcodes });"""

content = content.replace(old_fetch_packing, new_fetch_packing)


old_enriched = """         const enrichedData = (data || []).map((item: any) => {"""
new_enriched = """         let enrichedData = (data || []).map((item: any) => {"""
content = content.replace(old_enriched, new_enriched)


old_set_packing = """         setPackingData(enrichedData);"""
new_set_packing = """         // FETCH LEADER PROFILE IF PICKER
         if (activeView === 'PICKER_DATA' && enrichedData.length > 0) {
            const barcodes = enrichedData.map((d: any) => d.barcode);
            const { data: leaderData } = await activeClient
               .from('leader_scan_2')
               .select('barcode, leader_profile')
               .in('barcode', barcodes);

            if (leaderData) {
               const leaderMap = new Map();
               leaderData.forEach((ld: any) => leaderMap.set(ld.barcode, ld.leader_profile));
               enrichedData.forEach((d: any) => {
                  d.leader_profile = leaderMap.get(d.barcode) || '-';
               });
            } else {
               enrichedData.forEach((d: any) => d.leader_profile = '-');
            }
         }

         setPackingData(enrichedData);"""

content = content.replace(old_set_packing, new_set_packing)

# 5. Fix Shift Dropdown UI
old_shift_ui = """                                          <select
                                             value={activeView === 'OJOL_DATA' ? filterOjolShift : filterPackingShift}
                                             onChange={(e) => activeView === 'OJOL_DATA' ? setFilterOjolShift(e.target.value) : setFilterPackingShift(e.target.value)}
                                             className="w-full pl-9 pr-8 h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                          >
                                             <option value="ALL">All Shifts</option>
                                             {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                                          </select>"""

new_shift_ui = """                                          <select
                                             value={activeView === 'PICKER_DATA' ? 'Leader' : (activeView === 'OJOL_DATA' ? filterOjolShift : filterPackingShift)}
                                             onChange={(e) => activeView === 'OJOL_DATA' ? setFilterOjolShift(e.target.value) : setFilterPackingShift(e.target.value)}
                                             className={`w-full pl-9 pr-8 h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:outline-none ${activeView === 'PICKER_DATA' ? 'opacity-70 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 cursor-pointer'}`}
                                             disabled={activeView === 'PICKER_DATA'}
                                          >
                                             {activeView === 'PICKER_DATA' ? (
                                                <option value="Leader">Leader</option>
                                             ) : (
                                                <>
                                                   <option value="ALL">All Shifts</option>
                                                   {availableShifts.map(s => <option key={s} value={s}>{s}</option>)}
                                                </>
                                             )}
                                          </select>"""

content = content.replace(old_shift_ui, new_shift_ui)

# 6. Add LEADER Column Header
# We insert it right after Staff header
old_header_staff = """                                                   {activeView !== 'LEADER_2_DATA' && (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 min-w-[150px]">Staff</th>
                                                   )}"""

new_header_staff = """                                                   {activeView !== 'LEADER_2_DATA' && (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 min-w-[150px]">Staff</th>
                                                   )}
                                                   {activeView === 'PICKER_DATA' && (
                                                      <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 min-w-[150px]">LEADER</th>
                                                   )}"""

content = content.replace(old_header_staff, new_header_staff)

# 7. Add LEADER Table Cell
# We insert it right after Staff cell
old_cell_staff = """                                                         {activeView !== 'LEADER_2_DATA' && (
                                                            <td className="p-5 text-sm font-medium"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">{item.employee_name?.charAt(0) || '?'}</div><span className="text-gray-700 dark:text-gray-300">{item.employee_name}</span></div></td>
                                                         )}"""

new_cell_staff = """                                                         {activeView !== 'LEADER_2_DATA' && (
                                                            <td className="p-5 text-sm font-medium"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300">{item.employee_name?.charAt(0) || '?'}</div><span className="text-gray-700 dark:text-gray-300">{item.employee_name}</span></div></td>
                                                         )}
                                                         {activeView === 'PICKER_DATA' && (
                                                            <td className="p-5 text-sm font-medium text-gray-700 dark:text-gray-300">{item.leader_profile || '-'}</td>
                                                         )}"""

content = content.replace(old_cell_staff, new_cell_staff)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied.")
