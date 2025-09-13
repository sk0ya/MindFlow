import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@local': path.resolve(__dirname, './src/Local'),
      '@local/core': path.resolve(__dirname, './src/Local/core'),
      '@local/features': path.resolve(__dirname, './src/Local/features'),
      '@local/shared': path.resolve(__dirname, './src/Local/shared'),
      '@cloud': path.resolve(__dirname, './src/Cloud'),
      '@shared': path.resolve(__dirname, './src/shared')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
base: '/MindFlow/',
})
