import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeClientConfig } from '../shared/realtime';

type CachedClient = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  client: SupabaseClient;
};

let cached: CachedClient | null = null;

export async function getSupabaseBrowserClient(
  config: RealtimeClientConfig,
): Promise<SupabaseClient> {
  if (
    cached &&
    cached.supabaseUrl === config.supabaseUrl &&
    cached.supabaseAnonKey === config.supabaseAnonKey
  ) {
    if (cached.accessToken !== config.accessToken) {
      cached.accessToken = config.accessToken;
      await cached.client.realtime.setAuth(config.accessToken);
    }

    return cached.client;
  }

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  await client.realtime.setAuth(config.accessToken);

  cached = {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    accessToken: config.accessToken,
    client,
  };

  return client;
}

export function resetSupabaseBrowserClient(): void {
  cached = null;
}
