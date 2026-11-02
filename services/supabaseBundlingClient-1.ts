import { createClient } from '@supabase/supabase-js';

// Credentials provided by user for "Gudang Bundling" specific database
const supabaseUrl = 'https://jtmtrgftznvgqwqvledm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0bXRyZ2Z0em52Z3F3cXZsZWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MzE0MTIsImV4cCI6MjA4NTEwNzQxMn0.oW4LWBflYiyWzgom5AMiW9PYIzYYMmMaYpDVvaJYux8';

export const supabaseBundling = createClient(supabaseUrl, supabaseKey);
