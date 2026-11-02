import { createClient } from '@supabase/supabase-js';

const url = 'https://nufvlqrtpzfiqghsxsze.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZnZscXJ0cHpmaXFnaHN4c3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUwNDksImV4cCI6MjEwNDM0MTA0OX0.ckrLJhBmaGP3nBL_l3OjOntEliCuz4wtlJM3kgwZs_Y';

const supabase = createClient(url, key);

async function run() {
  // Check if PICKER_2 is in app_roles
  const { data: existingRoles, error: checkError } = await supabase.from('app_roles').select('*').eq('name', 'PICKER_2');
  if (checkError) {
    console.error("Error checking app_roles:", checkError);
    return;
  }
  
  if (!existingRoles || existingRoles.length === 0) {
    console.log("PICKER_2 not found in app_roles. Inserting...");
    const { error: insertError } = await supabase.from('app_roles').insert([{ name: 'PICKER_2' }]);
    if (insertError) {
      console.error("Error inserting into app_roles:", insertError);
    } else {
      console.log("Successfully inserted PICKER_2 into app_roles.");
    }
  } else {
    console.log("PICKER_2 already exists in app_roles.");
  }
}

run();
