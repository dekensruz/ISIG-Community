
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }

  // @ts-ignore
  if (typeof window !== 'undefined' && window.process?.env?.[key]) {
    // @ts-ignore
    return window.process.env[key];
  }

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

// On ne crash pas, mais on avertit clairement
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Configuration Supabase manquante. L'application risque de ne pas fonctionner.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Fonction utilitaire pour optimiser les images via Supabase Image Transformation
// Cela permet de ne pas charger des images 4K pour des avatars de 50px
export const getOptimizedImageUrl = (url: string | undefined | null, width: number = 500, quality: number = 80): string | undefined => {
  if (!url) return undefined;
  
  // Si l'URL ne vient pas du stockage Supabase de ce projet, on la retourne telle quelle
  if (!url.includes(supabaseUrl)) return url;
  
  // Si c'est déjà une URL transformée, on évite la duplication (check basique)
  if (url.includes('?')) return url;

  // On ajoute les paramètres de transformation
  // resize=cover permet de garder le ratio en remplissant la box
  // format=origin permet à Supabase de servir du WebP si le navigateur le supporte (automatique souvent) 
  // ou on force format=webp pour la perf.
  return `${url}?width=${width}&quality=${quality}&resize=cover&format=webp`;
};
