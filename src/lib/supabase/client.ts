import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  console.log('Creating Supabase client for URL:', process.env.NEXT_PUBLIC_SUPABASE_URL!);
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}






