
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aaocynudrgyrpwrbetem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhb2N5bnVkcmd5cnB3cmJldGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTk0NTQsImV4cCI6MjA3NzE3NTQ1NH0.XiZBLRhr7Q-QtJDu9qmaL14CRpbgVdQZfzDyzQX03Gg';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
