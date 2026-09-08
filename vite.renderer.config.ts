import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(__dirname), '');

  return {
    root: path.join(__dirname, 'src/renderer'),
    envDir: __dirname,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    base: './',
    define: {
      __FLEXHUBS_API_BASE_URL__: JSON.stringify(
        env.VITE_API_BASE_URL ?? env.NEXT_PUBLIC_API_URL ?? env.API_BASE_URL ?? '',
      ),
      __FLEXHUBS_SUPABASE_URL__: JSON.stringify(
        env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      ),
      __FLEXHUBS_SUPABASE_ANON_KEY__: JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY ??
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
          env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          '',
      ),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: path.join(__dirname, '.vite/renderer/main_window'),
      emptyOutDir: true,
    },
    plugins: [react()],
  };
});
