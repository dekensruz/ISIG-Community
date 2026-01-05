
import { createClient } from '@supabase/supabase-js';

// Récupération sécurisée des variables d'environnement
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
