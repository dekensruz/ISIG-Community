
import { createClient } from '@supabase/supabase-js';

/**
 * Récupère une variable d'environnement de manière robuste
 * Compatible avec Vite, Vercel, et les environnements de prévisualisation
 */
const getEnv = (key: string): string => {
  // 1. Vérification dans process.env (Node/Standard)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  
  // 2. Vérification dans import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }

  // 3. Vérification dans window.process.env (Polyfill index.html)
  // @ts-ignore
  if (typeof window !== 'undefined' && window.process?.env?.[key]) {
    // @ts-ignore
    return window.process.env[key];
  }

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "⚠️ ISIG Community : Configuration Supabase manquante ! " +
    "Assurez-vous que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies dans vos variables d'environnement."
  );
}

// Nous utilisons des valeurs par défaut minimales pour éviter que createClient ne lève une exception fatale
// qui bloquerait tout le rendu de l'application au démarrage.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
