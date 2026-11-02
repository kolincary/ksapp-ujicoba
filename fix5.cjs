const fs = require('fs');
const lines = fs.readFileSync('components/AdminDashboard.tsx', 'utf8').split('\n');
let start = -1;
let end = -1;
for(let i=4450; i<4550; i++) {
   if (lines[i] && lines[i].includes('const fetchOptimizedData = async (role: string, fetchGudangAudit = false) => {')) start = i;
   if (lines[i] && lines[i].includes('setLastAuditFetchTime(')) end = i;
}

if (start !== -1 && end !== -1 && end > start) {
   const replacement = `         const fetchOptimizedData = async (role: string, fetchGudangAudit = false) => {
            if (!d) return [];
            const roleList = role === 'PICKER' 
               ? ['PICKER', 'Picker', 'OJOL', 'Ojol'] 
               : role === 'LOGISTIK'
               ? ['LOGISTIK', 'Logistik']
               : [role.toUpperCase(), role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()];

            // A. Fetch Same-day Scans (strictly within selected date range)
            let sameDayData: any[] = [];
            const buildAuditQuery = (isCount = false) => {
               let q = supabase.from('scanned_items');
               if (isCount) q = q.select('*', { count: 'exact', head: true });
               else q = q.select('id, barcode, timestamp, status, menu_context, role');
               
               if (roleList.length > 1) q = q.in('role', roleList);
               else q = q.eq('role', role);
               
               if (fetchGudangAudit) q = q.or('status.eq.PENDING,menu_context.eq.PENDING,status.eq.READY,menu_context.eq.READY,status.eq.CANCEL,menu_context.eq.CANCEL');
               
               q = q.gte('timestamp', d.startMs).lte('timestamp', d.endMs);
               return q;
            };

            const { count: auditCount } = await buildAuditQuery(true);
            if (auditCount) {
               const promises = [];
               for (let i = 0; i < auditCount; i += 1000) {
                  promises.push(buildAuditQuery(false).range(i, i + 999));
               }
               for (let i = 0; i < promises.length; i += 10) {
                  const res = await Promise.all(promises.slice(i, i + 10));
                  res.forEach(r => { if (r.error) throw r.error; r.data && sameDayData.push(...r.data); });
               }
            }
            sameDayData.sort((a,b) => Number(b.timestamp) - Number(a.timestamp)); // descending

            // B. Identify remaining admin barcodes that were NOT scanned on the same day
            const sameDayBarcodes = new Set(
               sameDayData.map(item => (item.barcode || '').toString().trim().toUpperCase()).filter(Boolean)
            );
            const remainingBarcodes = adminBarcodes.filter(bc => !sameDayBarcodes.has(bc));

            // C. Fetch Future Scans for remaining barcodes
            let futureData: any[] = [];
            if (remainingBarcodes.length > 0) {
               const chunkSize = 500;
               const chunks: string[][] = [];
               for (let i = 0; i < remainingBarcodes.length; i += chunkSize) {
                  chunks.push(remainingBarcodes.slice(i, i + chunkSize));
               }

               const futureQueryBuilders = chunks.map(chunk => {
                  let q = supabase.from('scanned_items')
                     .select('id, barcode, timestamp, status, menu_context, role')
                     .in('barcode', chunk)
                     ;
                  if (roleList.length > 1) {
                     q = q.in('role', roleList);
                  } else {
                     q = q.eq('role', role);
                  }
                  if (fetchGudangAudit) {
                     q = q.or('status.eq.PENDING,menu_context.eq.PENDING,status.eq.READY,menu_context.eq.READY,status.eq.CANCEL,menu_context.eq.CANCEL');
                  }
                  return q;
               });

               for (let i = 0; i < futureQueryBuilders.length; i += 10) {
                  const results = await Promise.all(futureQueryBuilders.slice(i, i + 10));
                  results.forEach(res => {
                     if (res.error) console.error("Error fetching future scans:", res.error);
                     else futureData = [...futureData, ...(res.data || [])];
                  });
               }
            }

            return [...sameDayData, ...futureData];
         };

         // 1. Initial Cache Check (SWR Phase 1: Stale)
         let hasRoleCache = false;
         let hasPendingCache = false;

         if (!forceRefresh) {
            if (auditRoleCacheRef.current[roleCacheKey]) {
               setAuditRoleData(auditRoleCacheRef.current[roleCacheKey]);
               hasRoleCache = true;
            }
            if (auditPendingCacheRef.current && auditPendingCacheRef.current.dateKey === dateKey) {
               setAuditPendingData(auditPendingCacheRef.current.data);
               hasPendingCache = true;
            }
         }

         // Decide which loading state to use
         if (!hasRoleCache || !hasPendingCache || forceRefresh) {
            setIsLoadingAuditData(true);
         } else {
            setIsBackgroundRefreshingAudit(true);
         }

         // 2. Fetch Fresh Data (SWR Phase 2: Revalidate)
         const fetchPromises = [fetchOptimizedData(auditRoleFilter)];
         if (!hasPendingCache || forceRefresh) {
            fetchPromises.push(fetchOptimizedData('GUDANG', true));
         }

         const results = await Promise.all(fetchPromises);
         const roleData = results[0];

         // Update cache and state with fresh data
         auditRoleCacheRef.current[roleCacheKey] = roleData;
         setAuditRoleData(roleData);

         if (results.length > 1) {
            const gudangAuditData = results[1];
            auditPendingCacheRef.current = { dateKey, data: gudangAuditData };
            setAuditPendingData(gudangAuditData);
         }

         const now = new Date();
         setLastAuditFetchTime(\`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}:\${String(now.getSeconds()).padStart(2, '0')}\`);`;
   lines.splice(start, end - start + 1, replacement);
   fs.writeFileSync('components/AdminDashboard.tsx', lines.join('\n'));
   console.log('Successfully replaced fetchAuditData block!');
} else {
   console.log('Could not find start/end bounds', start, end);
}
