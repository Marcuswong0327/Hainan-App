/**
 * Sync backend/functions → database/functions for Supabase CLI deploy.
 * Source of truth: backend/functions/
 */
import { cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'backend', 'functions');
const dest = join(root, 'database', 'functions');

if (!existsSync(src)) {
  console.error('backend/functions/ not found');
  process.exit(1);
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Synced backend/functions → database/functions');
