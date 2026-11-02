import { createClient } from '@supabase/supabase-js';

const url = 'https://nufvlqrtpzfiqghsxsze.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZnZscXJ0cHpmaXFnaHN4c3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjUwNDksImV4cCI6MjEwNDM0MTA0OX0.ckrLJhBmaGP3nBL_l3OjOntEliCuz4wtlJM3kgwZs_Y';

const supabase = createClient(url, key);

async function run() {
  const { data: employees, error } = await supabase.from('employees').select('*');
  if (error) {
    console.error('Error fetching employees:', error);
    return;
  }
  
  if (employees) {
    for (const emp of employees) {
      if (emp.allowed_roles) {
        let roles = [];
        try {
          roles = typeof emp.allowed_roles === 'string' ? JSON.parse(emp.allowed_roles) : emp.allowed_roles;
        } catch (e) {
          roles = [emp.allowed_roles];
        }

        if (Array.isArray(roles) && (roles.includes('PICKER') || roles.includes('Picker')) && !roles.includes('PICKER_2')) {
          roles.push('PICKER_2');
          
          await supabase.from('employees').update({ allowed_roles: roles }).eq('id', emp.id);
          console.log(`Updated employee ${emp.name} with PICKER_2 role`);
        }
      }
    }
    console.log("Finished updating employees.");
  }
}

run();
