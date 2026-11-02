import { createClient } from '@supabase/supabase-js';

const url = 'https://nufvlqrtpzfiqghsxsze.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZnZscXJ0cHpmaXFnaHN4c3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUwNDksImV4cCI6MjEwNDM0MTA0OX0.ckrLJhBmaGP3nBL_l3OjOntEliCuz4wtlJM3kgwZs_Y';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('app_profiles_config')
    .upsert({ role: 'PICKER_2', is_active: true, sort_order: 1 }, { onConflict: 'role' });
    
  if (error) {
    console.error('Error inserting PICKER_2:', error);
  } else {
    console.log('Successfully inserted PICKER_2 config:', data);
  }

  // Also add PICKER_2 to users who have PICKER
  const { data: users, error: usersError } = await supabase.from('app_users').select('*');
  if (!usersError && users) {
    for (const user of users) {
      if (user.roles && user.roles.includes('PICKER') && !user.roles.includes('PICKER_2')) {
        await supabase.from('app_users').update({ roles: [...user.roles, 'PICKER_2'] }).eq('email', user.email);
        console.log(`Updated user ${user.email} with PICKER_2 role`);
      }
    }
  }
}

run();
