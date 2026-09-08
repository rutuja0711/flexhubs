type EnvRecord = Record<string, string | undefined>;

function readEnvString(env: EnvRecord, keys: string[]): string {
  for (const key of keys) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return '';
}

export function readSupabasePublicConfig(env: EnvRecord): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  return {
    supabaseUrl: readEnvString(env, ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
    supabaseAnonKey: readEnvString(env, [
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ]),
  };
}

export function buildRealtimeClientConfig(
  accessToken: string,
  env: EnvRecord,
): { accessToken: string; supabaseUrl: string; supabaseAnonKey: string } | null {
  const { supabaseUrl, supabaseAnonKey } = readSupabasePublicConfig(env);

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    accessToken,
    supabaseUrl,
    supabaseAnonKey,
  };
}
