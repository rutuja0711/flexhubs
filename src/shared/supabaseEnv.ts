type EnvRecord = Record<string, string | undefined>;

declare const __FLEXHUBS_SUPABASE_URL__: string | undefined;
declare const __FLEXHUBS_SUPABASE_ANON_KEY__: string | undefined;

/** Supabase project URL/key baked in at desktop build time (CI secrets or local .env via Vite). */
export function readEmbeddedSupabaseBuildConfig(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  const supabaseUrl =
    typeof __FLEXHUBS_SUPABASE_URL__ !== 'undefined' ? __FLEXHUBS_SUPABASE_URL__.trim() : '';
  const supabaseAnonKey =
    typeof __FLEXHUBS_SUPABASE_ANON_KEY__ !== 'undefined'
      ? __FLEXHUBS_SUPABASE_ANON_KEY__.trim()
      : '';

  return { supabaseUrl, supabaseAnonKey };
}

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
  const embedded = readEmbeddedSupabaseBuildConfig();

  return {
    supabaseUrl:
      readEnvString(env, ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) || embedded.supabaseUrl,
    supabaseAnonKey:
      readEnvString(env, [
        'VITE_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'VITE_SUPABASE_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      ]) || embedded.supabaseAnonKey,
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
