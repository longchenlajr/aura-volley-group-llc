import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface CliContext {
  supabase: SupabaseClient;
  env: 'local' | 'live';
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  teamSize: number;
}

export function createCliClient(env: 'local' | 'live'): SupabaseClient {
  const url =
    env === 'local' ? process.env.SUPABASE_URL_LOCAL : process.env.SUPABASE_URL_LIVE;
  const key =
    env === 'local' ? process.env.SUPABASE_KEY_LOCAL : process.env.SUPABASE_KEY_LIVE;

  if (!url || !key) {
    const src =
      env === 'local'
        ? '.env.development.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)'
        : '.env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)';
    throw new Error(`Missing credentials for ${env} — check ${src}`);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
