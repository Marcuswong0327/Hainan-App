import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Load .env from repo root (monorepo) or frontend/
  envDir: path.resolve(__dirname, '..'),
  cacheDir: '.vite',
  optimizeDeps: {
    exclude: [
      '@supabase/supabase-js',
      'lucide-react',
      '@radix-ui/react-slot',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
