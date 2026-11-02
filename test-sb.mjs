import { createClient } from '@supabase/supabase-js';
const ACTIVE_URL = 'https://nufvlqrtpzfiqghsxsze.supabase.co';
const ACTIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZnZscXJ0cHpmaXFnaHN4c3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUwNDksImV4cCI6MjEwNDM0MTA0OX0.ckrLJhBmaGP3nBL_l3OjOntEliCuz4wtlJM3kgwZs_Y';
const supabase = createClient(ACTIVE_URL, ACTIVE_KEY);

async function check() {
  try {
     const term = 'CM77367628500';
     const upper = term.toUpperCase();
     const { data, error } = await supabase
        .from('scanned_items')
        .select('*')
        .or('barcode.eq.' + upper + ',barcode.ilike.%' + term + '%,destination.ilike.%' + term + '%')
        .limit(100);
     
     console.log('Supabase-JS result length:', data ? data.length : 0, 'Error:', error);
  } catch(e) {
     console.error('Exception:', e);
  }
}
check();
