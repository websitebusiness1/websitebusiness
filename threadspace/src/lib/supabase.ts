import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

// Only the publishable/anon key is ever used in the browser. Access is enforced by Row Level Security.
export const supabase = createClient(url || 'https://not-configured.invalid', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const IMAGE_BUCKET = 'product-images';
