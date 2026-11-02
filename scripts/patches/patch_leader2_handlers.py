import sys

path = 'components/AdminDashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

leader2_handlers = """
   const handleLeader2BulkAction = async () => {
      if (selectedScanIds.length === 0) return;
      if (!leader2BulkStaff && !leader2BulkDate && !bulkChangeRoleTarget) {
         alert("Pilih staff, tanggal, atau type yang mau diubah!");
         return;
      }
      
      const { data: dbSession } = await supabase.auth.getSession();
      if (!dbSession.session) {
         alert('Session expired. Harap login kembali.');
         return;
      }

      setIsDeletingRange(true);
      try {
         const updates: any = {};
         if (leader2BulkStaff) updates.leader_name = leader2BulkStaff;
         if (leader2BulkDate) updates.date = leader2BulkDate;
         if (bulkChangeRoleTarget) updates.scan_type = bulkChangeRoleTarget;

         for (const itemId of selectedScanIds) {
             const { error } = await supabase
                 .from('leader_scan_2')
                 .update(updates)
                 .eq('id', itemId);
             
             if (error) console.error("Error updating leader_scan_2 item " + itemId, error);
         }

         setSuccessToast(`Berhasil mengubah ${selectedScanIds.length} data.`);
         setSelectedScanIds([]);
         setLeader2BulkStaff('');
         setLeader2BulkDate('');
         setBulkChangeRoleTarget('PACKING');
         fetchPackingData();
         fetchLeaderOrders();
      } catch (err: any) {
         alert("Gagal mengubah data: " + err.message);
      } finally {
         setIsDeletingRange(false);
      }
   };

   const handleDeleteLeader2Bulk = async () => {
      if (selectedScanIds.length === 0) return;
      if (!confirm(`Yakin ingin MENGHAPUS PERMANEN ${selectedScanIds.length} data terpilih?`)) return;

      setIsDeletingRange(true);
      try {
         for (const itemId of selectedScanIds) {
             const { error } = await supabase
                 .from('leader_scan_2')
                 .delete()
                 .eq('id', itemId);
             if (error) console.error("Error deleting leader_scan_2 item " + itemId, error);
         }
         setSuccessToast(`Berhasil menghapus ${selectedScanIds.length} data.`);
         setSelectedScanIds([]);
         fetchPackingData();
         fetchLeaderOrders();
      } catch (err: any) {
         alert("Gagal menghapus data: " + err.message);
      } finally {
         setIsDeletingRange(false);
      }
   };
"""

if "const handleLeader2BulkAction = async" not in content:
    content = content.replace("const handleBulkRoleUpdate = async () => {", leader2_handlers + "\n   const handleBulkRoleUpdate = async () => {")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
