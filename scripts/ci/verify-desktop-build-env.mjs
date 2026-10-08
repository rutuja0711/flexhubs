#!/usr/bin/env node
/**
 * Ensures Supabase env vars are present before packaging — required for calls in production.
 */
import fs from 'node:fs';
import path from 'node:path';

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function pickEnv(fileEnv, key, altKeys = []) {
  if (process.env[key]?.trim()) {
    return process.env[key].trim();
  }

  for (const alt of altKeys) {
    if (process.env[alt]?.trim()) {
      return process.env[alt].trim();
    }
    if (fileEnv[alt]?.trim()) {
      return fileEnv[alt].trim();
    }
  }

  return fileEnv[key]?.trim() ?? '';
}

const fileEnv = readDotEnv(path.join(process.cwd(), '.env'));
const supabaseUrl = pickEnv(fileEnv, 'VITE_SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
const supabaseKey = pickEnv(fileEnv, 'VITE_SUPABASE_ANON_KEY', [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);

if (supabaseUrl && supabaseKey) {
  console.log('Desktop build env OK (Supabase URL + anon key found).');
  process.exit(0);
}

console.error(`
Desktop build is missing Supabase configuration — calls will NOT work in the packaged app.

Add to flexhubs/.env (copy from the web app):

  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJ...

Or export those variables in your shell before \`npm run make:mac\` / \`npm run release:mac:stage\`.

For GitHub Actions builds, set repository secrets:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
`);

process.exit(1);
