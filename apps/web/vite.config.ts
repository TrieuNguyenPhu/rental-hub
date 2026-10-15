import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  publicDir: path.join(root, 'public'),
  build: { outDir: path.resolve(root, '../../.local/build/web'), emptyOutDir: true },
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001', '/images': 'http://127.0.0.1:3001' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3001', '/images': 'http://127.0.0.1:3001' } },
})
