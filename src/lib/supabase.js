import { createClient } from '@supabase/supabase-js';

// Supabase credentials come from Netlify environment variables
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Nothing secret is in the code.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
