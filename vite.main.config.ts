import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname), '');

  return {
    build: {
      rollupOptions: {
        external: ['electron'],
      },
    },
    define: {
      __FLEXHUBS_API_BASE_URL__: JSON.stringify(
        env.VITE_API_BASE_URL ??
          env.NEXT_PUBLIC_API_URL ??
          env.API_BASE_URL ??
          '',
      ),
      __FLEXHUBS_SUPABASE_URL__: JSON.stringify(
        env.VITE_SUPABASE_URL ??
          env.NEXT_PUBLIC_SUPABASE_URL ??
          '',
      ),
      __FLEXHUBS_SUPABASE_ANON_KEY__: JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY ??
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          '',
      ),
    },
  };
});
